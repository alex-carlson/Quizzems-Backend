import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import 'dotenv/config';

// Supabase project setup
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key';

const supabase = createClient(supabaseUrl, supabaseKey);

// Set your desired collection ID here
const TARGET_COLLECTION_ID = 187; // Replace with your collection ID

function extractYouTubeId(url) {
    const match = url.match(/(?:\/|v=)([a-zA-Z0-9_-]{11})(?:\?|&|$)/);
    return match ? match[1] : '';
}

async function downloadQuestions() {
    const { data, error } = await supabase
        .from('questions')
        .select('collection_id, prompt, answer, id, type, extra, audio_title, audio_thumbnail')
        .eq('collection_id', TARGET_COLLECTION_ID);

    if (error) {
        console.error('Error downloading questions:', error.message);
        return;
    }

    if (!data || data.length === 0) {
        console.log('No questions found for this collection.');
        return;
    }

    const formatted = data
        .filter(q => q.type === 'audio')
        .map(q => {
            return {
                id: q.id,
                audio: q.prompt,
                title: q.audio_title,
                answer: q.answer,
                thumbnail: `https://i.ytimg.com/vi/${q.prompt}/mqdefault.jpg`
            };
        });

    const textQuestions = data
        .filter(q => q.type === 'text')
        .map(q => {
            return {
                id: q.id,
                question: q.prompt,
                answer: q.answer,
                extra: q.extra || ''
            };
        });

    const outputFile = 'questions.json';
    fs.writeFileSync(outputFile, JSON.stringify(formatted, null, 2));
    console.log(`Downloaded and formatted ${formatted.length} audio questions to ${outputFile}`);
}

downloadQuestions();
