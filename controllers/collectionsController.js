import { supabase, getSupabaseClientWithToken } from '../config/supabaseClient.js';
import slugify from 'slugify';
import {
    transformCollectionData,
    transformCollectionDataWithThumbnails,
    filterCollections,
    getCollectionsWithItemsCount,
    getCollectionThumbnail,
    addThumbnailsToCollections
} from '../utils/collectionHelpers.js';

export const getAllCollections = async (req, res) => {
    try {
        const selection = 'category, author, author_public_id, slug, created_at, questions, tags';
        const query = supabase
            .from('collections_v2')
            .select(selection)
            .eq('private', false);

        const { data, error } = await getCollectionsWithItemsCount(query, selection, true);

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getPopularTags = async (req, res) => {
    try {
        const { limit = 20 } = req.query;
        const { data, error } = await supabase
            .from('collections_v2')
            .select('tags')
            .eq('private', false);

        if (error) {
            console.error('Error fetching tags:', error);
            return res.status(500).json({ error: error.message });
        }
        if (!data || data.length === 0) {
            return res.status(404).json({ error: 'No collections found' });
        }

        const tagCounts = {};

        data.forEach(collection => {
            let tags = collection.tags;

            // Handle tags as a comma-separated string
            if (typeof tags === 'string') {
                tags = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
            }

            if (Array.isArray(tags)) {
                tags.forEach(tag => {
                    if (typeof tag === 'string' && tag.trim()) {
                        const normalized = tag.trim().toLowerCase();
                        tagCounts[normalized] = (tagCounts[normalized] || 0) + 1;
                    }
                });
            }
        });

        // Convert tagCounts object to array of { tag, count }
        const sortedTags = Object.entries(tagCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([tag, count]) => ({ tag, count }));

        const limitedTags = sortedTags.slice(0, limit);

        res.json(limitedTags);
    } catch (err) {
        console.error('Error in getPopularTags:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};


export const getLatestCollections = async (req, res) => {
    try {
        const max = req.limit || 12;

        const selection = 'id, category, author, author_public_id, slug, created_at, questions, items';

        const query = supabase
            .from('collections_v2')
            .select(selection)
            .eq('private', false)
            .order('created_at', { ascending: false })
            .limit(max);

        const { data, error } = await getCollectionsWithItemsCount(query, selection, true);

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getMostPopularCollections = async (req, res) => {
    try {
        const max = req.limit || 12;
        const selection = 'id, category, author, author_public_id, slug, created_at, questions, times_played, tags';
        const query = supabase
            .from('collections_v2')
            .select(selection)
            .eq('private', false)
            .order('times_played', { ascending: false, nullsFirst: false })
            .limit(max);
        const { data, error } = await getCollectionsWithItemsCount(query, selection, true);
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        res.json(data);
    } catch (err) {
        console.error('Error in getMostPopularCollections:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getLatestCollectionsWithThumbnails = async (req, res) => {
    try {
        const max = req.params.limit || 12;

        const selection = 'id, category, author, author_public_id, slug, created_at, questions, tags';

        const query = supabase
            .from('collections_v2')
            .select(selection)
            .eq('private', false)
            .order('created_at', { ascending: false })
            .limit(max);

        const { data, error } = await getCollectionsWithItemsCount(query, selection, true);

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json(data);
    } catch (err) {
        console.error('Error in getLatestCollectionsWithThumbnails:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};


export const getRandomCollections = async (req, res) => {
    try {
        const { limit } = req.params;
        // If no limit is provided, default to 10
        if (!limit || isNaN(limit) || limit <= 0) {
            limit = 10;
        }
        const max = parseInt(limit, 10);
        const selection = 'id, category, author, author_public_id, slug, created_at, questions, tags';

        // Get all public collections with thumbnails
        const query = supabase
            .from('collections_v2')
            .select(selection)
            .eq('private', false);

        const { data, error } = await getCollectionsWithItemsCount(query, selection, true);

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        // Shuffle the data array
        const shuffledData = data.sort(() => 0.5 - Math.random());
        // Slice the first max items
        const randomCollections = shuffledData.slice(0, max);
        res.json(randomCollections);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getDailyCollection = async (req, res) => {
    try {
        // Use the current day as a seed
        const today = new Date();
        const seed = today.getUTCFullYear() + '-' + (today.getUTCMonth() + 1) + '-' + today.getUTCDate();

        // Get all public collection IDs and created_at
        const { data: idData, error: idError } = await supabase
            .from('collections_v2')
            .select('id,created_at')
            .eq('private', false);
        if (idError) {
            return res.status(500).json({ error: idError.message });
        }
        if (!idData || idData.length === 0) {
            return res.status(404).json({ error: 'No collections found' });
        }

        // Sort by id for absolute stability
        idData.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

        // Hash function: FNV-1a 32bit
        function hash(str) {
            let h = 2166136261 >>> 0;
            for (let i = 0; i < str.length; i++) {
                h ^= str.charCodeAt(i);
                h = Math.imul(h, 16777619);
            }
            return h >>> 0;
        }

        // Pick the collection with the highest hash(seed+id)
        let maxHash = -1;
        let chosenId = idData[0].id;
        for (const col of idData) {
            const h = hash(seed + ':' + col.id);
            if (h > maxHash) {
                maxHash = h;
                chosenId = col.id;
            }
        }

        // Fetch the chosen collection by ID
        const selection = 'id, category, author, author_public_id, slug, created_at, questions, tags';
        const query = supabase
            .from('collections_v2')
            .select(selection)
            .eq('id', chosenId)
            .eq('private', false);
        const { data, error } = await getCollectionsWithItemsCount(query, selection, true);

        if (error || !data || !data.length) {
            return res.status(404).json({ error: 'No collections found' });
        }

        // Only one collection is returned
        res.json(data[0]);
    } catch (err) {
        console.error('Error in getDailyCollection:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getPaginatedCollections = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.params;
        const { sortMode = "date", sortOrder = "desc", filter = "" } = req.body;
        let pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);

        // Handle page 0 by treating it as page 1
        if (pageNum <= 0) {
            pageNum = 1;
        }

        const offset = (pageNum - 1) * limitNum;

        // Map sortMode to actual column names
        const sortColumnMap = {
            "name": "category",
            "date": "created_at",
            "size": "items"
        };

        const sortColumn = sortColumnMap[sortMode] || "created_at";
        const ascending = sortOrder === "asc";

        // Get total count
        const { count: totalCount, error: countError } = await supabase
            .from('collections_v2')
            .select('*', { count: 'exact', head: true })
            .eq('private', false);

        if (countError) {
            return res.status(500).json({ error: countError.message });
        }        // Special handling for size sorting (items array length)
        const selection = 'id, category, author, author_public_id, slug, created_at, questions, tags';
        if (sortMode === "size") {
            // For size sorting, we need to get all data and sort in JavaScript
            // since we can't sort by array length directly in Supabase
            const allQuery = supabase
                .from('collections_v2')
                .select(selection)
                .eq('private', false);

            const { data: allData, error: allError } = await getCollectionsWithItemsCount(allQuery, selection, true);
            if (allError) {
                return res.status(500).json({ error: allError.message });
            }

            // Apply filter if provided
            let filteredData = allData;
            if (filter) {
                filteredData = filterCollections(allData, filter);
            }

            // Sort by items count (already calculated by helper)
            const sortedData = filteredData.sort((a, b) => {
                const aSize = a.itemsLength || 0;
                const bSize = b.itemsLength || 0;
                return ascending ? aSize - bSize : bSize - aSize;
            });

            // Apply pagination
            const paginatedData = sortedData.slice(offset, offset + limitNum);

            // Update total count for filtered results
            const filteredTotalCount = filteredData.length;
            const totalPages = Math.ceil(filteredTotalCount / limitNum);

            return res.json({
                collections: paginatedData,
                totalCount: filteredTotalCount,
                totalPages,
                currentPage: pageNum,
                limit: limitNum,
                sortMode,
                sortOrder,
                filter: filter || null
            });
        } else {
            // For name and date sorting, use database sorting with items count
            if (filter) {
                // If filtering is needed, get all data first, then filter and paginate

                const allQuery = supabase
                    .from('collections_v2')
                    .select(selection)
                    .eq('private', false);

                const { data: allData, error: allError } = await getCollectionsWithItemsCount(allQuery, selection, true);

                if (allError) {
                    console.error('Error fetching all collections for filtering:', allError);
                    return res.status(500).json({ error: allError.message });
                }

                if (!allData) {
                    return res.json({
                        collections: [],
                        totalCount: 0,
                        totalPages: 0,
                        currentPage: pageNum,
                        limit: limitNum,
                        sortMode,
                        sortOrder,
                        filter: filter || null
                    });
                }

                // Apply filter
                const filteredData = filterCollections(allData, filter);

                if (!filteredData) {
                    console.error('filterCollections returned null/undefined');
                    return res.status(500).json({ error: 'Filter operation failed' });
                }

                // Sort the filtered data
                const sortedData = filteredData.sort((a, b) => {
                    const aValue = a[sortColumn] || '';
                    const bValue = b[sortColumn] || '';

                    if (typeof aValue === 'string' && typeof bValue === 'string') {
                        return ascending ?
                            aValue.localeCompare(bValue) :
                            bValue.localeCompare(aValue);
                    }

                    // For dates and other comparable types
                    if (ascending) {
                        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
                    } else {
                        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
                    }
                });

                // Apply pagination
                const paginatedData = sortedData.slice(offset, offset + limitNum);

                const filteredTotalCount = filteredData.length;
                const totalPages = Math.ceil(filteredTotalCount / limitNum);

                res.json({
                    collections: paginatedData,
                    totalCount: filteredTotalCount,
                    totalPages,
                    currentPage: pageNum,
                    limit: limitNum,
                    sortMode,
                    sortOrder,
                    filter: filter || null
                });
            } else {
                // No filtering needed, use efficient database sorting
                let query = supabase
                    .from('collections_v2')
                    .select(selection)
                    .eq('private', false)
                    .order(sortColumn, { ascending })
                    .range(offset, offset + limitNum - 1);

                const { data, error } = await getCollectionsWithItemsCount(query, selection, true);

                if (error) {
                    console.error('Database query error:', error);
                    return res.status(500).json({ error: error.message });
                }

                const totalPages = Math.ceil(totalCount / limitNum);
                res.json({
                    collections: data,
                    totalCount,
                    totalPages,
                    currentPage: pageNum,
                    limit: limitNum,
                    sortMode,
                    sortOrder,
                    filter: null
                });
            }
        }
    } catch (err) {
        console.error('Error in getPaginatedCollections:', err);
        console.error('Stack trace:', err.stack);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const searchCollections = async (req, res) => {
    try {
        const { searchTerm } = req.query;

        const selection = 'id, category, author, author_public_id, slug, created_at, questions, tags';

        // Step 1: Get matching results with thumbnails
        const matchingQuery = supabase
            .from('collections_v2')
            .select(selection)
            .eq('private', false)
            .or(`category.ilike.%${searchTerm}%,tags.ilike.%${searchTerm}%`);

        const { data: matching, error: matchError } = await getCollectionsWithItemsCount(matchingQuery, selection, true);

        if (matchError) {
            console.error('Error fetching matching collections:', matchError);
            return res.status(500).json({ error: matchError.message });
        }

        // If 10 or more results found, return them
        if (matching.length >= 10) {
            return res.json(matching.slice(0, 10));
        }

        // Step 2: Fetch additional non-matching results to fill to 10
        const excludeIds = matching.map(item => item.id); // assume you have `id` field

        const fillerQuery = supabase
            .from('collections_v2')
            .select(selection)
            .eq('private', false)
            .not('id', 'in', `(${excludeIds.join(',')})`)
            .limit(10 - matching.length);

        const { data: filler, error: fillerError } = await getCollectionsWithItemsCount(fillerQuery, selection, true);

        if (fillerError) {
            return res.status(500).json({ error: fillerError.message });
        }

        // Combine search results with filler and send
        const combined = [...matching, ...filler];

        res.json(combined);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getCollectionsByTag = async (req, res) => {
    try {
        const { tag } = req.params;
        if (!tag || typeof tag !== 'string' || !tag.trim()) {
            return res.status(400).json({ error: 'Tag parameter is required' });
        }
        const searchTag = tag.trim().toLowerCase();
        const selection = 'id, category, author, author_public_id, slug, created_at, questions, tags';
        // Fetch collections where tags ilike the tag (broad match)
        const query = supabase
            .from('collections_v2')
            .select(selection)
            .eq('private', false)
            .ilike('tags', `%${searchTag}%`);
        const { data, error } = await getCollectionsWithItemsCount(query, selection, true);
        if (error) {
            console.error('Error fetching collections by tag:', error);
            return res.status(500).json({ error: error.message });
        }
        // Filter in JS for exact tag match
        const filtered = (data || []).filter(col => {
            let tags = col.tags;
            if (typeof tags === 'string') {
                tags = tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
            }
            return Array.isArray(tags) && tags.includes(searchTag);
        });
        if (!filtered.length) {
            return res.status(404).json({ error: 'No collections found for this tag' });
        }
        res.json(filtered);
    } catch (err) {
        console.error('Error in getCollectionsByTag:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};


export const getUserCollectionById = async (req, res) => {
    try {
        const { id } = req.params;
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const selection = '*';
        // Ensure id is always a string for comparison
        const idStr = typeof id === 'string' ? id : String(id);
        const { data, error } = await getSupabaseClientWithToken(token)
            .from('collections_v2')
            .select(selection)
            .eq('id', idStr)
            .single();

        if (error) {
            console.error('Supabase error:', error.message);
            return res.status(500).json({ error: error.message });
        }
        if (!data) {
            console.warn('No collection found for id:', idStr);
        }

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        // Add thumbnail to single collection
        const collectionWithThumbnail = await addThumbnailsToCollections([data]);
        res.status(200).json(collectionWithThumbnail[0]);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
export const getUserCollectionId = async (req, res) => {
    try {
        const { uid, slug } = req.params;

        const { data, error } = await supabase
            .from('collections_v2')
            .select('id')
            .eq('author_public_id', uid)
            .eq('slug', slug)
            .single();
        if (error) {
            console.error('Error fetching collection ID:', error);
            return res.status(500).json({ error: error.message });
        }
        if (!data) {
            return res.status(404).json({ error: 'Collection not found' });
        }

        res.status(200).json({ id: data.id });
    } catch (err) {
        console.error('Error in getUserCollectionId:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getUserCollection = async (req, res) => {
    try {
        const { username, collection } = req.params;
        const { data, error } = await supabase.from('collections_v2').select('*').eq('category', collection).eq('author', username).single();

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        // Add thumbnail to single collection
        const collectionWithThumbnail = await addThumbnailsToCollections([data]);
        res.json(collectionWithThumbnail[0]);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getPublicUserCollection = async (req, res) => {
    try {
        const { collectionId } = req.params;
        const table = 'collections_v2';
        const { data, error } = await supabase
            .from(table)
            .select('*')
            .eq('id', collectionId)
            .eq('private', false)
            .single();

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        // increment data.times_played by 1 and update the table
        const { error: updateError } = await supabase
            .from(table)
            .update({ times_played: (data.times_played || 0) + 1 })
            .eq('id', data.id);
        if (updateError) {
            console.error('Error updating times_played:', updateError);
            return res.status(500).json({ error: updateError.message });
        }

        // Add thumbnail to single collection
        const collectionWithThumbnail = await addThumbnailsToCollections([data]);
        res.json(collectionWithThumbnail[0]);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getUserCollections = async (req, res) => {
    try {
        const { uid } = req.params;

        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        console.log('Fetching collections for user:', uid);


        const selection = 'id, category, author, author_public_id, slug, created_at, questions, tags, items';

        const query = supabase
            .from('collections_v2')
            .select(selection)
            .eq('author_public_id', uid)
            .order('created_at', { ascending: false });

        const { data, error } = await getCollectionsWithItemsCount(query, selection, true);

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.status(200).json(data);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getAllUserCollections = async (req, res) => {
    try {
        const { uid } = req.params;
        const { sortBy = 'created_at', sortOrder = 'desc' } = req.query;

        // Validate sort parameters
        const validSortFields = ['created_at', 'category', 'items'];
        const validSortOrders = ['asc', 'desc'];

        const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
        const order = validSortOrders.includes(sortOrder) ? sortOrder : 'desc';
        const ascending = order === 'asc';

        // Use the helper function to get collections with items count and thumbnails
        const selection = 'id, category, author, author_public_id, slug, created_at, questions, tags, private, description';
        const query = supabase
            .from('collections_v2')
            .select(selection)
            .eq('author_public_id', uid)
            .eq('private', false)
            .order(sortField, { ascending });

        const { data, error } = await getCollectionsWithItemsCount(query, selection, true);

        if (error) {
            console.error('Error fetching user collections:', error);
            return res.status(500).json({ error: error.message });
        }
        res.json(data);
    } catch (err) {
        console.error('Error in getAllUserCollections:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const createNewCollection = async (req, res) => {
    try {

        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const { category, author_id, author, author_uuid } = req.body;

        // ✅ Validate required fields first
        if (!category || !author || !author_id || !author_uuid) {
            return res.status(400).json({ error: 'Missing category, author, or author_id' });
        }

        // make sure jwt token has 3 parts
        const tokenParts = token.split('.');
        if (tokenParts.length !== 3) {
            return res.status(401).json({ error: 'Invalid token format' });
        }

        const slug = slugify(category, {
            lower: true,
            strict: true,
            trim: true
        });

        // ✅ Proceed with insertion
        const { data, error } = await getSupabaseClientWithToken(token)
            .from('collections_v2')
            .insert([{
                category,
                author,
                "author_public_id": author_id,
                author_uuid,
                items: [],
                private: true,
                slug
            }])
            .select();

        if (error) {
            console.error('Insert error:', error.message);
            return res.status(500).json({ error: error.message });
        }

        res.status(201).json(data);
    } catch (err) {
        console.error('Catch error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};


export const renameCollection = async (req, res) => {
    try {
        const { oldCategory, newCategory } = req.body;
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        // use supabase to find collection with oldName and change the collection name to newName
        const { data, error } = await getSupabaseClientWithToken(token).from('collections_v2').update({ category: newCategory }).eq('category', oldCategory).select();

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const deleteCollection = async (req, res) => {
    try {
        const { uid, collectionId } = req.params;

        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const { data, error } = await getSupabaseClientWithToken(token).from('collections_v2').delete().eq('id', collectionId).eq('author_public_id', uid);

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const setVisible = async (req, res) => {
    try {
        const { category, author_public_id, visible } = req.body;
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const { data, error } = await getSupabaseClientWithToken(token)
            .from('collections_v2')
            .update({ private: !visible })
            .eq('category', category)
            .eq('author_public_id', author_public_id)
            .select('*');

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

export const updateCollection = async (req, res) => {
    try {
        const { collectionId } = req.params;
        const data = req.body;
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const { private: isPrivate, tags, category, description } = data;
        const slug = slugify(category, { lower: true, strict: true, trim: true });
        const last_modified = new Date().toISOString();

        const { data: updatedData, error } = await getSupabaseClientWithToken(token)
            .from('collections_v2')
            .update({
                private: isPrivate,
                tags,
                last_modified,
                category,
                description,
                slug
            })
            .eq('id', collectionId)
            .select('*');

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json(updatedData);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getCollectionThumbnailEndpoint = async (req, res) => {
    try {
        const { username, category } = req.params;

        if (!username || !category) {
            return res.status(400).json({ error: 'Username and category are required' });
        }

        // Create a mock collection object for the thumbnail helper
        const mockCollection = {
            author: username,
            category: category,
            questions: [] // We'll need to fetch items if no dedicated thumbnail exists
        };

        // First try to get the dedicated thumbnail
        let thumbnail = await getCollectionThumbnail(mockCollection);

        // If no dedicated thumbnail, fetch the collection to get items
        if (!thumbnail) {
            const { data: collectionData, error } = await supabase
                .from('collections_v2')
                .select('questions')
                .eq('author', username)
                .eq('category', category)
                .eq('private', false)
                .single();

            if (!error && collectionData) {
                mockCollection.questions = collectionData.questions;
                thumbnail = await getCollectionThumbnail(mockCollection);
            }
        }

        res.json({ thumbnail });
    } catch (err) {
        console.error('Error in getCollectionThumbnailEndpoint:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getRecommendedTags = async (req, res) => {
    // Accept query as a POST body property
    const { query } = req.body || {};
    if (!query || typeof query !== "string" || !query.trim()) {
        return res.status(400).json({ error: "Query parameter is required" });
    }
    try {
        const { data, error } = await supabase
            .from('collections_v2')
            .select('tags')
            .eq('private', false);

        if (error) {
            console.error('Error fetching tags:', error);
            return res.status(500).json({ error: error.message });
        }
        if (!data || data.length === 0) {
            return res.status(404).json({ error: 'No collections found' });
        }

        const tagCounts = {};
        // Split query into words, lowercase and trim
        const searchWords = query.trim().toLowerCase().split(/\s+/).filter(Boolean);

        data.forEach(collection => {
            let tags = collection.tags;
            // Handle tags as a comma-separated string
            if (typeof tags === 'string') {
                tags = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
            }
            if (Array.isArray(tags)) {
                tags.forEach(tag => {
                    if (typeof tag === 'string' && tag.trim()) {
                        // If any search word is included in the tag
                        if (searchWords.some(word => tag.trim().toLowerCase().includes(word))) {
                            tagCounts[tag.trim().toLowerCase()] = (tagCounts[tag.trim().toLowerCase()] || 0) + 1;
                        }
                    }
                });
            }
        });

        // Convert tagCounts object to array of { tag, count }
        const sortedTags = Object.entries(tagCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([tag, count]) => ({ tag, count }));

        // Limit to 20 tags
        const limitedTags = sortedTags.slice(0, 20);

        res.json(limitedTags);
    } catch (err) {
        console.error('Error in getRecommendedTags:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};