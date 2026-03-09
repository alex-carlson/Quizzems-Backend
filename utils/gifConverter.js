import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import os from "os";
import path from "path";

const s3Client = new S3Client({
    region: process.env.AWS_REGION || "auto",
    endpoint: process.env.AWS_S3_ENDPOINT,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

const bucket = process.env.AWS_S3_BUCKET || "quizzems";
const TMP = os.tmpdir();

async function exists(key) {
    try {
        await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return true;
    } catch {
        return false;
    }
}

export async function convertGifOnUpload(fileName, gifBuffer) {
    if (!fileName.toLowerCase().endsWith('.gif')) return null;

    const baseName = fileName.replace(/\.gif$/i, '');
    const mp4Key = `${baseName}.mp4`;
    const webpKey = `${baseName}.webp`;

    // Skip if both conversions already exist
    const [mp4Exists, webpExists] = await Promise.all([
        exists(mp4Key),
        exists(webpKey)
    ]);

    if (mp4Exists && webpExists) {
        console.log("Conversion files already exist for:", fileName);
        return { mp4Key, webpKey, skipped: true };
    }

    const safeName = fileName.replace(/[\/\\:*?"<>|]/g, "_").replace(/\.gif$/i, "");
    const gifPath = path.join(TMP, `${safeName}_${Date.now()}.gif`);
    const mp4Path = path.join(TMP, `${safeName}_${Date.now()}.mp4`);
    const webpPath = path.join(TMP, `${safeName}_${Date.now()}.webp`);

    try {
        // Write GIF buffer to temp file
        fs.writeFileSync(gifPath, gifBuffer);

        // Validate file size and header
        const stats = fs.statSync(gifPath);
        if (stats.size === 0) {
            console.log("Skipping: Empty GIF file:", fileName);
            return null;
        }

        if (stats.size < 100) {
            console.log("Skipping: GIF too small (likely corrupted):", fileName, `(${stats.size} bytes)`);
            return null;
        }

        // Basic GIF header validation
        const buffer = fs.readFileSync(gifPath, { start: 0, end: 5 });
        const header = buffer.toString('ascii');
        if (!header.startsWith('GIF8')) {
            console.log("Skipping: Invalid GIF header:", fileName, `(header: ${header})`);
            return null;
        }

        console.log("Converting GIF:", fileName);

        // Convert to MP4 (if not exists)
        if (!mp4Exists) {
            await new Promise((resolve, reject) => {
                ffmpeg(gifPath)
                    .inputOptions([
                        "-f gif",
                        "-analyzeduration 100M",
                        "-probesize 100M"
                    ])
                    .outputOptions([
                        "-movflags faststart",
                        "-pix_fmt yuv420p"
                    ])
                    .videoFilters("scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=30")
                    .toFormat("mp4")
                    .on("start", cmd => console.log("FFmpeg MP4 command:", cmd))
                    .on("error", reject)
                    .on("end", resolve)
                    .save(mp4Path);
            });

            // Upload MP4
            const mp4Buffer = fs.readFileSync(mp4Path);
            await s3Client.send(new PutObjectCommand({
                Bucket: bucket,
                Key: mp4Key,
                Body: mp4Buffer,
                ContentType: "video/mp4"
            }));
        }

        // Convert to WebP (if not exists)
        if (!webpExists) {
            await new Promise((resolve, reject) => {
                ffmpeg(gifPath)
                    .inputOptions([
                        "-f gif",
                        "-analyzeduration 100M",
                        "-probesize 100M"
                    ])
                    .outputOptions([
                        "-vcodec libwebp",
                        "-lossless 0",
                        "-q:v 75",
                        "-preset default",
                        "-loop 0",
                        "-an"
                    ])
                    .videoFilters("scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=30")
                    .toFormat("webp")
                    .on("start", cmd => console.log("FFmpeg WebP command:", cmd))
                    .on("error", reject)
                    .on("end", resolve)
                    .save(webpPath);
            });

            // Upload WebP
            const webpBuffer = fs.readFileSync(webpPath);
            await s3Client.send(new PutObjectCommand({
                Bucket: bucket,
                Key: webpKey,
                Body: webpBuffer,
                ContentType: "image/webp"
            }));
        }

        console.log("Successfully converted GIF:", fileName);
        return { mp4Key, webpKey, skipped: false };

    } catch (error) {
        console.error("Failed to convert GIF:", fileName, error);
        return null;
    } finally {
        // Clean up temp files
        [gifPath, mp4Path, webpPath].forEach(f => {
            if (fs.existsSync(f)) {
                try {
                    fs.unlinkSync(f);
                } catch (e) {
                    console.warn("Failed to delete temp file:", f, e.message);
                }
            }
        });
    }
}