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
        const selection = 'category, author, author_public_id, slug, created_at, items, tags';
        const query = supabase
            .from('collections')
            .select(selection)
            .eq('private', false);

        const { data, error } = await getCollectionsWithItemsCount(query, selection, true);

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        console.log("All collections data:", data);

        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getLatestCollections = async (req, res) => {
    try {
        const max = req.limit || 12;

        const selection = 'category, author, author_public_id, slug, created_at, items';

        const query = supabase
            .from('collections')
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

export const getLatestCollectionsWithThumbnails = async (req, res) => {
    try {
        const max = req.params.limit || 12;

        const query = supabase
            .from('collections')
            .eq('private', false)
            .order('created_at', { ascending: false })
            .limit(max);

        const { data, error } = await getCollectionsWithItemsCount(query, 'category, author, author_public_id, slug, created_at, items, tags', true);

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

        // Get all public collections with thumbnails
        const query = supabase
            .from('collections')
            .eq('private', false);

        const { data, error } = await getCollectionsWithItemsCount(query, 'category, author, author_public_id, slug, created_at, items, tags', true);

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
            .from('collections')
            .select('*', { count: 'exact', head: true })
            .eq('private', false);

        if (countError) {
            return res.status(500).json({ error: countError.message });
        }        // Special handling for size sorting (items array length)
        const selection = 'category, author, author_public_id, slug, created_at, items, tags';
        if (sortMode === "size") {
            // For size sorting, we need to get all data and sort in JavaScript
            // since we can't sort by array length directly in Supabase
            const allQuery = supabase
                .from('collections')
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
                    .from('collections')
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
                    .from('collections')
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

        // Step 1: Get matching results with thumbnails
        const matchingQuery = supabase
            .from('collections')
            .eq('private', false)
            .or(`category.ilike.%${searchTerm}%,author.ilike.%${searchTerm}%`);

        const { data: matching, error: matchError } = await getCollectionsWithItemsCount(matchingQuery, 'category, author, author_public_id, slug, created_at, items, tags', true);

        if (matchError) {
            return res.status(500).json({ error: matchError.message });
        }

        // If 10 or more results found, return them
        if (matching.length >= 10) {
            return res.json(matching.slice(0, 10));
        }

        // Step 2: Fetch additional non-matching results to fill to 10
        const excludeIds = matching.map(item => item.id); // assume you have `id` field

        const fillerQuery = supabase
            .from('collections')
            .eq('private', false)
            .not('id', 'in', `(${excludeIds.join(',')})`)
            .limit(10 - matching.length);

        const { data: filler, error: fillerError } = await getCollectionsWithItemsCount(fillerQuery, 'category, author, author_public_id, slug, created_at, items, tags', true);

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


export const getUserCollectionById = async (req, res) => {
    try {
        const { id } = req.params;
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const { data, error } = await getSupabaseClientWithToken(token)
            .from('collections')
            .select('*')
            .eq("id", id)
            .single();

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

export const getUserCollection = async (req, res) => {
    try {
        const { username, collection } = req.params;
        const { data, error } = await supabase.from('collections').select('*').eq('category', collection).eq('author', username).single();

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
        const { uid, collection } = req.params;
        const { data, error } = await supabase
            .from('collections')
            .select('*')
            .eq('slug', collection)
            .eq('author_public_id', uid).single();

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

export const getUserCollections = async (req, res) => {
    try {
        const { uid } = req.params;

        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const query = getSupabaseClientWithToken(token)
            .from('collections')
            .eq('author_public_id', uid)
            .eq('private', false);

        const { data, error } = await getCollectionsWithItemsCount(query, 'category, author, author_public_id, slug, created_at, items, tags', true);

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
        const selection = 'category, author, author_public_id, slug, created_at, items, tags, private, description';
        const query = supabase
            .from('collections')
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
            .from('collections')
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

        console.log("Changing name from " + oldCategory + " to " + newCategory);

        // use supabase to find collection with oldName and change the collection name to newName
        const { data, error } = await getSupabaseClientWithToken(token).from('collections').update({ category: newCategory }).eq('category', oldCategory).select();

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

        const { data, error } = await getSupabaseClientWithToken(token).from('collections').delete().eq('id', collectionId).eq('author_public_id', uid);

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
            .from('collections')
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
        console.log("Updating collection");
        const { collectionId } = req.params;
        console.log("Collection ID: " + collectionId);
        const data = req.body;
        console.log("Data: ", data);
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const { private: isPrivate, tags, category, description } = data;
        const slug = slugify(category, { lower: true, strict: true, trim: true });
        const last_modified = new Date().toISOString();

        const { data: updatedData, error } = await getSupabaseClientWithToken(token)
            .from('collections')
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
            items: [] // We'll need to fetch items if no dedicated thumbnail exists
        };

        // First try to get the dedicated thumbnail
        let thumbnail = await getCollectionThumbnail(mockCollection);

        // If no dedicated thumbnail, fetch the collection to get items
        if (!thumbnail) {
            const { data: collectionData, error } = await supabase
                .from('collections')
                .select('items')
                .eq('author', username)
                .eq('category', category)
                .eq('private', false)
                .single();

            if (!error && collectionData) {
                mockCollection.items = collectionData.items;
                thumbnail = await getCollectionThumbnail(mockCollection);
            }
        }

        res.json({ thumbnail });
    } catch (err) {
        console.error('Error in getCollectionThumbnailEndpoint:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};