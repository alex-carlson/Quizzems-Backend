import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://jplzmvpdppeouismoruv.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwbHptdnBkcHBlb3Vpc21vcnV2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MjgyMDQxOCwiZXhwIjoyMDU4Mzk2NDE4fQ.vZValHhfu-czrMrrSprUqHWPdEFbL5HNmGSec0u90SA"; // Ensure this has storage permissions
const supabase = createClient(supabaseUrl, supabaseKey);

async function moveFiles() {
    const { data, error } = await supabase.storage.from('uploads').list('');

    if (error) {
        console.error('Error listing files:', error);
        return;
    }

    for (const file of data) {
        const match = file.name.match(/^(.+?)-(.+?)-(.+?)\.jpeg$/);
        if (match) {
            const [, username, category_name, image_name] = match;
            const newFilePath = `${username}/${category_name}/${image_name}.jpeg`;

            // Move the file by copying then deleting the original
            const { data: copyData, error: copyError } = await supabase
                .storage
                .from('uploads')
                .copy(file.name, newFilePath);

            if (copyError) {
                console.error(`Error copying ${file.name}:`, copyError);
                continue;
            }

            const { error: deleteError } = await supabase
                .storage
                .from('uploads')
                .remove([file.name]);

            if (deleteError) {
                console.error(`Error deleting ${file.name}:`, deleteError);
            } else {
                console.log(`Moved ${file.name} → ${newFilePath}`);
            }
        }
    }
}

moveFiles();