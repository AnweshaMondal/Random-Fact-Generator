import express from 'express';
import { getRandomFact, getFactByCategory } from '../controllers/factController.js';
import { rateLimiter } from '../middleware/rateLimiter.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Route to get a random fact
router.get('/fact', authenticate, rateLimiter, getRandomFact);

// Route to get a fact by category
router.get('/fact/:category', authenticate, rateLimiter, getFactByCategory);

export default router;