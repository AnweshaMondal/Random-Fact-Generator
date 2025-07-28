import express from 'express';
import { registerUser, authenticateUser, getUserStats } from '../controllers/userController.js';

const router = express.Router();

// Route for user registration
router.post('/register', registerUser);

// Route for user authentication
router.post('/login', authenticateUser);

// Route for getting user statistics
router.get('/stats', getUserStats);

export default router;