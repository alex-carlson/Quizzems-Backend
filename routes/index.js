import { Router } from 'express';
import collectionRoutes from './collections.js';
import itemRoutes from './items.js';
import userRoutes from './users.js';

const router = Router();

// Mount sub-routers
router.use('/collections', collectionRoutes); // Add collections route
router.use('/items', itemRoutes);
router.use('/users', userRoutes);
export default router;
