import { Router } from 'express';
import collectionRoutes from './collections.js';
import itemRoutes from './items.js';
import userRoutes from './users.js';
import partyRoutes from './party.js';

const router = Router();

// Mount sub-routers
router.use('/collections', collectionRoutes); // Add collections route
router.use('/items', itemRoutes);
router.use('/users', userRoutes);
router.use('/party', partyRoutes);
export default router;
