import { Router } from 'express';
import userRoutes from './users.js';
import collectionRoutes from './collections.js';
import itemRoutes from './items.js';

const router = Router();

// Mount sub-routers
router.use('/collections', collectionRoutes); // Add collections route
router.use('/users', userRoutes);
router.use('/items', itemRoutes);
export default router;
