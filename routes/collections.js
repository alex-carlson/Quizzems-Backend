import { Router } from 'express';
import {
  getAllCollections,
  getLatestCollections,
  searchCollections,
  getUserCollectionById,
  getUserCollections,
  getAllUserCollections,
  createNewCollection,
  getPublicUserCollection,
  renameCollection,
  deleteCollection,
  setVisible,
  getRandomCollections,
  updateCollection,
  getPaginatedCollections,
  getUserCollectionId,
  getMostPopularCollections,
  getPopularTags,
  getRecommendedTags
} from '../controllers/collectionsController.js';
import verifySupabaseToken from '../middleware/supabaseAuth.js';

const router = Router();

// GET collection by ID (public) - Most specific first
router.get('/id/:id', verifySupabaseToken, getUserCollectionById);

// GET latest collections (public) - Static routes before dynamic
router.get('/latest', (req, res, next) => {
  req.limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined;
  getLatestCollections(req, res, next);
});
router.get('/popular', (req, res, next) => {
  req.limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined;
  getMostPopularCollections(req, res, next);
});

router.get('/tags/popular', (req, res, next) => {
  req.limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined;
  req.tag = req.query.tag || '';
  getPopularTags(req, res, next);
});

// GET random collections (public) - Static routes before dynamic
router.get('/random/:limit', getRandomCollections);

// GET collections by search (public) - Static routes before dynamic
router.get('/search', searchCollections);

// GET all collections of a user (public - all) - Specific user routes before general
router.get('/user/all/:uid', getAllUserCollections);

// GET a public user collection - More specific than /user/:uid
router.get('/user/public/:collectionId', getPublicUserCollection);

// GET user's own collection by ID (protected)
router.get('/user/collection/:id', verifySupabaseToken, getUserCollectionById);

// GET collection id from user and slug
router.get('/user/collection/:uid/:slug', getUserCollectionId);

// GET all collections of a user (protected) - Less specific user route
router.get('/user/:uid', verifySupabaseToken, getUserCollections);

// POST paginated collections
router.post('/page/:page/:limit', getPaginatedCollections);

// POST create, rename, set visibility (all protected)
router.post('/update/:collectionId', verifySupabaseToken, updateCollection);
router.post('/createCollection', verifySupabaseToken, createNewCollection);
router.post('/renameCollection', verifySupabaseToken, renameCollection);
router.post('/setVisible', verifySupabaseToken, setVisible);

// DELETE collection (protected)
router.delete('/:uid/:collectionId', verifySupabaseToken, deleteCollection);

// GET recommended tags based on query string
router.get('/tags/recommended', getRecommendedTags);

// GET all collections (public, static route) - Most general route last
router.get('/', getAllCollections);

export default router;
