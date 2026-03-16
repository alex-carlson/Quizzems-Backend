// Cloudflare R2 and API utilities
import axios from 'axios';

/**
 * Get Cloudflare R2 bucket analytics (requires CLOUDFLARE_TOKEN)
 * This uses the Cloudflare API to get bucket statistics
 */
export async function getR2BucketStats() {
    if (!process.env.CLOUDFLARE_TOKEN) {
        console.warn('CLOUDFLARE_TOKEN not configured - bucket stats unavailable');
        return null;
    }

    try {
        const accountId = process.env.AWS_ACCOUNT_ID;
        if (!accountId) {
            console.warn('AWS_ACCOUNT_ID not configured - cannot fetch R2 stats');
            return null;
        }

        const response = await axios.get(
            `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets`,
            {
                headers: {
                    'Authorization': `Bearer ${process.env.CLOUDFLARE_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return response.data;
    } catch (error) {
        console.error('Error fetching R2 bucket stats:', error.response?.data || error.message);
        return null;
    }
}

/**
 * Purge Cloudflare cache for specific files (if using CF as CDN)
 */
export async function purgeCloudflareCache(urls) {
    if (!process.env.CLOUDFLARE_TOKEN) {
        console.warn('CLOUDFLARE_TOKEN not configured - cache purge unavailable');
        return false;
    }

    try {
        // This would require zone ID if using Cloudflare as CDN
        // For R2 direct access, cache purging isn't typically needed
        console.log('Cache purge requested for URLs:', urls);
        // Implementation would depend on your specific Cloudflare setup
        return true;
    } catch (error) {
        console.error('Error purging Cloudflare cache:', error.message);
        return false;
    }
}

/**
 * Validate R2 configuration
 */
export function validateR2Config() {
    const requiredVars = [
        'AWS_ACCESS_KEY_ID',
        'AWS_SECRET_ACCESS_KEY',
        'AWS_S3_ENDPOINT',
        'AWS_S3_BUCKET',
        'AWS_S3_PUBLIC_URL'
    ];

    const missing = requiredVars.filter(varName => !process.env[varName]);

    if (missing.length > 0) {
        console.error('❌ Missing required R2 configuration:', missing);
        return false;
    }

    console.log('✅ R2 configuration validated successfully');
    console.log('📊 R2 Configuration:', {
        endpoint: process.env.AWS_S3_ENDPOINT,
        bucket: process.env.AWS_S3_BUCKET,
        publicUrl: process.env.AWS_S3_PUBLIC_URL,
        hasCloudflareToken: !!process.env.CLOUDFLARE_TOKEN
    });

    return true;
}

/**
 * Get R2 storage usage information
 */
export function getR2StorageInfo() {
    return {
        provider: 'Cloudflare R2',
        bucket: process.env.AWS_S3_BUCKET,
        endpoint: process.env.AWS_S3_ENDPOINT,
        publicUrl: process.env.AWS_S3_PUBLIC_URL,
        region: process.env.AWS_REGION || 'auto',
        apiTokenConfigured: !!process.env.CLOUDFLARE_TOKEN,
        features: [
            'S3-compatible API',
            'Zero egress fees',
            'Global distribution',
            'High performance'
        ]
    };
}