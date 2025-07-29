import { createClient } from '@supabase/supabase-js';
import AWS from 'aws-sdk';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.migrate' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const s3 = new AWS.S3({
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    region: 'auto',
    signatureVersion: 'v4',
});

// Helper: encode path for Supabase download but keep slashes intact
function encodePath(path) {
    return encodeURIComponent(path).replace(/%2F/g, '/');
}

// Recursive migrate function with pagination support
async function migrateFiles(path = '', migrateThumbnailsOnly = false) {
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
        const { data: items, error } = await supabase.storage
            .from(process.env.SUPABASE_BUCKET)
            .list(path, { limit: pageSize, offset: page * pageSize });

        if (error) {
            console.error(`Error listing files at "${path}":`, error);
            return;
        }

        if (!items || items.length === 0) {
            hasMore = false;
            break;
        }

        for (const item of items) {
            if (!item.name || item.name.toLowerCase() === 'undefined') {
                console.warn(`⚠️ Skipping invalid item name: "${item.name}"`);
                continue;
            }

            const fullPath = path ? `${path}/${item.name}` : item.name;
            const isFolder = !item.metadata || item.metadata.mimetype === null;

            if (isFolder) {
                await migrateFiles(fullPath, migrateThumbnailsOnly);
            } else {
                let r2Key = fullPath;
                // If it's a thumbnail, always migrate to /thumbnails/<parent folder name>/thumbnail.jpg
                if (item.name === 'thumbnail.jpg') {
                    // Slugify the relative path (excluding the filename)
                    const slugify = str => str
                        .toString()
                        .normalize('NFKD')
                        .replace(/[\u0300-\u036F]/g, '')
                        .replace(/[^a-zA-Z0-9-_]/g, '_')
                        .replace(/_+/g, '_')
                        .replace(/^_+|_+$/g, '')
                        .toLowerCase();
                    const relativePath = path || '';
                    const slugifiedPath = slugify(relativePath);
                    r2Key = `thumbnails/${slugifiedPath}/thumbnail.jpg`;
                }
                if (migrateThumbnailsOnly && item.name !== 'thumbnail.jpg') {
                    continue;
                }
                try {
                    const { data: fileData, error: downloadError } = await supabase.storage
                        .from(process.env.SUPABASE_BUCKET)
                        .download(fullPath);

                    if (downloadError || !fileData) {
                        console.error(`❌ Failed to download file: ${fullPath}`);
                        continue;
                    }

                    const buffer = await fileData.arrayBuffer();

                    // Try to get content type from Supabase metadata, fallback to image/jpeg for thumbnails
                    let contentType = item.metadata && item.metadata.mimetype ? item.metadata.mimetype : undefined;
                    if (!contentType && item.name === 'thumbnail.jpg') {
                        contentType = 'image/jpeg';
                    }

                    await s3.putObject({
                        Bucket: process.env.R2_BUCKET,
                        Key: r2Key,
                        Body: Buffer.from(buffer),
                        ContentType: contentType,
                    }).promise();

                    console.log(`✅ Migrated file: ${fullPath} -> ${r2Key}`);
                } catch (err) {
                    console.error(`❌ Upload failed for file: ${fullPath}`, err);
                }
            }
        }

        if (items.length < pageSize) {
            hasMore = false;
        } else {
            page++;
        }
    }
}

// Usage: node migrate_supabase_to_r2.js [--thumbnails-only]
const migrateThumbnailsOnly = process.argv.includes('--thumbnails-only');

migrateFiles('', migrateThumbnailsOnly)
    .then(() => {
        console.log('🚀 Migration complete!');
    })
    .catch((err) => {
        console.error('Migration failed:', err);
    });
