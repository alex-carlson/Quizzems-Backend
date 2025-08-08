// download_from_storage_recursive.js
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const downloadDir = './downloaded_files';

async function ensureDirExists(localPath) {
    const dir = path.dirname(localPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

async function downloadFile(bucket, filePath) {
    // Remove any '/revision/latest' or query params if present:
    const cleanFilePath = filePath.replace(/\/revision\/latest$/, '').split('?')[0];

    const { data, error } = await supabase.storage.from(bucket).download(cleanFilePath);

    if (error) {
        console.error(`❌ Failed to download ${cleanFilePath}:`, JSON.stringify(error));
        return;
    }

    if (!data || typeof data.getReader !== 'function') {
        console.error(`❌ Invalid data stream for ${cleanFilePath}`);
        return;
    }

    const outputPath = path.join(downloadDir, cleanFilePath);
    await ensureDirExists(outputPath);

    const fileStream = fs.createWriteStream(outputPath);
    const reader = data.getReader();

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fileStream.write(value);
    }
    fileStream.end();

    console.log(`✅ Downloaded ${cleanFilePath}`);
}



async function listAndDownloadRecursive(bucket, prefix = '') {
    const { data: items, error } = await supabase.storage.from(bucket).list(prefix, {
        limit: 1000,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' },
    });

    if (error) {
        console.error(`❌ Failed to list ${prefix}:`, error.message);
        return;
    }

    for (const item of items) {
        const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
        if (item.metadata) {
            // It's a file
            await downloadFile(bucket, fullPath);
        } else {
            // It's a folder
            await listAndDownloadRecursive(bucket, fullPath);
        }
    }
}

async function downloadAllFiles() {
    const bucket = process.env.SUPABASE_BUCKET;

    if (!fs.existsSync(downloadDir)) {
        fs.mkdirSync(downloadDir);
    }

    await listAndDownloadRecursive(bucket);
}

downloadAllFiles();
