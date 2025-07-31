import multer from "multer";
import axios from "axios";
import sharp from "sharp";
import { getSupabaseClientWithToken, supabase } from "../config/supabaseClient.js";
// AWS S3 (R2) support
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const storage = multer.memoryStorage();
const upload = multer({ storage });

// S3 config (use env vars)
const s3Client = new S3Client({
    region: process.env.AWS_REGION || "auto",
    endpoint: process.env.AWS_S3_ENDPOINT, // R2 endpoint
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});
const s3Bucket = process.env.AWS_S3_BUCKET || "uploads";

async function uploadToS3(buffer, fileName, contentType) {
    // Always overwrite the file if it exists (PutObjectCommand will overwrite by default)
    const command = new PutObjectCommand({
        Bucket: s3Bucket,
        Key: fileName,
        Body: buffer,
        ContentType: contentType,
        ACL: "public-read",
        CacheControl: "no-cache, max-age=0, must-revalidate"
    });
    await s3Client.send(command); // This will overwrite any existing file with the same key
    // Construct public URL with cache buster
    const endpoint = process.env.AWS_S3_PUBLIC_URL || process.env.AWS_S3_ENDPOINT;
    const cacheBuster = `cb=${Date.now()}`;
    return `${endpoint.replace(/\/$/, "")}/${fileName}?${cacheBuster}`;
}

function sanitizeName(name) {
    // Only replace invalid characters, but keep the last dot for the extension
    const lastDot = name.lastIndexOf('.');
    if (lastDot === -1) return name.replace(/[^a-zA-Z0-9-_]/g, "_");
    const base = name.substring(0, lastDot).replace(/[^a-zA-Z0-9-_]/g, "_");
    const ext = name.substring(lastDot + 1).replace(/[^a-zA-Z0-9]/g, "");
    return ext ? `${base}.${ext}` : base;
}

export const uploadUrlToSupabase = async (req, res, next) => {
    try {
        const { folder, uuid, bucket: reqBucket, fileName, forceJpeg, useS3 } = req.body;
        const token = req.headers.authorization?.split(" ")[1];
        const bucket = reqBucket || "quizzems";
        const fileUrl = req.body.url;

        if (!token) return res.status(401).json({ message: "No token provided" });
        if (!fileUrl) return res.status(400).json({ message: "Please provide a file URL." });

        console.log("🚀 Uploading to S3 from URL:", {
            folder, uuid, bucket, fileUrl, fileName,
        });

        const fileResponse = await axios.get(fileUrl, { responseType: "arraybuffer" });
        let fileBuffer = Buffer.from(fileResponse.data, "binary");
        let contentType = fileResponse.headers["content-type"] || "application/octet-stream";
        let finalFileName = fileName || uuid;

        // Convert to JPEG if requested
        if (forceJpeg === true || forceJpeg === "true") {
            console.log("🔄 Converting URL image to JPEG");
            fileBuffer = await sharp(fileBuffer)
                .jpeg({ quality: 80 })
                .toBuffer();
            contentType = "image/jpeg";
            finalFileName = `${uuid}.jpg`;
        } else {
            let fileExtension = "";
            const lastDotIndex = fileUrl.lastIndexOf(".");
            if (lastDotIndex !== -1 && lastDotIndex < fileUrl.length - 1) {
                fileExtension = fileUrl.substring(lastDotIndex + 1).split(/[?#]/)[0];
            }
            finalFileName = fileName || `${uuid}.${fileExtension}`;
        }

        // Always upload to S3 for new images
        try {
            const publicURL = await uploadToS3(fileBuffer, finalFileName, contentType);
            console.log("🚀 S3 Public URL:", publicURL);
            req.uploadedImageUrl = publicURL;
            return next();
        } catch (error) {
            console.error("❌ S3 Upload Error:", error);
            return res.status(400).json({ message: "Failed to upload to S3", details: error.message });
        }
    } catch (error) {
        console.error("❌ Unexpected Error:", error);
        res.status(500).json({ message: "Internal Server Error", details: error.message });
    }
};

export const UploadToSupabase = async (req, res, next) => {
    try {
        const { folder, uuid, forceJpeg } = req.body;
        const file = req.file ?? req.body.file;
        const token = req.headers.authorization?.split(" ")[1];
        const bucket = "uploads";

        if (!token) return res.status(401).json({ message: "No token provided" });
        if (!file) return res.status(400).json({ message: "Please upload an image." });

        console.log("🔄 Processing file:", {
            folder, uuid, bucket,
            file: file?.originalname || "No file",
            forceJpeg: forceJpeg || false,
        });

        if (!file.originalname) {
            file.originalname = `file-${Date.now()}`;
        }

        let fileExtension = file.originalname.split(".").pop().toLowerCase();

        if (forceJpeg === true || forceJpeg === "true") {
            console.log("🔄 Converting uploaded file to JPEG");
            const jpgBuffer = await sharp(file.buffer)
                .jpeg({ quality: 80 })
                .toBuffer();
            fileExtension = "jpg";
            file.buffer = jpgBuffer;
            file.mimetype = "image/jpeg";
            file.originalname = `${file.originalname.split(".")[0]}.${fileExtension}`;
        }

        const safeFolder = sanitizeName(folder || "uploads");
        const finalFileName = `${uuid}.${fileExtension}`;

        console.log("🚀 Final file name:", finalFileName);
        console.log("Safe folder name:", safeFolder);
        

        // Always upload to S3 for new images
        try {
            const publicURL = await uploadToS3(file.buffer, finalFileName, file.mimetype);
            console.log("🚀 S3 Public URL:", publicURL);
            req.uploadedImageUrl = publicURL;
            return next();
        } catch (error) {
            console.error("❌ S3 Upload Error:", error);
            return res.status(400).json({ message: "Failed to upload to S3", details: error.message });
        }
    } catch (error) {
        console.error("❌ Unexpected Error:", error);
        res.status(500).json({ message: "Internal Server Error", details: error.message });
    }
};

export { upload };
