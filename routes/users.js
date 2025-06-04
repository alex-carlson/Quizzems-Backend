import { Router } from 'express';
import verifySupabaseToken from '../middleware/supabaseAuth.js';
import { uploadUserAvatar, getUserProfile } from '../controllers/userController.js';
import { upload, UploadToSupabase } from '../middleware/multer.js';
import { contentModeration } from '../middleware/contentModeration.js';

const router = Router();

router.post(
    '/uploadAvatar',
    verifySupabaseToken,
    // contentModeration,
    upload.single('file'),
    UploadToSupabase,
    uploadUserAvatar
);

router.post(
    '/createProfile',
    verifySupabaseToken,
    createUserProfile
)

router.get('/:uid', getUserProfile);


router.get('/', (req, res) => {
    res.send('Hello from users route');
});

export default router;
