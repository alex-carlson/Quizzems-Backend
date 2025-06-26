import multer from "multer";
import axios from "axios";
import sharp from "sharp";
import { getSupabaseClientWithToken, supabase } from "../config/supabaseClient.js";

const storage = multer.memoryStorage();
const upload = multer({ storage });

export const uploadUrlToSupabase = async (req, res, next) => {
    try {
        const { folder, uuid, bucket: reqBucket, fileName } = req.body;
        const token = req.headers.authorization?.split(" ")[1];
        const bucket = reqBucket || "uploads";
        const fileUrl = req.body.url;

        if (!token) {
            return res.status(401).json({ message: "No token provided" });
        }

        if (!fileUrl) {
            return res.status(400).json({ message: "Please provide a file URL." });
        }

        // Get extension by finding the last period in the URL
        let fileExtension = "";
        const lastDotIndex = fileUrl.lastIndexOf(".");
        if (lastDotIndex !== -1 && lastDotIndex < fileUrl.length - 1) {
            fileExtension = fileUrl.substring(lastDotIndex + 1).split(/[?#]/)[0];
        }

        let finalFileName = `${uuid}/${fileName}`;
        if (!fileName) {
            finalFileName = `${folder || "uploads"}/${uuid}.${fileExtension}`;
        }

        console.log("🚀 Uploading to Supabase from URL:", {
            folder,
            uuid,
            bucket,
            fileUrl: fileUrl ? fileUrl : "No file URL",
            fileName: finalFileName,
        });

        const fileResponse = await axios.get(fileUrl, { responseType: "arraybuffer" });
        const fileBuffer = Buffer.from(fileResponse.data, "binary");
        const contentType = fileResponse.headers["content-type"] || "application/octet-stream";

        const { data, error } = await getSupabaseClientWithToken(token).storage
            .from(bucket)
            .upload(finalFileName, fileBuffer, {
                contentType,
                upsert: true,
            });


        if (error) {
            console.error("❌ Supabase Upload Error:", error);
            return res.status(400).json({
                message: "Failed to upload to Supabase",
                details: error.message,
            });
        }

        // Ensure file path is correct
        const filePath = data?.path;
        // Retrieve Public URL
        const publicUrlResponse = supabase.storage.from(bucket).getPublicUrl(`${filePath}`);
        const publicURL = publicUrlResponse?.data?.publicUrl;
        if (!publicURL) {
            console.error("❌ Failed to retrieve public URL");
            return res.status(400).json({ message: "Failed to retrieve public URL" });
        }

        console.log("🚀 Public URL:", publicURL)
        req.uploadedImageUrl = publicURL;
        next();
    }
    catch (error) {
        console.error("❌ Unexpected Error:", error);
        res.status(500).json({ message: "Internal Server Error", details: error.message });
    }
}

export const UploadToSupabase = async (req, res, next) => {
    try {
        const { folder, uuid, forceJpeg } = req.body;
        const file = req.file !== undefined ? req.file : req.body.file;
        const token = req.headers.authorization?.split(" ")[1];
        const bucket = "uploads";


        if (!token) {
            return res.status(401).json({ message: "No token provided" });
        }

        if (!file) {
            return res.status(400).json({ message: "Please upload an image." });
        }

        console.log("🔄 Processing file:", {
            folder,
            uuid,
            bucket,
            file: file ? file.originalname : "No file",
            forceJpeg: forceJpeg || false,
        });

        let fileExtension = file.originalname.split(".").pop().toLowerCase();

        if (forceJpeg === true) {
            console.log("🔄 Converting image to JPEG format");
            const jpgBuffer = await sharp(file.buffer)
                .jpeg({ quality: 80 })
                .toBuffer();
            fileExtension = "jpg";
            file.buffer = jpgBuffer;
            file.mimetype = "image/jpeg";
            file.originalname = `${file.originalname.split(".")[0]}.${fileExtension}`;
        }

        const finalFileName = `${folder || "uploads"}/${uuid}.${fileExtension}`;

        console.log("🚀 Uploading to Supabase:", {
            folder,
            uuid,
            bucket,
            file: file ? file.originalname : "No file",
            fileName: finalFileName,
        });

        // Upload file to Supabase Storage
        const { data, error } = await getSupabaseClientWithToken(token).storage
            .from(bucket)
            .upload(finalFileName, file.buffer, {
                contentType: file.mimetype,
                upsert: true,
            });

        if (error) {
            console.error("❌ Supabase Upload Error:", error);
            return res.status(400).json({
                message: "Failed to upload to Supabase",
                details: error.message,
            });
        }

        // Ensure file path is correct
        const filePath = data?.path;

        // Retrieve Public URL
        const publicUrlResponse = supabase.storage.from(bucket).getPublicUrl(`${filePath}`);
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
