// upload_to_storage.js
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import mime from 'mime';
import 'dotenv/config';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function uploadAllFiles() {
    const bucket = process.env.SUPABASE_BUCKET;

    const uploadDir = './downloaded_files';
    const files = fs.readdirSync(uploadDir);

    for (const file of files) {
        const filePath = path.join(uploadDir, file);
        const fileBuffer = fs.readFileSync(filePath);
        const mimeType = mime.getType(filePath) || 'application/octet-stream';

        const uploadPath = `${file}`;

        const { error } = await supabase.storage.from(bucket).upload(uploadPath, fileBuffer, {
            contentType: mimeType,
            upsert: true,
        });

        if (error) {
            console.error(`❌ Failed to upload ${file}:`, error.message);
        } else {
            console.log(`✅ Uploaded ${file} to ${uploadPath}`);
        }
    }
}

uploadAllFiles();
