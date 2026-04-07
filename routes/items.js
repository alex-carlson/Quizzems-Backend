import { Router } from 'express';
import {
    AddItemToCollection,
    RemoveItemFromCollection,
    EditItemInCollection,
    ReorderItemInCollection,
    AddAudioToCollection,
    AddQuestionToCollection,
    AddThumbnailToCollection,
    GetRandomItemsInCollection
} from '../controllers/itemsController.js';
import { upload, UploadToSupabase, uploadUrlToSupabase } from '../middleware/multer.js';
import verifySupabaseToken from '../middleware/supabaseAuth.js';

const router = Router();

router.get(
    '/random/:count',
    GetRandomItemsInCollection
)

router.post(
    '/upload',
    verifySupabaseToken,
    upload.single('file'),
    UploadToSupabase,
    AddItemToCollection
);

router.post('/upload-url', verifySupabaseToken, uploadUrlToSupabase, AddItemToCollection);
router.post('/add-audio', verifySupabaseToken, upload.single('file'), AddAudioToCollection);
router.post('/add-question', verifySupabaseToken, upload.single('file'), AddQuestionToCollection);
router.post('/add-thumbnail', verifySupabaseToken, upload.single('file'), UploadToSupabase, AddThumbnailToCollection);

router.post('/remove', verifySupabaseToken, RemoveItemFromCollection);
router.post('/edit', verifySupabaseToken, EditItemInCollection);
router.post('/reorder', verifySupabaseToken, ReorderItemInCollection);

// Static route
router.get('/', verifySupabaseToken, (req, res) => {
    res.json({ message: 'You are authenticated!' });
});

export default router;