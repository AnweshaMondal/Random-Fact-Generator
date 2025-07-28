const express = require('express');
const mongoose = require('mongoose');
const { connectToDatabase } = require('./config/database');
const { connectToRedis } = require('./config/redis');
const errorHandler = require('./middleware/errorHandler');
const authMiddleware = require('./middleware/auth');
const rateLimiter = require('./middleware/rateLimiter');
const factRoutes = require('./routes/facts');
const userRoutes = require('./routes/users');
const aiRoutes = require('./routes/ai');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(authMiddleware);
app.use(rateLimiter);

// Routes
app.use('/api/v1/facts', factRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/ai', aiRoutes);

// Error handling middleware
app.use(errorHandler);

// Connect to database and Redis
connectToDatabase();
connectToRedis();

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});