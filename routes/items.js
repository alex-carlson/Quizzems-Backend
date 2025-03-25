import { Router } from 'express';
import authenticateToken from '../middleware/authMiddleware.js';
import uploadBase64ToSupabase from '../middleware/uploadBase64ToSupabase.js';
import { AddItemToCollection, RemoveItemFromCollection } from '../controllers/itemsController.js';

const router = Router();

router.post('/upload', authenticateToken, uploadBase64ToSupabase, AddItemToCollection);
router.post('/remove', authenticateToken, RemoveItemFromCollection);

// Static route
router.get('/', authenticateToken, (req, res) => {
    res.json({ message: 'You are authenticated!' });
});

export default router;