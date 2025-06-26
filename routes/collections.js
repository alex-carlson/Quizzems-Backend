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
  getRandomCollections
} from '../controllers/collectionsController.js';
import verifySupabaseToken from '../middleware/supabaseAuth.js';

const router = Router();

// DELETE collection (protected)
router.delete('/:uid/:collectionId', verifySupabaseToken, deleteCollection);

// GET collection by ID (public)
router.get('/id/:id', verifySupabaseToken, getUserCollectionById);

// GET all collections of a user (public - all)
router.get('/user/:uid/all', getAllUserCollections);

// GET a public user collection
router.get('/user/:uid/:collection', getPublicUserCollection);

// GET all collections of a user (protected)
router.get('/user/:uid', verifySupabaseToken, getUserCollections);

// POST create, rename, set visibility (all protected)
router.post('/createCollection', verifySupabaseToken, createNewCollection);
router.post('/renameCollection', verifySupabaseToken, renameCollection);
router.post('/setVisible', verifySupabaseToken, setVisible);

// GET latest collections (public)
router.get('/latest', getLatestCollections);
router.get('/random/:limit', getRandomCollections); // Random collections endpoint

// GET collections by search (public)
router.get('/search', searchCollections);

// GET all collections (public, static route)
router.get('/', getAllCollections);

export default router;
