import express from 'express';
import { generateResponse } from '../controllers/aiController.js';

const router = express.Router();

// Route to handle AI interactions
router.post('/generate', generateResponse);

export default router;