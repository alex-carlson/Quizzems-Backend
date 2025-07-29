import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const OLD_COLLECTIONS_TABLE = 'collections';
const NEW_COLLECTIONS_TABLE = 'collections_v2';

async function repairMissingFields() {
    // Fetch all collections from new table
    const { data: newCollections, error: newError } = await supabase
        .from(NEW_COLLECTIONS_TABLE)
        .select('*');
    if (newError) {
        console.error('❌ Failed to fetch collections_v2:', newError);
        return;
    }

    for (const col of newCollections) {
        // Find matching old collection by id
        const { data: old, error: oldError } = await supabase
            .from(OLD_COLLECTIONS_TABLE)
            .select('author, last_modified, tags, slug, author_public_id, description, items, private')
            .eq('id', col.id)
            .maybeSingle();
        if (oldError) {
            console.error(`❌ Failed to fetch old collection for id ${col.id}:`, oldError);
            continue;
        }
        if (!old) continue;

        // Prepare update object for missing fields
        const updateObj = {};
        if (!col.author && old.author) updateObj.author = old.author;
        if (!col.last_modified && old.last_modified) updateObj.last_modified = old.last_modified;
        if ((!col.tags || col.tags.length === 0) && old.tags) updateObj.tags = old.tags;
        if (!col.slug && old.slug) updateObj.slug = old.slug;
        if (!col.author_public_id && old.author_public_id) updateObj.author_public_id = old.author_public_id;
        if (!col.description && old.description) updateObj.description = old.description;
        if ((!col.items || col.items.length === 0) && old.items) updateObj.items = old.items;
        // Always update the 'private' field in the new table to match the old one
        if (old.private !== undefined && col.private !== old.private) updateObj.private = old.private;

        if (Object.keys(updateObj).length > 0) {
            const { error: updateError } = await supabase
                .from(NEW_COLLECTIONS_TABLE)
                .update(updateObj)
                .eq('id', col.id);
            if (updateError) {
                console.error(`❌ Failed to update collection_v2 for id ${col.id}:`, updateError);
            } else {
                console.log(`✅ Updated collection_v2 id ${col.id} with missing fields:`, Object.keys(updateObj));
            }
        }
    }
}

repairMissingFields();