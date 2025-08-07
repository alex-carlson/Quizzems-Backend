import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { createObjectCsvWriter } from 'csv-writer';
//import process env
import dotenv from 'dotenv';
dotenv.config();

// --- CONFIG ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET_NAME = 'backups';
const TABLE_NAME = 'collections';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function exportTableToCSV() {
    const { data, error } = await supabase.from(TABLE_NAME).select('*');

    if (error) {
        console.error('Error fetching table:', error);
        return;
    }

    if (!data || data.length === 0) {
        console.log('No data found in table.');
        return;
    }

    const timestamp = new Date().toISOString().split('T')[0];
    const fileName = `collections-backup-${timestamp}.csv`;

    const csvWriter = createObjectCsvWriter({
        path: fileName,
        header: Object.keys(data[0]).map((key) => ({ id: key, title: key }))
    });

    await csvWriter.writeRecords(data);
    console.log(`CSV file created: ${fileName}`);

    const fileBuffer = fs.readFileSync(fileName);

    const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(`collections/${fileName}`, fileBuffer, {
            contentType: 'text/csv',
            upsert: true
        });

    if (uploadError) {
        console.error('Error uploading to storage:', uploadError);
    } else {
        console.log('Backup uploaded successfully!');
    }

    // Optionally delete the local file
    fs.unlinkSync(fileName);
}

exportTableToCSV();
