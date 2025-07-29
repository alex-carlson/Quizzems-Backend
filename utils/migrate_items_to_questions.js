import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);


const OLD_COLLECTIONS_TABLE = 'collections';
const NEW_COLLECTIONS_TABLE = 'collections_v2';
const JSON_FIELD = 'items';

async function migrateAll() {
    // Fetch all collections with embedded question data
    const { data: oldCollections, error: fetchError } = await supabase
        .from(OLD_COLLECTIONS_TABLE)
        .select(`id, category, author_uuid, ${JSON_FIELD}`);

    if (fetchError) {
        console.error('❌ Failed to fetch collections:', fetchError);
        return;
    }

    console.log(`Found ${oldCollections.length} collections to migrate.`);

    for (const old of oldCollections) {
        const rawItems = old[JSON_FIELD];
        if (!Array.isArray(rawItems) || rawItems.length === 0) {
            console.log(`⚠️  Skipping "${old.category}" – no valid items`);
            continue;
        }

        // Insert each item as a question, collect new question UUIDs
        const newQuestions = rawItems.map((q) => {
            const type = detectType(q);
            const prompt = normalizePrompt(q, type);
            let extra = q.extra ?? null;
            const questionObj = {
                collection_id: old.id,
                type,
                prompt,
                answer: q.answer?.trim() || '',
                extra,
                author_id: old.author_uuid || null
            };
            if (type === 'audio') {
                questionObj.audio_title = q.title || '';
                questionObj.audio_thumbnail = q.thumbnail || '';
            }
            return questionObj;
        });

        const { data: insertedQuestions, error: insertQsError } = await supabase
            .from('questions')
            .insert(newQuestions)
            .select();

        if (insertQsError) {
            console.error(`❌ Failed to insert questions for "${old.category}":`, insertQsError);
            continue;
        }

        // Build new questions array for collections_v2 (just question UUIDs)
        const questionUUIDs = insertedQuestions.map(q => q.id);

        // Check if the collection already exists in collections_v2
        const { data: existingCol, error: checkError } = await supabase
            .from(NEW_COLLECTIONS_TABLE)
            .select('id')
            .eq('id', old.id)
            .maybeSingle();

        if (checkError) {
            console.error(`❌ Failed to check collections_v2 for "${old.category}":`, checkError);
            continue;
        }

        if (existingCol) {
            // Update existing row
            const { error: updateColError } = await supabase
                .from(NEW_COLLECTIONS_TABLE)
                .update({ questions: questionUUIDs })
                .eq('id', old.id);
            if (updateColError) {
                console.error(`❌ Failed to update collections_v2 for "${old.category}":`, updateColError);
            } else {
                console.log(`✅ Updated "${old.category}" (${questionUUIDs.length} questions)`);
            }
        } else {
            // Insert new row
            const { error: insertColError } = await supabase
                .from(NEW_COLLECTIONS_TABLE)
                .insert({
                    id: old.id,
                    category: old.category,
                    author_uuid: old.author_uuid,
                    questions: questionUUIDs
                });
            if (insertColError) {
                console.error(`❌ Failed to insert into collections_v2 for "${old.category}":`, insertColError);
            } else {
                console.log(`✅ Inserted new collection "${old.category}" (${questionUUIDs.length} questions)`);
            }
        }
    }
}

function detectType(q) {
    if (q.image) return 'image';
    if (q.audio) return 'audio';
    if (q.question) return 'text';
    return 'text';
}

function normalizePrompt(q, type) {
    if (type === 'image') q.image
    if (type === 'text') return q.question || '';
    if (type === 'audio') return q.audio || '';
    return (q.prompt || q.image || '').trim();
}

function normalizePath(url) {
    const match = url?.match(/storage\/v1\/object\/public\/[^/]+\/(.+)/);
    return match ? match[1].split('/').pop() : url;
}

migrateAll();
