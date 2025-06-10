import { Router } from 'express';
import { AddItemToCollection, RemoveItemFromCollection, EditItemInCollection, ReorderItemInCollection, AddAudioToCollection } from '../controllers/itemsController.js';
import { upload, UploadToSupabase, uploadUrlToSupabase } from '../middleware/multer.js';
import { contentModeration } from '../middleware/contentModeration.js';
import verifySupabaseToken from '../middleware/supabaseAuth.js';

const router = Router();

router.post(
    '/upload',
    verifySupabaseToken,
    // contentModeration,
    upload.single('file'),
    UploadToSupabase,
    AddItemToCollection
);

router.post('/upload-url', verifySupabaseToken, uploadUrlToSupabase, AddItemToCollection);
router.post('/add-audio', verifySupabaseToken, upload.single('file'), AddAudioToCollection);

router.post('/remove', verifySupabaseToken, RemoveItemFromCollection);
router.post('/edit', verifySupabaseToken, EditItemInCollection)
router.post('/reorder', verifySupabaseToken, ReorderItemInCollection)

// Static route
router.get('/', verifySupabaseToken, (req, res) => {
    res.json({ message: 'You are authenticated!' });
});

export default router;