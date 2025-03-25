import { Router } from 'express';
import { createUser, loginUser } from '../controllers/userController.js';

const router = Router();

router.post('/signup', createUser);
router.post('/login', loginUser);
router.get('/', (req, res) => {
    res.send('Hello from users route');
});

export default router;
