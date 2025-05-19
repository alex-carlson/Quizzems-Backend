import multer from "multer";
import {getSupabaseClientWithToken, supabase} from "../config/supabaseClient.js";

const storage = multer.memoryStorage();
const upload = multer({ storage });

export const UploadToSupabase = async (req, res, next) => {
    try {
        const { folder, uuid } = req.body;
        const file = req.file;
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) {
            return res.status(401).json({ message: "No token provided" });
        }

        if (!file) {
            return res.status(400).json({ message: "Please upload an image." });
        }

        const fileExtension = file.originalname.split(".").pop();
        const fileName = `${folder || "uploads"}/${uuid}.${fileExtension}`;

        console.log("🚀 Uploading to Supabase:", fileName);

        // Upload file to Supabase Storage
        const { data, error } = await getSupabaseClientWithToken(token).storage
            .from("uploads")
            .upload(fileName, file.buffer, {
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
        const publicUrlResponse = supabase.storage.from("uploads").getPublicUrl(`${filePath}`);
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
