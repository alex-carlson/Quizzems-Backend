import { supabase } from '../config/supabaseClient.js';

// Helper: Transform collection data to include items count and remove items array
function baseTransformCollection(collection, includeThumbnail) {
    return {
        ...collection,
        itemsLength: collection.items ? collection.items.length : 0,
        thumbnail: includeThumbnail ? null : undefined, // placeholder, will populate async if needed
        items: undefined, // remove items array to keep response lean
    };
}

// Batch fetch items for multiple collections
async function fetchItemsForCollections(collections) {
    // Defensive: skip if no collections or no ids
    if (!collections || !Array.isArray(collections) || collections.length === 0) return {};
    const ids = collections.map(c => c.id).filter(Boolean);
    if (ids.length === 0) return {};
    const { data, error } = await supabase
        .from('collections')
        .select('id, items')
        .in('id', ids);

    console.log(`Fetched items for ${ids.length} collections`);

    if (error) {
        console.error('Failed to batch fetch items:', error.message);
        return {};
    }
    if (!data) return {};
    const map = {};
    for (const row of data) {
        map[row.id] = row.items || [];
    }
    return map;
}

// Sanitize function for paths
const sanitizeName = (name) => name.replace(/[^a-zA-Z0-9-_]/g, '_');

// Try multiple thumbnail paths in parallel and return first valid public URL
async function tryThumbnailPaths(collection) {
    // Defensive: support both .profiles.username and .author (legacy)
    const username = collection?.profiles?.username || collection?.author;
    if (!username || !collection.category) return null;

    const sanitizedPath = sanitizeName(`${username}/${collection.category}`) + '/thumbnail.jpg';
    const unsanitizedPath = `${username}/${collection.category}/thumbnail.jpg`;

    const pathsToTry = [sanitizedPath, unsanitizedPath];
    for (const path of pathsToTry) {
        try {
            const { data: thumbnailData } = supabase.storage.from('uploads').getPublicUrl(path);
            if (thumbnailData?.publicUrl) {
                // Optionally: could do a HEAD request here to verify existence
                return thumbnailData.publicUrl;
            }
        } catch (e) {
            // ignore errors
        }
    }
    return null;
}

// Main: Get thumbnail URL for one collection
export async function getCollectionThumbnailFast(collection, itemsForCollection = []) {
    if (!collection) return null;

    console.log("Items in collection:", itemsForCollection.length);

    // 1) If thumbnail_url exists on collection, just use it (skip HEAD validation for speed)
    if (collection.thumbnail_url && typeof collection.thumbnail_url === 'string') {
        return collection.thumbnail_url;
    }

    // 2) Try storage paths sequentially (not parallel, for reliability)
    const thumbnailFromStorage = await tryThumbnailPaths(collection);
    if (thumbnailFromStorage) {
        return thumbnailFromStorage;
    }

    // 3) Fallback: use first item image if exists
    if (Array.isArray(itemsForCollection) && itemsForCollection.length > 0 && itemsForCollection[0].image) {
        return itemsForCollection[0].image;
    }

    // No thumbnail found
    return null;
}

// Transform collections with thumbnails using batch item fetch and parallel thumbnail fetching
export async function transformCollectionsWithThumbnailsFast(collections) {
    if (!collections || !Array.isArray(collections)) return [];

    // Batch fetch items once
    const itemsMap = await fetchItemsForCollections(collections);

    // Process collections in parallel
    const transformed = await Promise.all(
        collections.map(async (collection) => {
            const itemsForCollection = itemsMap[collection.id] || [];
            console.log(`Processing collection ${collection.id} with ${itemsForCollection.length} items`);
            const thumbnail = await getCollectionThumbnailFast(collection, itemsForCollection);
            return {
                ...baseTransformCollection(collection, false),
                thumbnail,
            };
        })
    );

    return transformed;
}

// Simple transformCollectionData (no thumbnails)
export const transformCollectionData = (data, includeThumbnail = false) => {
    if (!data || !Array.isArray(data)) return [];
    return data.map(collection => baseTransformCollection(collection, includeThumbnail));
};

// Filter collections by search term in title (category) or tags
export const filterCollections = (collections, filter) => {
    if (!collections || !Array.isArray(collections)) return [];

    if (!filter || filter.trim() === '') return collections;

    const searchTerm = filter.toLowerCase().trim();

    return collections.filter(collection => {
        if (!collection) return false;

        const titleMatch = collection.category &&
            typeof collection.category === 'string' &&
            collection.category.toLowerCase().includes(searchTerm);

        const tagsMatch = collection.tags &&
            Array.isArray(collection.tags) &&
            collection.tags.some(tag =>
                tag && typeof tag === 'string' && tag.toLowerCase().includes(searchTerm)
            );

        return titleMatch || tagsMatch;
    });
};

// Helper: Add thumbnails to existing collection data
export const addThumbnailsToCollections = async (collections) => {
    if (!collections || !Array.isArray(collections)) {
        return collections;
    }
    // Defensive: skip if empty
    if (collections.length === 0) return collections;
    const transformed = await transformCollectionsWithThumbnailsFast(collections);
    return transformed.map(collection => ({
        ...collection,
        thumbnail: collection.thumbnail || null, // Ensure thumbnail is always present
    }));
};
