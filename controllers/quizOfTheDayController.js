import { supabase } from '../config/supabaseClient.js';
import { addThumbnailsToCollections } from '../utils/collectionHelpers.js';

const COLLECTION_SELECT = `
id,
category,
author_uuid,
profiles(username, public_id, username_slug),
slug,
created_at,
items_length,
tags,
thumbnail_url
`;

const SETTINGS_KEY = 'quiz_of_the_day_ids';

/**
 * Public endpoint: GET /collections/quiz-of-the-day
 * Returns an ordered array of up to 6 resolved, public quiz objects
 * Returns empty array if no quizzes are configured
 */
export const getQuizOfTheDay = async (req, res) => {
  try {
    // Fetch the stored quiz IDs from settings
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .single();

    if (settingsError && settingsError.code !== 'PGRST116') {
      // PGRST116 = no rows found, which is okay
      console.error('Error fetching settings:', settingsError);
      return res.status(500).json({ error: 'Internal server error' });
    }

    // If no settings found or value is empty, return empty array
    if (!settings?.value) {
      return res.json([]);
    }

    let quizIds = [];
    try {
      quizIds = JSON.parse(settings.value);
    } catch (e) {
      console.error('Error parsing quiz IDs from settings:', e);
      return res.json([]);
    }

    if (!Array.isArray(quizIds) || quizIds.length === 0) {
      return res.json([]);
    }

    // Fetch the collections in order
    const { data: collections, error: collectionsError } = await supabase
      .from('collections')
      .select(COLLECTION_SELECT)
      .eq('private', false)
      .gt('items_length', 0)
      .in('id', quizIds);

    if (collectionsError) {
      console.error('Error fetching collections:', collectionsError);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (!collections || collections.length === 0) {
      return res.json([]);
    }

    // Sort collections to match the order in quizIds
    const orderedCollections = quizIds
      .map(id => collections.find(c => c.id === id))
      .filter(Boolean); // Remove any undefined entries (quiz was deleted)

    // Add thumbnails
    const collectionsWithThumbnails = await addThumbnailsToCollections(orderedCollections);

    res.json(collectionsWithThumbnails);
  } catch (err) {
    console.error('Error in getQuizOfTheDay:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Admin endpoint: POST /collections/quiz-of-the-day
 * Updates the quiz-of-the-day configuration
 * Body: { quizIds: [id1, id2, ...] }
 * - Max 6 quizzes
 * - All must be public
 * - All must exist
 * - Backend verifies admin permissions (via verifyAdminToken middleware)
 */
export const updateQuizOfTheDay = async (req, res) => {
  try {
    const { quizIds } = req.body;

    // Validate input
    if (!Array.isArray(quizIds)) {
      return res.status(400).json({ error: 'quizIds must be an array' });
    }

    if (quizIds.length === 0 || quizIds.length > 6) {
      return res.status(400).json({ error: 'Must provide between 1 and 6 quiz IDs' });
    }

    // Validate all quizzes exist and are public
    const { data: collections, error: collectionsError } = await supabase
      .from('collections')
      .select('id, private')
      .in('id', quizIds);

    if (collectionsError) {
      console.error('Error fetching collections for validation:', collectionsError);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (!collections || collections.length !== quizIds.length) {
      return res.status(400).json({ error: 'One or more quiz IDs do not exist' });
    }

    // Check that all are public
    const allPublic = collections.every(col => col.private === false);
    if (!allPublic) {
      return res.status(400).json({ error: 'All quizzes must be public' });
    }

    // Store the quiz IDs in settings (maintaining order)
    const { error: upsertError } = await supabase
      .from('settings')
      .upsert({
        key: SETTINGS_KEY,
        value: JSON.stringify(quizIds),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'key'
      });

    if (upsertError) {
      console.error('Error updating settings:', upsertError);
      return res.status(500).json({ error: 'Internal server error' });
    }

    res.json({
      success: true,
      message: 'Quiz of the day updated successfully',
      quizIds
    });
  } catch (err) {
    console.error('Error in updateQuizOfTheDay:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
