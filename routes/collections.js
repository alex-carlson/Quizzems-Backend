import { Router } from 'express';
import {
    getAllCollections,
    getUserCollection,
    getUserCollections,
    getAllUserCollections,
    createNewCollection,
    renameCollection,
    deleteCollection,
    setVisible
} from '../controllers/collectionsController.js';
import authenticateToken from '../middleware/authMiddleware.js';

const router = Router();

router.get('/:username/all-collections', getAllUserCollections);
router.get('/:username/:collections', authenticateToken, getUserCollections);
router.get('/:username/:collection', getUserCollection);
router.delete('/:username/:collection', authenticateToken, deleteCollection);
router.post('/createCollection', authenticateToken, createNewCollection);
router.post('/renameCollection', authenticateToken, renameCollection);
router.post('/setVisible', authenticateToken, setVisible);
router.get('/', getAllCollections); // Static route goes last

export default router;
