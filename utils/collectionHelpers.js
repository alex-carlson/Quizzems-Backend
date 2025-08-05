import { supabase } from '../config/supabaseClient.js';

// Helper: Transform collection data to include items count and remove items array
function baseTransformCollection(collection, includeThumbnail) {
    return {
        ...collection,
        itemsLength: collection.items ? collection.items.length : 0,
        thumbnail: includeThumbnail ? null : undefined, // Placeholder for thumbnail, will be populated async if needed
        items: undefined // Remove items array to keep response lean
    };
}

export const transformCollectionData = (data, includeThumbnail = false) => {
    if (!data || !Array.isArray(data)) {
        return [];
    }
    return data.map(collection => baseTransformCollection(collection, includeThumbnail));
};

// Helper: Transform collection data with thumbnails (async version)
export const transformCollectionDataWithThumbnails = async (data) => {
    if (!data || !Array.isArray(data)) {
        return [];
    }
    return Promise.all(data.map(async (collection) => {
        const thumbnail = await getCollectionThumbnail(collection);
        return {
            ...baseTransformCollection(collection, false),
            thumbnail,
        };
    }));
};

// Helper: Filter collections by search term in title (category) or tags
export const filterCollections = (collections, filter) => {
    if (!collections || !Array.isArray(collections)) {
        return [];
    }

    if (!filter || filter.trim() === '') {
        return collections;
    }

    const searchTerm = filter.toLowerCase().trim();

    const filtered = collections.filter(collection => {
        if (!collection) {
            return false;
        }

        // Check if search term is CONTAINED in category (title)
        const titleMatch = collection.category &&
            typeof collection.category === 'string' &&
            collection.category.toLowerCase().includes(searchTerm);

        // Check if search term is CONTAINED in any of the tags
        const tagsMatch = collection.tags &&
            Array.isArray(collection.tags) &&
            collection.tags.some(tag =>
                tag && typeof tag === 'string' && tag.toLowerCase().includes(searchTerm)
            );

        const matches = titleMatch || tagsMatch;

        return matches;
    });

    return filtered;
};

// Helper: Get collection thumbnail with fallback logic
export const getCollectionThumbnail = async (collection) => {
    if (!collection || !collection.profiles.username || !collection.category) {
        return null;
    }

    // sterilize author and category names to ensure they are safe for use in paths
    const sanitizeName = (name) => {
        return name.replace(/[^a-zA-Z0-9-_]/g, '_');
    };

    // Try sanitized path first
    const sanitizedPath = sanitizeName(`${collection.profiles.username}/${collection.category}`) + "/thumbnail.jpg";
    const unsanitizedPath = `${collection.profiles.username}/${collection.category}/thumbnail.jpg`;

    const s3Path = process.env.AWS_S3_PUBLIC_URL || process.env.S3_PUBLIC_URL || process.env.S3_ENDPOINT;

    if (!s3Path) {
        console.error("S3 public URL is not configured.");
        return null;
    }

    // First, try to get thumbnail_url directly from the collection (from Supabase 'collections' table)
    if (collection.thumbnail_url && typeof collection.thumbnail_url === 'string') {
        // Validate if the thumbnail actually exists by making a HEAD request
        try {
            const response = await fetch(collection.thumbnail_url, { method: 'HEAD' });
            if (response.ok) {
                return collection.thumbnail_url;
            }
        } catch (fetchError) {
            console.log(`Thumbnail validation failed for collection.thumbnail_url:`, fetchError.message);
        }
    }

    for (const thumbnailPath of [sanitizedPath, unsanitizedPath]) {
        try {
            // Get the public URL for the thumbnail
            const { data: thumbnailData } = supabase.storage
                .from('uploads')
                .getPublicUrl(thumbnailPath);

            if (thumbnailData?.publicUrl) {
                // Validate if the thumbnail actually exists by making a HEAD request
                try {
                    const response = await fetch(thumbnailData.publicUrl, { method: 'HEAD' });
                    if (response.ok) {
                        // apply thumbnailData.publicUrl to collection.thumbnail_url
                        // use supabase to upload the thumbnail if it doesn't exist
                        if (!collection.thumbnail_url) {
                            console.log(`Updating collection ${collection.id} with thumbnail_url: ${thumbnailData.publicUrl}`);
                            const { error } = await supabase
                                .from('collections')
                                .update({ thumbnail_url: thumbnailData.publicUrl })
                                .eq('id', collection.id);

                            if (error) {
                                console.error(`Failed to update collection thumbnail_url for ${collection.id}:`, error.message);
                            }
                        }
                        return thumbnailData.publicUrl;
                    }
                } catch (fetchError) {
                    console.log(`Thumbnail validation failed for ${thumbnailPath}:`, fetchError.message);
                }
            }
        } catch (storageError) {
            console.log(`Storage error for thumbnail ${thumbnailPath}:`, storageError.message);
        }
    }

    console.log(`No thumbnail found in storage for collection ${collection.id}. Trying first item image as fallback.`);

    // get items
    const { data, error } = await supabase
        .from('collections')
        .select('id, items')
        .eq('id', collection.id);

    if (error) {
        console.error(`Error fetching items for collection ${collection.id}:`, error.message);
        return null;
    }

    const items = data?.[0]?.items || [];

    console.log(`Found ${items.length} items in collection ${collection.id}.`);
    if (items.length === 0) {
        console.log(`No items found in collection ${collection.id}. Returning null.`);
        return null;
    }

    // Fallback: try to get the first item's image
    if (items && Array.isArray(items) && items.length > 0) {
        const firstItem = items[0];
        if (firstItem && firstItem.image) {
            // upload the firstItem.image as thumbnail_url to supabase table
            if (!collection.thumbnail_url) {
                console.log(`Updating collection ${collection.id} with first item image as thumbnail_url: ${firstItem.image}`);
                const { error } = await supabase
                    .from('collections')
                    .update({ thumbnail_url: firstItem.image })
                    .eq('id', collection.id);

                if (error) {
                    console.error(`Failed to update collection thumbnail_url for ${collection.id}:`, error.message);
                }
            }
            return firstItem.image;
        }
    }

    return null;
};

// Helper: Add thumbnails to existing collection data
export const addThumbnailsToCollections = async (collections) => {
    if (!collections || !Array.isArray(collections)) {
        return collections;
    }
    return Promise.all(collections.map(async (collection) => {
        const thumbnail = await getCollectionThumbnail(collection);
        return {
            ...collection,
            thumbnail
        };
    }));
};
