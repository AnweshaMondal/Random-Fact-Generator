import dotenv from 'dotenv';

dotenv.config();

const config = {
  // Application settings
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  apiVersion: process.env.API_VERSION || 'v1',
  
  // Database configuration
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/random-fact-generator',
    testUri: process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/random-fact-generator-test',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    }
  },
  
  // Redis configuration
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.REDIS_DB) || 0,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
  },
  
  // JWT configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'your_super_secret_jwt_key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  
  // AI configuration
  ai: {
    githubToken: process.env.GITHUB_TOKEN,
    endpoint: process.env.GITHUB_AI_ENDPOINT || 'https://models.github.ai/inference',
    model: process.env.GITHUB_AI_MODEL || 'xai/grok-3',
    enabled: process.env.AI_FACT_GENERATION_ENABLED === 'true',
    fallbackEnabled: process.env.AI_FALLBACK_ENABLED === 'true',
    contentModerationEnabled: process.env.AI_CONTENT_MODERATION_ENABLED === 'true',
  },
  
  // Rate limiting configuration
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  },
  
  // Email configuration
  email: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  
  // Stripe configuration
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  },
  
  // External APIs
  external: {
    factApiKey: process.env.EXTERNAL_FACT_API_KEY,
    backupSourceUrl: process.env.BACKUP_FACT_SOURCE_URL,
  },
  
  // Security settings
  security: {
    corsOrigin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    allowedHosts: process.env.ALLOWED_HOSTS?.split(',') || ['localhost'],
  },
  
  // Performance settings
  performance: {
    cacheTtl: parseInt(process.env.CACHE_TTL) || 3600,
    maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS) || 100,
  },
  
  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'app.log',
  },
  
  // Monitoring
  monitoring: {
    sentryDsn: process.env.SENTRY_DSN,
    analyticsApiKey: process.env.ANALYTICS_API_KEY,
  }
};

// Validation
if (config.nodeEnv === 'production') {
  const requiredEnvVars = [
    'MONGODB_URI',
    'JWT_SECRET',
    'GITHUB_TOKEN'
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
}

export default config;