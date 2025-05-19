import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLIC_ANON_KEY);

// Middleware function
const uploadBase64ToSupabase = async (req, res, next) => {
    try {
        const { base64Image, folder } = req.body;

        console.log("uploading image to supabase");

        if (!base64Image) {
            return res.status(400).json({ error: 'Base64 image is required' });
        }

        // Extract MIME type and Base64 data
        const matches = base64Image.match(/^data:(.+);base64,(.+)$/);
        if (!matches) {
            return res.status(400).json({ error: 'Invalid Base64 format' });
        }

        const mimeType = matches[1]; // e.g., "image/png"
        const imageBuffer = Buffer.from(matches[2], 'base64');
        const fileExtension = mimeType.split('/')[1]; // e.g., "png"

        // Generate unique file name
        const fileName = `${folder || 'uploads'}/${Date.now()}.${fileExtension}`;

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
            .from('uploads') // Change to your Supabase Storage bucket name
            .upload(fileName, imageBuffer, {
                contentType: mimeType,
                upsert: true,
            });

        if (error) throw error;

        // Generate public URL
        const { data: publicURL } = supabase.storage.from('uploads').getPublicUrl(fileName);

        req.uploadedImageUrl = publicURL.publicUrl;
        next(); // Proceed to next middleware/controller

    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ error: 'Failed to upload image', details: err.message });
    }
};

export default uploadBase64ToSupabase;
