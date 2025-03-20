import express from 'express';
import landmarksRouter from '../utils/landmarks.js';

const router = express.Router();

// Mount landmarks router at "/landmarks"
// This means the final endpoint will be /api/landmarks/places
router.use('/landmarks', landmarksRouter);

// You can add additional endpoints for suggestions here if needed

export default router;
