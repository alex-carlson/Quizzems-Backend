import { supabase, getSupabaseClientWithToken } from '../config/supabaseClient.js';
import slugify from 'slugify';
import {
    filterCollections,
    addThumbnailsToCollections,
    getCollectionThumbnailFast
} from '../utils/collectionHelpers.js';

export const getAllCollections = async (req, res) => {
    try {
        const selection = 'category, author_uuid, profiles(username, public_id, username_slug), slug, created_at, items_length, tags, thumbnail_url';
        const { data, error } = await supabase
            .from('collections')
            .select(selection)
            .eq('private', false);

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        // Add thumbnails and persist thumbnail_url if needed
        const collectionsWithThumbnails = await addThumbnailsToCollections(data || []);
        res.json(collectionsWithThumbnails);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getPopularTags = async (req, res) => {
    try {
        const { limit = 20 } = req.query;
        const { data, error } = await supabase
            .from('collections')
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
        const selection = 'id, category, author_uuid, profiles(username, public_id, username_slug), slug, created_at, items_length, thumbnail_url';
        const { data, error } = await supabase
            .from('collections')
            .select(selection)
            .eq('private', false)
            .order('created_at', { ascending: false })
            .limit(max);

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        // Add thumbnails and persist thumbnail_url if needed
        const collectionsWithThumbnails = await addThumbnailsToCollections(data || []);
        res.json(collectionsWithThumbnails);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getMostPopularCollections = async (req, res) => {
    try {
        const max = req.limit || 12;
        const selection = 'id, category, author_uuid, profiles(username, public_id, username_slug), slug, created_at, items_length, times_played, tags, thumbnail_url';
        const { data, error } = await supabase
            .from('collections')
            .select(selection)
            .eq('private', false)
            .order('times_played', { ascending: false, nullsFirst: false })
            .limit(max);
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        // Add thumbnails and persist thumbnail_url if needed
        const collectionsWithThumbnails = await addThumbnailsToCollections(data || []);
        res.json(collectionsWithThumbnails);
    } catch (err) {
        console.error('Error in getMostPopularCollections:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getLatestCollectionsWithThumbnails = async (req, res) => {
    try {
        const max = req.params.limit || 12;
        const selection = 'id, category, author_uuid, profiles(username, public_id, username_slug), slug, created_at, items_length, tags, thumbnail_url';
        const { data, error } = await supabase
            .from('collections')
            .select(selection)
            .eq('private', false)
            .order('created_at', { ascending: false })
            .limit(max);

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        // Add thumbnails and persist thumbnail_url if needed
        const collectionsWithThumbnails = await addThumbnailsToCollections(data || []);
        res.json(collectionsWithThumbnails);
    } catch (err) {
        console.error('Error in getLatestCollectionsWithThumbnails:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};


export const getRandomCollections = async (req, res) => {
    try {
        const { limit } = req.params;
        // If no limit is provided, default to 10
        let max = limit;
        if (!max || isNaN(max) || max <= 0) {
            max = 10;
        }
        const selection = 'id, category, author_uuid, profiles(username, public_id, username_slug), slug, created_at, items_length, tags, thumbnail_url';
        const { data, error } = await supabase
            .from('collections')
            .select(selection)
            .eq('private', false);

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        // Shuffle the data array
        const shuffledData = data.sort(() => 0.5 - Math.random());
        // Add thumbnails and persist thumbnail_url if needed
        const collectionsWithThumbnails = await addThumbnailsToCollections(shuffledData.slice(0, max));
        res.json(collectionsWithThumbnails);
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
            .from('collections')
            .select('id, created_at')
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
        const selection = 'id, category, author_uuid, profiles(username, public_id, username_slug), slug, created_at, items_length, tags, thumbnail_url';
        const { data, error } = await supabase
            .from('collections')
            .select(selection)
            .eq('id', chosenId)
            .eq('private', false);

        if (error || !data || !data.length) {
            return res.status(404).json({ error: 'No collections found' });
        }

        // Add thumbnail and persist thumbnail_url if needed
        const [collectionWithThumbnail] = await addThumbnailsToCollections([data[0]]);
        res.json(collectionWithThumbnail);
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
            "size": "items_length",
            "plays": "times_played"
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
        }

        const selection = 'id, category, author_uuid, profiles(username, public_id, username_slug), slug, created_at, items_length, tags, thumbnail_url, times_played';

        if (filter) {
            // If filtering is needed, get all data first, then filter and paginate
            const { data: allData, error } = await supabase
                .from('collections')
                .select(selection)
                .eq('private', false);

            if (error) {
                console.error('Error fetching all collections for filtering:', error);
                return res.status(500).json({ error: error.message });
            }

            console.log('Fetched all collections for filtering:', allData.length);

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

            // Add thumbnails and persist thumbnail_url if needed
            const collectionsWithThumbnails = await addThumbnailsToCollections(paginatedData || []);
            const filteredTotalCount = filteredData.length;
            const totalPages = Math.ceil(filteredTotalCount / limitNum);
            res.json({
                collections: collectionsWithThumbnails,
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
            let { data, error } = await supabase
                .from('collections')
                .select(selection)
                .eq('private', false)
                .order(sortColumn, { ascending })
                .range(offset, offset + limitNum - 1);

            if (error) {
                console.error('Database query error:', error);
                return res.status(500).json({ error: error.message });
            }

            const totalPages = Math.ceil(totalCount / limitNum);
            const collectionsWithThumbnails = await addThumbnailsToCollections(data || []);
            res.json({
                collections: collectionsWithThumbnails,
                totalCount,
                totalPages,
                currentPage: pageNum,
                limit: limitNum,
                sortMode,
                sortOrder,
                filter: null
            });
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

        const selection = 'id, category, author_uuid, profiles(username, public_id, username_slug), slug, created_at, items_length, tags, thumbnail_url';

        // Step 1: Get matching results with thumbnails
        const { data: matchingData, error: matchingError } = await supabase
            .from('collections')
            .select(selection)
            .eq('private', false)
            .or(`category.ilike.%${searchTerm}%,tags.ilike.%${searchTerm}%`);

        if (matchingError) {
            console.error('Error fetching matching collections:', matchingError);
            return res.status(500).json({ error: matchingError.message });
        }

        // If 10 or more results found, add thumbnails and return them
        if (matchingData.length >= 10) {
            const collectionsWithThumbnails = await addThumbnailsToCollections(matchingData.slice(0, 10));
            return res.json(collectionsWithThumbnails);
        }

        // Step 2: Fetch additional non-matching results to fill to 10
        const excludeIds = matching.map(item => item.id); // assume you have `id` field

        const { data, error } = await supabase
            .from('collections')
            .select(selection)
            .eq('private', false)
            .not('id', 'in', `(${excludeIds.join(',')})`)
            .limit(10 - matching.length);

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        // Combine search results with filler and send
        const combined = [...matchingData, ...data];
        const collectionsWithThumbnails = await addThumbnailsToCollections(combined);
        res.json(collectionsWithThumbnails);
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
        const selection = 'id, category, author_uuid, profiles(username, public_id, username_slug), slug, created_at, items_length, tags, thumbnail_url';
        // Fetch collections where tags ilike the tag (broad match)
        const { data, error } = await supabase
            .from('collections')
            .select(selection)
            .eq('private', false)
            .ilike('tags', `%${searchTag}%`);
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
        const collectionsWithThumbnails = await addThumbnailsToCollections(filtered);
        res.json(collectionsWithThumbnails);
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

        const { data, error } = await getSupabaseClientWithToken(token)
            .from('collections')
            .select('*, profiles(username, public_id, username_slug)')
            .eq("id", id)
            .single();

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        // Add thumbnail to single collection
        const collectionWithThumbnail = await getCollectionThumbnailFast(data, data.items || []);
        // add thumbnail_url to the collection object
        if (collectionWithThumbnail) {
            data.thumbnail_url = collectionWithThumbnail;
        } else {
            data.thumbnail_url = null; // No thumbnail found
        }
        res.status(200).json(data);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getUserCollectionId = async (req, res) => {
    try {
        const { uid, slug } = req.params;

        const { data, error } = await supabase
            .from('collections')
            .select('id, slug, author_uuid, profiles(public_id)')
            .eq('slug', slug);

        if (error) {
            console.error('Error:', error);
            return res.status(500).json({ error: error.message });
        }

        const match = data.find(c => String(c.profiles?.public_id) === String(uid));

        if (!match) {
            return res.status(404).json({ error: 'Collection not found' });
        }

        console.log("Got collection!");

        res.status(200).json({ id: match.id });

    } catch (err) {
        console.error('Error in getUserCollectionId:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getUserCollection = async (req, res) => {
    try {
        const { username, collection } = req.params;
        const { data, error } = await supabase.from('collections').select('*, profiles(username, public_id, username_slug)').eq('category', collection).eq('author', username).single();

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

export const incrementTimesPlayed = async (req, res) => {
    try {
        const { collectionId } = req.params;

        // First get current value, then increment atomically
        const { data, error } = await supabase
            .from('collections')
            .select('times_played')
            .eq('id', collectionId)
            .single();

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        const newTimesPlayed = (data.times_played || 0) + 1;

        const { data: updatedData, error: updateError } = await supabase
            .from('collections')
            .update({ times_played: newTimesPlayed })
            .eq('id', collectionId)
            .select('id, times_played')
            .single();

        if (updateError) {
            return res.status(500).json({ error: updateError.message });
        }

        res.status(200).json({ id: updatedData.id, times_played: updatedData.times_played });
    } catch (err) {
        console.error('Error in incrementTimesPlayed:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getPublicUserCollection = async (req, res) => {
    try {
        const { collectionId } = req.params;
        const { data, error } = await supabase
            .from('collections')
            .select('*, profiles(username, public_id, username_slug)')
            .eq('id', collectionId)
            .eq('private', false)
            .single();

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        // Add thumbnail to single collection
        const collectionWithThumbnail = await getCollectionThumbnailFast(data, data.items || []);
        // add thumbnail_url to the collection object
        if (collectionWithThumbnail) {
            data.thumbnail_url = collectionWithThumbnail;
        } else {
            data.thumbnail_url = null; // No thumbnail found
        }
        res.status(200).json(data);
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

        const selection = 'category, author_uuid, profiles(username, public_id, username_slug), slug, created_at, items_length, private, tags, id, thumbnail_url';

        // Use .eq('author_uuid', uid) to filter by user, then join profiles
        const { data, error } = await getSupabaseClientWithToken(token)
            .from('collections')
            .select(selection)
            .eq('author_public_id', uid);


        if (error) {
            return res.status(500).json({ error: error.message });
        }

        if (!data || data.length === 0) {
            return res.status(404).json({ error: 'No collections found for this user' });
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
        const selection = 'id, category, author_uuid, profiles(username, public_id, username_slug), slug, created_at, items_length, tags, private, description, thumbnail_url';
        const { data, error } = await supabase
            .from('collections')
            .select(selection)
            .eq('private', false)
            .order(sortField, { ascending });

        if (error) {
            console.error('Error fetching user collections:', error);
            return res.status(500).json({ error: error.message });
        }

        // Filter collections where profiles.public_id matches uid
        const filteredData = (data || []).filter(
            col => String(col.profiles?.public_id) === String(uid)
        );

        res.json(filteredData);
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
                author_public_id: author_id,
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
        const { category, author_public_id: public_id, visible } = req.body;
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const { data, error } = await getSupabaseClientWithToken(token)
            .from('collections')
            .update({ private: !visible })
            .eq('category', category)
            .eq('profiles(public_id)', public_id)
            .select('*, profiles(username, public_id, username_slug)');

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

        const { private: isPrivate, tags, category, description, shuffle } = data;
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
                slug,
                shuffle
            })
            .eq('id', collectionId)
            .select('*, profiles(username, public_id, username_slug)');

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json(updatedData);
    } catch (err) {
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
            .from('collections')
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