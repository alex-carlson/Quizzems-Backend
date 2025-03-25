import { Router } from 'express';
import {
    getAllCollections,
    getUserCollection,
    getAllUserCollections,
    createNewCollection,
    deleteCollection
} from '../controllers/collectionsController.js';
import authenticateToken from '../middleware/authMiddleware.js';

const router = Router();

router.get('/:username/all-collections', getAllUserCollections);
router.get('/:username/:collection', getUserCollection);
router.delete('/:username/:collection', authenticateToken, deleteCollection);
router.post('/createCollection', authenticateToken, createNewCollection);
router.get('/', getAllCollections); // Static route goes last

export default router;
