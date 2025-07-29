import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

// ENV VARS (or hardcode if local testing)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET_NAME = 'your-bucket-name'; // change this
const FOLDER_PATH = ''; // optional: folder inside the bucket

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function isImageBroken(publicURL) {
    try {
        const res = await fetch(publicURL, { method: 'HEAD' });
        if (!res.ok) return true;
        const contentType = res.headers.get('content-type');
        return !contentType?.startsWith('image/');
    } catch (err) {
        return true;
    }
}

async function deleteBrokenImages() {
    const { data: files, error } = await supabase.storage
        .from(BUCKET_NAME)
        .list(FOLDER_PATH, { limit: 1000, offset: 0, sortBy: { column: 'name', order: 'asc' } });

    if (error) {
        console.error('Failed to list files:', error);
        return;
    }

    const brokenFiles = [];

    for (const file of files) {
        if (file.name.endsWith('/')) continue; // Skip folders

        const filePath = FOLDER_PATH ? `${FOLDER_PATH}/${file.name}` : file.name;
        const { data: publicURL } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);

        const broken = await isImageBroken(publicURL.publicUrl);
        if (broken) {
            console.log(`Broken: ${filePath}`);
            brokenFiles.push(filePath);
        } else {
            console.log(`OK: ${filePath}`);
        }
    }

    if (brokenFiles.length) {
        const { error: deleteError } = await supabase.storage.from(BUCKET_NAME).remove(brokenFiles);
        if (deleteError) {
            console.error('Error deleting files:', deleteError);
        } else {
            console.log(`Deleted ${brokenFiles.length} broken files.`);
        }
    } else {
        console.log('No broken images found.');
    }
}

deleteBrokenImages();
