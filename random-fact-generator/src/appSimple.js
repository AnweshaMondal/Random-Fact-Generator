import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectToDatabase } from './config/database.js';
import { connectToRedis } from './config/redis.js';
import factRoutes from './routes/factsSimple.js';
import logger from './utils/logger.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Basic middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Routes
app.use('/api/v1/facts', factRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: `The requested endpoint ${req.originalUrl} does not exist`
  });
});

// Basic error handler
app.use((error, req, res, next) => {
  logger.logError(error, req);
  res.status(500).json({
    status: 'error',
    message: 'Internal server error',
    error_code: 'INTERNAL_ERROR'
  });
});

// Connect to services and start server
async function startServer() {
  try {
    // Try to connect to database
    try {
      await connectToDatabase();
      logger.info('✅ Connected to MongoDB');
    } catch (dbError) {
      logger.warn('⚠️ MongoDB connection failed, continuing without database:', dbError.message);
    }
    
    // Try to connect to Redis
    try {
      await connectToRedis();
      logger.info('✅ Connected to Redis');
    } catch (redisError) {
      logger.warn('⚠️ Redis connection failed, continuing without cache:', redisError.message);
    }
    
    // Start the server
    app.listen(PORT, () => {
      logger.info(`🚀 Server is running on http://localhost:${PORT}`);
      logger.info(`🏥 Health Check: http://localhost:${PORT}/health`);
      logger.info(`📚 API Endpoint: http://localhost:${PORT}/api/v1/facts/random`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;
