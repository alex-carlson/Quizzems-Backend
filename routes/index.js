import { Router } from 'express';
import collectionRoutes from './collections.js';
import itemRoutes from './items.js';

const router = Router();

// Mount sub-routers
router.use('/collections', collectionRoutes); // Add collections route
router.use('/items', itemRoutes);
export default router;
