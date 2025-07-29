import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import slugify from 'slugify';
import axios from 'axios';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'auto',
    endpoint: process.env.AWS_S3_ENDPOINT,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});
const s3Bucket = process.env.AWS_S3_BUCKET;

async function listAllFiles(prefix = '') {
    let allFiles = [];
    const { data, error } = await supabase.storage.from('uploads').list(prefix, { limit: 1000 });
    if (error) throw error;
    const files = data.filter(entry => entry.metadata); // files have metadata
    const folders = data.filter(entry => !entry.metadata); // folders do not
    console.log(`Searching folder '${prefix || '/'}': ${files.length} files, ${folders.length} folders`);
    for (const file of files) {
        allFiles.push(prefix ? `${prefix}/${file.name}` : file.name);
    }
    for (const folder of folders) {
        const subFiles = await listAllFiles(folder.id);
        allFiles = allFiles.concat(subFiles);
    }
    return allFiles;
}

async function migrateThumbnails() {
    // Recursively list all files in Supabase 'uploads' bucket
    const allFiles = await listAllFiles('');
    const thumbnailFiles = allFiles.filter(f => f.endsWith('thumbnail.jpg'));
    console.log(`Found ${thumbnailFiles.length} thumbnail files in Supabase storage.`);
    for (const fileName of thumbnailFiles) {
        // Get parent folder name
        const parts = fileName.split('/');
        if (parts.length < 2) continue;
        const parentFolder = parts[parts.length - 2];
        const slug = slugify(parentFolder, { lower: true, strict: true });
        const ext = fileName.split('.').pop();
        // Download from Supabase
        const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(fileName);
        const fileUrl = urlData.publicUrl;
        const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);
        // Upload to R2
        const r2Key = `thumbnails/${slug}/thumbnail.${ext}`;
        const command = new PutObjectCommand({
            Bucket: s3Bucket,
            Key: r2Key,
            Body: buffer,
            ContentType: response.headers['content-type'] || 'image/jpeg',
            ACL: 'public-read',
        });
        await s3Client.send(command);
        console.log(`✅ Migrated ${fileName} to R2: ${r2Key}`);
    }
}

migrateThumbnails().catch(console.error);
