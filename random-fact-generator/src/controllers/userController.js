const User = require('../models/User');
const userService = require('../services/userService');

// User registration
exports.registerUser = async (req, res) => {
    try {
        const { username, password, email } = req.body;
        const newUser = await userService.createUser({ username, password, email });
        res.status(201).json({ message: 'User registered successfully', user: newUser });
    } catch (error) {
        res.status(500).json({ message: 'Error registering user', error: error.message });
    }
};

// User authentication
exports.authenticateUser = async (req, res) => {
    try {
        const { username, password } = req.body;
        const token = await userService.authenticateUser(username, password);
        res.status(200).json({ message: 'User authenticated successfully', token });
    } catch (error) {
        res.status(401).json({ message: 'Authentication failed', error: error.message });
    }
};

// Get user usage statistics
exports.getUserStats = async (req, res) => {
    try {
        const userId = req.user.id; // Assuming user ID is stored in req.user
        const stats = await userService.getUserUsageStats(userId);
        res.status(200).json({ message: 'User statistics retrieved successfully', stats });
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving user statistics', error: error.message });
    }
};