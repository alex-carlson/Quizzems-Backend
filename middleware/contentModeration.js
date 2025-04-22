//import axios
import axios from "axios";

export const contentModeration = async (req, res, next) => {
    console.log("🚀 Content Moderation Middleware Triggered");
    try {
        console.log(req);

        // store req.uploadedImageUrl
        const uploadedImageUrl = req.uploadedImageUrl || req.body.uploadedImageUrl;
        console.log("🚀 Uploaded Image URL:", uploadedImageUrl);

        if (!uploadedImageUrl) {
            return res.status(400).json({ message: "No image URL provided." });
        }

        // Simulate content moderation check
        const isContentSafe = await checkContent(uploadedImageUrl);

        if (!isContentSafe) {
            return res.status(400).json({ message: "Inappropriate content detected." });
        }

        next();
    } catch (error) {
        console.error("❌ Content Moderation Error:", error);
        res.status(500).json({ message: "Internal Server Error", details: error.message });
    }
}

const checkContent = async (imageUrl, filePath, res) => {
    try {
        const { data: result } = await axios.get('https://api.sightengine.com/1.0/check.json', {
            params: {
                models: 'nudity-2.1,offensive-2.0,gore-2.0,self-harm',
                api_user: process.env.SIGHTENGINE_API_USER,
                api_secret: process.env.SIGHTENGINE_API_SECRET,
                url: imageUrl
            }
        });

        // Ensure the result object exists and has the expected structure
        if (!result || result.status !== 'success') {
            console.error("Invalid response from Sightengine API:", result);
            return res.status(400).json({ message: 'Failed to analyze image content' });
        }

        const certainty = 0.5;

        // Safely access properties using optional chaining (?.) and provide default values
        const isNude = result.nudity?.none < certainty;
        const isOffensive = result.offensive?.nazi > certainty ||
            result.offensive?.asian_swastika > certainty ||
            result.offensive?.confederate > certainty ||
            result.offensive?.supremacist > certainty ||
            result.offensive?.terrorist > certainty;
        const isGore = result.gore?.prob > certainty;
        const isSelfHarm = result["self-harm"]?.prob > certainty;

        console.log("isNude: ", isNude, "isOffensive: ", isOffensive, "isGore: ", isGore, "isSelfHarm: ", isSelfHarm);

        const isSafe = !isNude && !isOffensive && !isGore && !isSelfHarm;

        if (!isSafe) {
            console.error("Image contains inappropriate content:", result);
            return res.status(400).json({ message: 'Image contains illicit content' });
        }
        return true; // Indicate that the image is safe
    } catch (err) {
        console.error("Error during content moderation:", err.response?.data || err.message);
        res.status(500).json({ message: 'Error checking image content', details: err.message });
    }
};