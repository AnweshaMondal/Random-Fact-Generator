import express from 'express';
import factController from '../controllers/factControllerSimple.js';

const router = express.Router();

// Basic routes without complex middleware for now
router.get('/random', factController.getRandomFact);
router.get('/category/:category', factController.getFactByCategory);
router.get('/categories', factController.getCategories);

export default router;
