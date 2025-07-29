import AWS from 'aws-sdk';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const s3 = new AWS.S3({
    endpoint: process.env.AWS_S3_ENDPOINT,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: 'auto',
    signatureVersion: 'v4',
});

const EXT_TO_TYPE = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml',
};

async function updateContentTypes() {
    try {
        const { Contents } = await s3.listObjectsV2({
            Bucket: process.env.AWS_S3_BUCKET,
            Delimiter: '/',
            Prefix: '',
        }).promise();

        if (!Contents || Contents.length === 0) {
            console.log('No files found in root of bucket.');
            return;
        }

        console.log(`Found ${Contents.length} files in root of bucket.`);

        for (const file of Contents) {
            const key = file.Key;
            if (key.includes('/')) continue; // Only root files
            const ext = key.split('.').pop().toLowerCase();
            const contentType = EXT_TO_TYPE[ext] || 'application/octet-stream';

            console.log(`Checking ${key}...`);

            // Get the file
            const obj = await s3.getObject({
                Bucket: process.env.AWS_S3_BUCKET,
                Key: key,
            }).promise();

            // Re-upload with correct ContentType
            await s3.putObject({
                Bucket: process.env.AWS_S3_BUCKET,
                Key: key,
                Body: obj.Body,
                ContentType: contentType,
            }).promise();

            console.log(`Updated ContentType for ${key} to ${contentType}`);
        }
        console.log('✅ ContentType update complete.');
    } catch (err) {
        console.error('Error updating ContentType:', err);
    }
}

updateContentTypes();
