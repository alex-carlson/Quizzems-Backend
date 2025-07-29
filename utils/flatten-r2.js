import 'dotenv/config';
import { S3Client, ListObjectsV2Command, CopyObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const bucketName = process.env.R2_BUCKET;
const client = new S3Client({
    endpoint: process.env.AWS_S3_ENDPOINT,
    region: process.env.AWS_REGION || "auto",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

async function flattenR2Bucket() {
    let ContinuationToken;
    do {
        const listResponse = await client.send(new ListObjectsV2Command({
            Bucket: bucketName,
            ContinuationToken,
        }));

        for (const obj of listResponse.Contents || []) {
            const oldKey = obj.Key;
            const fileName = oldKey.split("/").pop(); // get last part

            if (fileName !== oldKey) {
                // Copy to root key
                await client.send(new CopyObjectCommand({
                    Bucket: bucketName,
                    CopySource: `${bucketName}/${oldKey}`,
                    Key: fileName,
                }));

                // Delete old key
                await client.send(new DeleteObjectCommand({
                    Bucket: bucketName,
                    Key: oldKey,
                }));

                console.log(`Moved ${oldKey} to ${fileName}`);
            }
        }

        ContinuationToken = listResponse.IsTruncated ? listResponse.NextContinuationToken : undefined;
    } while (ContinuationToken);
}

flattenR2Bucket().catch(console.error);
