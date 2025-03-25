import { Router } from 'express';
import { getAllCollections, getUserCollection, getAllUserCollections } from '../controllers/collectionsController.js';
import authenticateToken from '../middleware/authMiddleware.js';

const router = Router();

router.get('/', getAllCollections);
router.get('/:username/:collectionId', getUserCollection);
router.get('/:username/collections', authenticateToken, getAllUserCollections);

export default router;
