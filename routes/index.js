import { Router } from 'express';
import userRoutes from './users.js';
import collectionRoutes from './collections.js';

const router = Router();

router.use('/users', userRoutes);
router.use('/collections', collectionRoutes); // Add collections route
router.use('/collections/:username/:collectionName', collectionRoutes); // Add user collection route
router.use('/:username/collections', collectionRoutes); // Add all user collections route

export default router;
