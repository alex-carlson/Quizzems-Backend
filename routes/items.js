import { Router } from 'express';
import {
    AddItemToQuestion,
    RemoveItemFromCollection,
    updateItem,
    ReorderItemInCollection,
    AddAudioToCollection,
    AddQuestionToCollection,
    AddThumbnailToCollection,
    getItemById,
    getItemsByCollectionId,
    RemoveQuestion
} from '../controllers/itemsController.js';
import { upload, UploadToSupabase, uploadUrlToSupabase } from '../middleware/multer.js';
import { contentModeration } from '../middleware/contentModeration.js';
import verifySupabaseToken from '../middleware/supabaseAuth.js';

const router = Router();

router.get('/:id', getItemById);
router.get('/allQuestions/:collectionId', getItemsByCollectionId);

router.post(
    '/upload',
    verifySupabaseToken,
    // contentModeration,
    upload.single('file'),
    UploadToSupabase,
    AddItemToQuestion
);

router.post('/upload-url', verifySupabaseToken, uploadUrlToSupabase, AddItemToQuestion);
router.post('/add-audio', verifySupabaseToken, upload.single('file'), AddAudioToCollection);
router.post('/add-question', verifySupabaseToken, upload.single('file'), AddQuestionToCollection);
router.post('/add-thumbnail', verifySupabaseToken, upload.single('file'), UploadToSupabase, AddThumbnailToCollection);

router.post('/edited-image', verifySupabaseToken, upload.single('file'), UploadToSupabase, (req, res) => {
    // This route is for editing images, it uses the same upload middleware
    // but does not perform any additional actions
    res.json({ message: 'Image uploaded successfully', url: req.uploadedImageUrl });
});
router.post('/remove', verifySupabaseToken, RemoveItemFromCollection, RemoveQuestion);
router.post('/edit', verifySupabaseToken, updateItem)
router.post('/reorder', verifySupabaseToken, ReorderItemInCollection)

// Static route
router.get('/', verifySupabaseToken, (req, res) => {
    res.json({ message: 'You are authenticated!' });
});

export default router;