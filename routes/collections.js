import { Router } from 'express';
import {
    getAllCollections,
    getLatestCollections,
    getUserCollectionById,
    getUserCollections,
    getAllUserCollections,
    createNewCollection,
    getPublicUserCollection,
    renameCollection,
    deleteCollection,
    setVisible
} from '../controllers/collectionsController.js';
import authenticateToken from '../middleware/authMiddleware.js';

const router = Router();

router.delete('/:username/:collection', authenticateToken, deleteCollection);
router.get('/id/:id', getUserCollectionById);

router.get('/user/:username/all', getAllUserCollections);
router.get('/user/:username/:collection', getPublicUserCollection);
router.get('/user/:username', authenticateToken, getUserCollections);


router.post('/createCollection', authenticateToken, createNewCollection);
router.post('/renameCollection', authenticateToken, renameCollection);
router.post('/setVisible', authenticateToken, setVisible);

router.get('/latest', getLatestCollections);

router.get('/', getAllCollections); // Static route goes last

export default router;
