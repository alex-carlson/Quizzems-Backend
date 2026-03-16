import multer from "multer";
import axios from "axios";
import sharp from "sharp";
import https from "https";
import { limit } from "../utils/rateLimit.js";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { convertGifOnUpload } from "../utils/gifConverter.js";

const storage = multer.memoryStorage();
const upload = multer({ storage });

// Cloudflare R2 config (S3-compatible API)
const s3Client = new S3Client({
    region: process.env.AWS_REGION || "auto", // R2 uses 'auto' region
    endpoint: process.env.AWS_S3_ENDPOINT, // R2 endpoint
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
    // R2-specific optimizations
    forcePathStyle: true, // Required for R2
    requestHandler: {
        requestTimeout: 30000, // 30 second timeout
        httpsAgent: {
            maxSockets: 25,
        }
    },
});
const s3Bucket = process.env.AWS_S3_BUCKET || "uploads";

async function uploadToR2(buffer, fileName, contentType) {
    try {
        // Cloudflare R2 optimized upload
        const command = new PutObjectCommand({
            Bucket: s3Bucket,
            Key: fileName,
            Body: buffer,
            ContentType: contentType,
            // R2 doesn't support ACLs - public access is configured at bucket level
            CacheControl: "public, max-age=31536000, immutable", // 1 year cache for images
            Metadata: {
                'uploaded-by': 'flash-backend',
                'upload-timestamp': new Date().toISOString(),
                'cloudflare-token': process.env.CLOUDFLARE_TOKEN ? 'configured' : 'not-configured'
            }
        });

        await s3Client.send(command);

        // Construct public URL using the configured public domain
        const endpoint = process.env.AWS_S3_PUBLIC_URL || process.env.AWS_S3_ENDPOINT;
        const publicUrl = `${endpoint.replace(/\/$/, "")}/${fileName}`;

        console.log(`✅ Uploaded to Cloudflare R2: ${publicUrl}`);
        return publicUrl;
    } catch (error) {
        console.error('❌ R2 Upload Error:', {
            message: error.message,
            code: error.code,
            statusCode: error.$metadata?.httpStatusCode,
            requestId: error.$metadata?.requestId
        });
        throw new Error(`R2 upload failed: ${error.message}`);
    }
}

