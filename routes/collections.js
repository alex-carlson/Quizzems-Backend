import { Router } from 'express';
import {
    getAllCollections,
    getUserCollection,
    getAllUserCollections,
    createNewCollection
} from '../controllers/collectionsController.js';
import authenticateToken from '../middleware/authMiddleware.js';

const router = Router();

router.get('/:username/all-collections', getAllUserCollections);
router.get('/:username/:collection', getUserCollection);
router.post('/createCollection', authenticateToken, createNewCollection);
router.get('/', getAllCollections); // Static route goes last

export default router;
