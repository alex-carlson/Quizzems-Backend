import multer from "multer";
import axios from "axios";
import sharp from "sharp";
import { getSupabaseClientWithToken, supabase } from "../config/supabaseClient.js";

const storage = multer.memoryStorage();
const upload = multer({ storage });

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
        const { folder, uuid, bucket: reqBucket, fileName, forceJpeg } = req.body;
        const token = req.headers.authorization?.split(" ")[1];
        const bucket = reqBucket || "uploads";
        const fileUrl = req.body.url;

        if (!token) return res.status(401).json({ message: "No token provided" });
        if (!fileUrl) return res.status(400).json({ message: "Please provide a file URL." });

        // Get extension from URL
        let fileExtension = "";
        const lastDotIndex = fileUrl.lastIndexOf(".");
        if (lastDotIndex !== -1 && lastDotIndex < fileUrl.length - 1) {
            fileExtension = fileUrl.substring(lastDotIndex + 1).split(/[?#]/)[0];
        }

        const safeFolder = sanitizeName(folder || "uploads");
        const safeFileName = sanitizeName(fileName || `${uuid}.${fileExtension}`);
        const finalFileName = `${safeFolder}/${safeFileName}`;

        console.log("🚀 Uploading to Supabase from URL:", {
            folder, uuid, bucket, fileUrl, fileName: finalFileName,
        });

        const fileResponse = await axios.get(fileUrl, { responseType: "arraybuffer" });
        let fileBuffer = Buffer.from(fileResponse.data, "binary");
        let contentType = fileResponse.headers["content-type"] || "application/octet-stream";

        // Convert to JPEG if requested
        if (forceJpeg === true || forceJpeg === "true") {
            console.log("🔄 Converting URL image to JPEG");
            fileBuffer = await sharp(fileBuffer)
                .jpeg({ quality: 80 })
                .toBuffer();
            contentType = "image/jpeg";
            finalFileName = `${folder || "uploads"}/${uuid}.jpg`;
        }

        try {
            const { data, error } = await getSupabaseClientWithToken(token).storage
                .from(bucket)
                .upload(finalFileName, fileBuffer, {
                    contentType,
                    upsert: true,
                });

            if (error) {
                console.error("❌ Supabase Upload Error:", error);
                return res.status(400).json({ message: "Failed to upload to Supabase", details: error.message });
            }

            const filePath = data?.path;
            const publicUrlResponse = supabase.storage.from(bucket).getPublicUrl(filePath);
            const publicURL = publicUrlResponse?.data?.publicUrl;

            if (!publicURL) {
                console.error("❌ Failed to retrieve public URL");
                return res.status(400).json({ message: "Failed to retrieve public URL" });
            }

            console.log("🚀 Public URL:", publicURL);
            req.uploadedImageUrl = publicURL;
            next();
        } catch (error) {
            // If error.response exists, log the raw HTML
            if (error.response && error.response.data) {
                let htmlError;
                if (Buffer.isBuffer(error.response.data)) {
                    htmlError = error.response.data.toString('utf8');
                } else if (error.response.data instanceof ArrayBuffer) {
                    htmlError = Buffer.from(error.response.data).toString('utf8');
                } else {
                    htmlError = String(error.response.data);
                }
                console.error("----- BEGIN HTML ERROR RESPONSE -----\n" + htmlError + "\n----- END HTML ERROR RESPONSE -----");
            }
            console.error("❌ Unexpected Error:", error);
            return res.status(500).json({ message: "Internal Server Error", details: error.message });
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
        const finalFileName = `${safeFolder}/${uuid}.${fileExtension}`;

        console.log("🚀 Uploading to Supabase:", {
            folder, uuid, bucket,
            file: file?.originalname || "No file",
            fileName: finalFileName,
        });

        const { data, error } = await getSupabaseClientWithToken(token).storage
            .from(bucket)
            .upload(finalFileName, file.buffer, {
                contentType: file.mimetype,
                upsert: true,
            });

        if (error) {
            console.error("❌ Supabase Upload Error:", error);
            return res.status(400).json({ message: "Failed to upload to Supabase", details: error.message });
        }

        const filePath = data?.path;
        const publicUrlResponse = supabase.storage.from(bucket).getPublicUrl(filePath);
        const publicURL = publicUrlResponse?.data?.publicUrl;

        if (!publicURL) {
            console.error("❌ Failed to retrieve public URL");
            return res.status(400).json({ message: "Failed to retrieve public URL" });
        }

        console.log("🚀 Public URL:", publicURL);
        req.uploadedImageUrl = publicURL;
        next();
    } catch (error) {
        console.error("❌ Unexpected Error:", error);
        res.status(500).json({ message: "Internal Server Error", details: error.message });
    }
};

export { upload };
