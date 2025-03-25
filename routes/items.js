import { Router } from 'express';
import authenticateToken from '../middleware/authMiddleware.js';
import uploadBase64ToSupabase from '../middleware/uploadBase64ToSupabase.js';
import { AddItemToCollection } from '../controllers/itemsController.js';

const router = Router();

router.post('/upload', authenticateToken, uploadBase64ToSupabase, AddItemToCollection);

// Static route
router.get('/', authenticateToken, (req, res) => {
    res.json({ message: 'You are authenticated!' });
});

export default router;