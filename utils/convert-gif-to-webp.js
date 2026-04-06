import {
    S3Client,
    ListObjectsV2Command,
    GetObjectCommand,
    PutObjectCommand,
    HeadObjectCommand
} from "@aws-sdk/client-s3";

import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import os from "os";
import path from "path";
import { pipeline } from "stream/promises";
import pLimit from "p-limit";
import "dotenv/config";

const r2 = new S3Client({
    region: "auto",
    endpoint: process.env.AWS_S3_ENDPOINT,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

const bucket = process.env.AWS_S3_BUCKET || "quizzems";
const TMP = os.tmpdir();
const CONCURRENCY = 2;
const limit = pLimit(CONCURRENCY);

async function exists(key) {
    try {
        await r2.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return true;
    } catch {
        return false;
    }
}

async function convertGif(objKey) {
    if (!objKey.endsWith(".gif")) return;

    const mp4Key = objKey.replace(".gif", ".mp4");
    const webpKey = objKey.replace(".gif", ".webp");

    if (await exists(mp4Key) && await exists(webpKey)) {
        return;
    }

    const safeName = objKey.replace(/[\/]/g, "_").replace(/\.gif$/i, "");
    const gifPath = path.join(TMP, safeName + ".gif");
    const mp4Path = `${TMP}/${safeName}.mp4`;
    const webpPath = `${TMP}/${safeName}.webp`;

    console.log("Processing:", objKey);

    try {
        // Download GIF from R2
        const gifObject = await r2.send(new GetObjectCommand({ Bucket: bucket, Key: objKey }));
        await pipeline(gifObject.Body, fs.createWriteStream(gifPath));

        const stats = fs.statSync(gifPath);
        if (stats.size === 0) {
            console.log("Skipping: Downloaded GIF is empty:", objKey);
            return;
        }

        if (stats.size < 100) {
            console.log("Skipping: File too small (likely corrupted):", objKey, `(${stats.size} bytes)`);
            return;
        }

        // Basic GIF header validation
        const buffer = fs.readFileSync(gifPath, { start: 0, end: 5 });
        const header = buffer.toString('ascii');
        if (!header.startsWith('GIF8')) {
            console.log("Skipping: Invalid GIF header:", objKey, `(header: ${header})`);
            return;
        }

        // --- Convert GIF to MP4 ---
        await new Promise((resolve, reject) => {
            ffmpeg(gifPath)
                .inputOptions([
                    "-f gif",            // force input format
                    "-analyzeduration 100M", // give it time to probe large gifs
                    "-probesize 100M"
                ])
                .outputOptions([
                    "-movflags faststart",
                    "-pix_fmt yuv420p"
                ])
                .videoFilters("scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=30")
                .toFormat("mp4")
                .on("start", cmd => console.log("FFmpeg MP4 command:", cmd))
                .on("stderr", stderr => console.log(stderr))
                .on("end", resolve)
                .on("error", reject)
                .save(mp4Path);
        });

        // // --- Convert GIF to animated WebP ---
        // await new Promise((resolve, reject) => {
        //     ffmpeg(gifPath)
        //         .inputOptions([
        //             "-f gif",
        //             "-analyzeduration 100M",
        //             "-probesize 100M"
        //         ])
        //         .outputOptions([
        //             "-vcodec libwebp",
        //             "-lossless 0",
        //             "-q:v 75",
        //             "-preset default",
        //             "-loop 0",
        //             "-an"
        //         ])
        //         .videoFilters("scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=30")
        //         .toFormat("webp")
        //         .on("start", cmd => console.log("FFmpeg WebP command:", cmd))
        //         .on("stderr", stderr => console.log(stderr))
        //         .on("end", resolve)
        //         .on("error", reject)
        //         .save(webpPath);
        // });

        // Upload MP4
        await r2.send(new PutObjectCommand({
            Bucket: bucket,
            Key: mp4Key,
            Body: fs.readFileSync(mp4Path),
            ContentType: "video/mp4"
        }));

        // // Upload WebP
        // await r2.send(new PutObjectCommand({
        //     Bucket: bucket,
        //     Key: webpKey,
        //     Body: fs.readFileSync(webpPath),
        //     ContentType: "image/webp"
        // }));

        console.log("Finished:", objKey);

    } catch (err) {
        console.error("Failed:", objKey, err);
    } finally {
        // Clean up temp files
        [gifPath, mp4Path, webpPath].forEach(f => {
            if (fs.existsSync(f)) fs.unlinkSync(f);
        });
    }
}

async function processBucket() {
    let continuationToken = undefined;

    do {
        const response = await r2.send(new ListObjectsV2Command({
            Bucket: bucket,
            ContinuationToken: continuationToken
        }));

        const gifs = response.Contents?.filter(obj => obj.Key.endsWith(".gif")) || [];
        const tasks = gifs.map(obj => limit(() => convertGif(obj.Key)));
        await Promise.all(tasks);

        continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    console.log("All GIFs processed");
}

processBucket();