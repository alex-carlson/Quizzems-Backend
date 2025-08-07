import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// Utility to sleep between batches (optional for rate limiting)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Chunk an array into batches of N
function chunkArray(array, size) {
    const result = [];
    for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size));
    }
    return result;
}

async function checkUrl(item, collectionId) {
    const url = item.image;
    if (!url) return null;

    try {
        const response = await fetch(url, { method: 'HEAD' });
        if (!response.ok) {
            return {
                collectionId,
                imageUrl: url,
                status: response.status,
                statusText: response.statusText,
            };
        }
    } catch (err) {
        return {
            collectionId,
            imageUrl: url,
            status: 'Error',
            statusText: err.message,
        };
    }

    return null;
}

async function checkImages() {
    const { data: collections, error } = await supabase.from('collections').select('id, items');

    if (error) throw error;

    const brokenImages = [];
    let totalChecked = 0;
    const concurrentLimit = 5;

    const allItems = [];

    for (const collection of collections) {
        if (!Array.isArray(collection.items)) continue;
        for (const item of collection.items) {
            allItems.push({ item, collectionId: collection.id });
        }
    }

    const chunks = chunkArray(allItems, concurrentLimit);

    for (const chunk of chunks) {
        const results = await Promise.allSettled(
            chunk.map(({ item, collectionId }) => checkUrl(item, collectionId))
        );

        for (const result of results) {
            totalChecked++;
            if (result.status === 'fulfilled' && result.value) {
                brokenImages.push(result.value);
            }

            if (totalChecked % 50 === 0) {
                console.log(`✅ Checked ${totalChecked} images...`);
            }
        }

        // Optional: add slight delay to avoid rate limiting
        // await sleep(100);
    }

    console.log(`🔍 Finished checking ${totalChecked} images.`);

    if (brokenImages.length === 0) {
        console.log('✅ All images are accessible.');
    } else {
        console.log(`❌ Found ${brokenImages.length} broken or missing images:`);
        console.table(brokenImages);
    }
}

checkImages();
