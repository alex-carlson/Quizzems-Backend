import { Router } from 'express';
import { createUser, loginUser, forgotPassword, resetPassword } from '../controllers/userController.js';

const router = Router();

router.post('/signup', createUser);
router.post('/login', loginUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/', (req, res) => {
    res.send('Hello from users route');
});

export default router;