async function deleteFromR2(fileName) {
    try {
        const command = new DeleteObjectCommand({
            Bucket: s3Bucket,
            Key: fileName,
        });
        await s3Client.send(command);
        console.log(`✅ Deleted from Cloudflare R2: ${fileName}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to delete from R2: ${fileName}`, {
            message: error.message,
            code: error.code,
            statusCode: error.$metadata?.httpStatusCode
        });
        throw error;
    }
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
    await limit(async () => {
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

            // Fetch the image with proper headers to handle CORS and other issues
            const axiosConfig = {
                responseType: "arraybuffer",
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'image/*,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                    'Sec-Fetch-Dest': 'image',
                    'Sec-Fetch-Mode': 'no-cors',
                    'Sec-Fetch-Site': 'cross-site',
                },
                timeout: 30000, // 30 second timeout
                maxRedirects: 5,
                validateStatus: (status) => status < 400, // Accept all status codes under 400
                // Additional config for AWS EC2 deployment
                httpsAgent: new https.Agent({
                    rejectUnauthorized: false, // Handle self-signed certificates
                }),
                // Disable proxy detection that might interfere on EC2
                proxy: false,
                decompress: true,
                maxContentLength: 50 * 1024 * 1024, // 50MB max
                maxBodyLength: 50 * 1024 * 1024, // 50MB max
            };

            const fileResponse = await axios.get(fileUrl, axiosConfig);

            if (!fileResponse.data) {
                throw new Error("No image data received from URL");
            }

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

            // Upload to Cloudflare R2
            try {
                const publicURL = await uploadToR2(fileBuffer, finalFileName, contentType);
                console.log("🚀 R2 Public URL:", publicURL);
                req.uploadedImageUrl = publicURL;

                // Convert GIF asynchronously if this is a GIF upload
                if (finalFileName.toLowerCase().endsWith('.gif')) {
                    console.log("🔄 Starting GIF conversion for URL upload:", finalFileName);
                    convertGifOnUpload(finalFileName, fileBuffer)
                        .then(result => {
                            if (result && !result.skipped) {
                                console.log("✅ GIF conversion completed:", finalFileName);
                            } else if (result && result.skipped) {
                                console.log("ℹ️ GIF conversion skipped (files exist):", finalFileName);
                            }
                        })
                        .catch(error => {
                            console.error("❌ GIF conversion failed:", finalFileName, error.message);
                        });
                }

                return next();
            } catch (error) {
                console.error("❌ R2 Upload Error:", error);
                return res.status(400).json({ message: "Failed to upload to Cloudflare R2", details: error.message });
            }
        } catch (error) {
            console.error("❌ Unexpected Error:", error);

            // Provide more specific error messages
            if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
                return res.status(400).json({
                    message: "Unable to fetch image from URL",
                    details: "The image URL may be invalid or the server is not reachable",
                    originalError: error.message
                });
            }

            if (error.response) {
                // The request was made and the server responded with a status code
                // that falls out of the range of 2xx
                const statusCode = error.response.status;
                const statusText = error.response.statusText;

                if (statusCode === 403 || statusCode === 401) {
                    return res.status(400).json({
                        message: "Access denied to image URL",
                        details: `Server returned ${statusCode}: ${statusText}. The image may be protected or require authentication.`
                    });
                }

                if (statusCode === 404) {
                    return res.status(400).json({
                        message: "Image not found",
                        details: "The image URL returned a 404 error. Please check if the URL is correct."
                    });
                }

                return res.status(400).json({
                    message: "Failed to fetch image from URL",
                    details: `Server returned ${statusCode}: ${statusText}`,
                    statusCode: statusCode
                });
            }

            if (error.request) {
                // The request was made but no response was received (likely CORS or network issue)
                return res.status(400).json({
                    message: "Network error when fetching image",
                    details: "This may be due to CORS restrictions, network connectivity issues, or the server blocking our request. Try using a direct image URL or uploading the file instead.",
                    suggestion: "Consider downloading the image and uploading it directly instead of using the URL."
                });
            }

            // Something else happened in setting up the request
            res.status(500).json({
                message: "Internal Server Error",
                details: error.message,
                type: "unexpected_error"
            });
        }
    });
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

        console.log("Final file name:", finalFileName);
        console.log("Safe folder name:", safeFolder);


        // Upload to Cloudflare R2
        try {
            const publicURL = await uploadToR2(file.buffer, finalFileName, file.mimetype);
            console.log("🚀 R2 Public URL:", publicURL);
            req.uploadedImageUrl = publicURL;

            // Convert GIF asynchronously if this is a GIF upload
            if (fileExtension === 'gif') {
                console.log("🔄 Starting GIF conversion for:", finalFileName);
                convertGifOnUpload(finalFileName, file.buffer)
                    .then(result => {
                        if (result && !result.skipped) {
                            console.log("✅ GIF conversion completed:", finalFileName);
                        } else if (result && result.skipped) {
                            console.log("ℹ️ GIF conversion skipped (files exist):", finalFileName);
                        }
                    })
                    .catch(error => {
                        console.error("❌ GIF conversion failed:", finalFileName, error.message);
                    });
            }

            return next();
        } catch (error) {
            console.error("❌ R2 Upload Error:", error);
            return res.status(400).json({ message: "Failed to upload to Cloudflare R2", details: error.message });
        }
    } catch (error) {
        console.error("❌ Unexpected Error:", error);
        res.status(500).json({ message: "Internal Server Error", details: error.message });
    }
};

export { upload, deleteFromR2 };
