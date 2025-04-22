import { Router } from 'express';
import { createUser, loginUser, forgotPassword, resetPassword, getUser, changeUsername } from '../controllers/userController.js';

const router = Router();

router.post('/signup', createUser);
router.post('/login', loginUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/changeUsername', changeUsername);
router.get('/:id', getUser);
router.get('/', (req, res) => {
    res.send('Hello from users route');
});

export default router;
