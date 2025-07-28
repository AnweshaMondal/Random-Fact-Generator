import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import dotenv from 'dotenv';

// Import configurations
import { connectToDatabase } from './config/database.js';
import { connectToRedis } from './config/redis.js';
import config from './config/index.js';

// Import middleware
import errorHandler from './middleware/errorHandler.js';
import authMiddleware from './middleware/auth.js';
import rateLimiter from './middleware/rateLimiter.js';

// Import routes
import factRoutes from './routes/facts.js';
import userRoutes from './routes/users.js';
import aiRoutes from './routes/ai.js';

// Import utilities
import logger from './utils/logger.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Random Fact Generator API',
      version: '1.0.0',
      description: 'Production-ready API for serving verified random facts with AI integration',
      contact: {
        name: 'API Support',
        email: 'support@randomfacts.com'
      }
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: 'Development server'
      },
      {
        url: 'https://api.randomfacts.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-KEY'
        }
      }
    }
  },
  apis: ['./src/routes/*.js', './src/models/*.js']
};

const specs = swaggerJSDoc(swaggerOptions);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-KEY']
}));

// Compression middleware
app.use(compression());

// Logging middleware
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Random Fact Generator API Documentation'
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Info endpoint
app.get('/api/v1/info', (req, res) => {
  res.json({
    name: 'Random Fact Generator API',
    version: '1.0.0',
    description: 'Production-ready API for serving verified random facts with AI integration',
    documentation: '/api-docs',
    endpoints: {
      facts: '/api/v1/facts',
      users: '/api/v1/users',
      ai: '/api/v1/ai'
    }
  });
});

// Apply rate limiting to API routes
app.use('/api', rateLimiter);

// Routes
app.use('/api/v1/facts', factRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/ai', aiRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: `The requested endpoint ${req.originalUrl} does not exist`,
    documentation: '/api-docs'
  });
});

// Global error handling middleware
app.use(errorHandler);

// Graceful shutdown handler
const gracefulShutdown = (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  const server = app.listen(PORT);
  
  server.close(() => {
    logger.info('HTTP server closed');
    
    // Close database connections
    Promise.all([
      connectToDatabase.close?.(),
      connectToRedis.close?.()
    ]).then(() => {
      logger.info('Database connections closed');
      process.exit(0);
    }).catch((err) => {
      logger.error('Error during shutdown:', err);
      process.exit(1);
    });
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Connect to external services
async function startServer() {
  try {
    // Connect to database
    await connectToDatabase();
    logger.info('Connected to MongoDB');
    
    // Connect to Redis
    await connectToRedis();
    logger.info('Connected to Redis');
    
    // Start the server
    const server = app.listen(PORT, () => {
      logger.info(`🚀 Server is running on http://localhost:${PORT}`);
      logger.info(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
      logger.info(`🏥 Health Check: http://localhost:${PORT}/health`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
    
    return server;
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;