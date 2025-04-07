import { Router } from 'express';
import authenticateToken from '../middleware/authMiddleware.js';
import { AddItemToCollection, RemoveItemFromCollection, EditItemInCollection, ReorderItemInCollection } from '../controllers/itemsController.js';
import { upload, UploadToSupabase } from '../middleware/multer.js';
const router = Router();

router.post(
    '/upload',
    authenticateToken,
    upload.single('file'),
    UploadToSupabase,
    AddItemToCollection
);
router.post('/remove', authenticateToken, RemoveItemFromCollection);
router.post('/edit', authenticateToken, EditItemInCollection)
router.post('/reorder', authenticateToken, ReorderItemInCollection)

// Static route
router.get('/', authenticateToken, (req, res) => {
    res.json({ message: 'You are authenticated!' });
});

export default router;