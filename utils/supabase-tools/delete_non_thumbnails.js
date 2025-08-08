// delete_non_thumbnails.js
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DRY_RUN = process.env.DRY_RUN !== 'false'; // true by default

async function deleteNonThumbnails(bucket, prefix = '') {
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
            if (item.name !== 'thumbnail.jpg') {
                if (DRY_RUN) {
                    console.log(`📝 DRY RUN: Would delete ${fullPath}`);
                } else {
                    console.log(`🗑️ Deleting: ${fullPath}`);
                    const { error: deleteError } = await supabase.storage.from(bucket).remove([fullPath]);

                    if (deleteError) {
                        console.error(`❌ Failed to delete ${fullPath}:`, deleteError.message);
                    } else {
                        console.log(`✅ Deleted ${fullPath}`);
                    }
                }
            } else {
                console.log(`✅ Keeping: ${fullPath}`);
            }
        } else {
            // It's a folder
            await deleteNonThumbnails(bucket, fullPath);
        }
    }
}

async function start() {
    const bucket = process.env.SUPABASE_BUCKET;
    const uploadsPrefix = 'uploads';

    console.log(`🔍 Starting ${DRY_RUN ? 'DRY RUN' : 'LIVE'} deletion process for bucket "${bucket}"`);
    await deleteNonThumbnails(bucket, undefined);
}

start();
