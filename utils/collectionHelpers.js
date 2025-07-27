import { supabase } from '../config/supabaseClient.js';

// Helper: Transform collection data to include items count and remove items array
export const transformCollectionData = (data, includeThumbnail = false) => {
    if (!data || !Array.isArray(data)) {
        return [];
    }
    return data.map(collection => ({
        ...collection,
        itemsLength: collection.items ? collection.items.length : 0,
        thumbnail: includeThumbnail ? null : undefined, // Placeholder for thumbnail, will be populated async if needed
        items: undefined // Remove items array to keep response lean
    }));
};

// Helper: Transform collection data with thumbnails (async version)
export const transformCollectionDataWithThumbnails = async (data) => {
    if (!data || !Array.isArray(data)) {
        return [];
    }

    const transformedData = await Promise.all(data.map(async (collection) => {
        const thumbnail = await getCollectionThumbnail(collection);
        return {
            ...collection,
            itemsLength: collection.items ? collection.items.length : 0,
            thumbnail,
            items: undefined // Remove items array to keep response lean
        };
    }));

    return transformedData;
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

// Helper: Get collections with items count
export const getCollectionsWithItemsCount = async (query, selectFields = 'category, author, author_public_id, slug, created_at, items, tags', includeThumbnails = false) => {
    // First get collections with items for counting
    const { data, error } = await query.select(selectFields);

    if (error) {
        return { data: null, error };
    }

    if (!data) {
        return { data: [], error: null };
    }

    // Transform data to include items count and optionally thumbnails
    let transformedData;
    if (includeThumbnails) {
        transformedData = await transformCollectionDataWithThumbnails(data);
    } else {
        transformedData = transformCollectionData(data);
    }

    return { data: transformedData, error: null };
};

// Helper: Get collection thumbnail with fallback logic
export const getCollectionThumbnail = async (collection) => {
    if (!collection || !collection.author || !collection.category) {
        return null;
    }

    // sterilize author and category names to ensure they are safe for use in paths
    const sanitizeName = (name) => {
        return name.replace(/[^a-zA-Z0-9-_]/g, '_');
    };

    // Try sanitized path first
    const sanitizedPath = sanitizeName(`${collection.author}/${collection.category}`) + "/thumbnail.jpg";
    const unsanitizedPath = `${collection.author}/${collection.category}/thumbnail.jpg`;

    for (const thumbnailPath of [sanitizedPath, unsanitizedPath]) {
        console.log(`Checking thumbnail path: ${thumbnailPath}`);
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

    // Fallback: try to get the first item's image
    if (collection.items && Array.isArray(collection.items) && collection.items.length > 0) {
        const firstItem = collection.items[0];
        if (firstItem && firstItem.image) {
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

    const collectionsWithThumbnails = await Promise.all(collections.map(async (collection) => {
        const thumbnail = await getCollectionThumbnail(collection);
        return {
            ...collection,
            thumbnail
        };
    }));

    return collectionsWithThumbnails;
};
