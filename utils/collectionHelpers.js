import { supabase } from '../config/supabaseClient.js';

// Helper: Transform collection data to include items count and remove items array
export const transformCollectionData = (data, includeThumbnail = false) => {
    if (!data || !Array.isArray(data)) {
        return [];
    }
    return data.map(collection => ({
        ...collection,
        itemsLength: Array.isArray(collection.questions) ? collection.questions.length : 0,
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
            itemsLength: Array.isArray(collection.questions) ? collection.questions.length : 0,
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
export const getCollectionsWithItemsCount = async (query, selectFields = 'category, author, author_public_id, slug, created_at, questions, tags', includeThumbnails = false) => {
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

    const slugify = str => str
        .toString()
        .normalize('NFKD')
        .replace(/[\u0300-\u036F]/g, '')
        .replace(/[^a-zA-Z0-9-_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '')
        .toLowerCase();
    const slugifiedFolder = slugify(collection.author + "_" + collection.category || 'unknown');
    const r2BaseUrl = process.env.AWS_S3_PUBLIC_URL || '';
    const thumbnailUrl = `${r2BaseUrl}/thumbnails/${slugifiedFolder}/thumbnail.jpg`;

    // Validate if the thumbnail actually exists by making a HEAD request
    try {
        const response = await fetch(thumbnailUrl, { method: 'HEAD' });
        if (response.ok) {
            return thumbnailUrl;
        }
    } catch (fetchError) {
        console.log(`Thumbnail validation failed for ${thumbnailUrl}:`, fetchError.message);
    }

    // Fallback: fetch the first item's prompt from Supabase 'questions' table
    if (collection.questions && Array.isArray(collection.questions) && collection.questions.length > 0) {
        const firstQuestionId = collection.questions[0];
        if (firstQuestionId) {
            const { data: questionData, error } = await supabase
                .from('questions')
                .select('prompt')
                .eq('id', firstQuestionId)
                .single();

            if (!error && questionData && questionData.prompt) {
                return `${questionData.prompt}`;
            }
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
