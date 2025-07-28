import { Redis } from 'ioredis';
import config from './index.js';
import logger from '../utils/logger.js';

class RedisConnection {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      if (this.isConnected && this.client) {
        logger.info('Redis already connected');
        return this.client;
      }

      this.client = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password || undefined,
        db: config.redis.db,
        retryDelayOnFailover: config.redis.retryDelayOnFailover,
        maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
        lazyConnect: true,
        keepAlive: 30000,
        connectTimeout: 10000,
        commandTimeout: 5000,
      });

      // Event handlers
      this.client.on('connect', () => {
        this.isConnected = true;
        logger.info(`Redis connected to ${config.redis.host}:${config.redis.port}`);
      });

      this.client.on('ready', () => {
        logger.info('Redis ready for operations');
      });

      this.client.on('error', (error) => {
        this.isConnected = false;
        logger.error('Redis connection error:', error);
      });

      this.client.on('close', () => {
        this.isConnected = false;
        logger.warn('Redis connection closed');
      });

      this.client.on('reconnecting', () => {
        logger.info('Redis reconnecting...');
      });

      // Connect to Redis
      await this.client.connect();

      return this.client;
    } catch (error) {
      this.isConnected = false;
      logger.error('Redis connection failed:', error.message);
      
      if (config.nodeEnv === 'production') {
        throw error;
      }
      
      return null;
    }
  }

  async disconnect() {
    try {
      if (this.client) {
        await this.client.quit();
        this.isConnected = false;
        logger.info('Redis connection closed');
      }
    } catch (error) {
      logger.error('Error closing Redis connection:', error);
      throw error;
    }
  }

  getClient() {
    return this.client;
  }

  isConnectionReady() {
    return this.isConnected && this.client && this.client.status === 'ready';
  }

  // Cache operations with error handling
  async get(key) {
    try {
      if (!this.isConnectionReady()) {
        logger.warn('Redis not ready, skipping get operation');
        return null;
      }
      return await this.client.get(key);
    } catch (error) {
      logger.error(`Redis GET error for key ${key}:`, error);
      return null;
    }
  }

  async set(key, value, ttl = config.performance.cacheTtl) {
    try {
      if (!this.isConnectionReady()) {
        logger.warn('Redis not ready, skipping set operation');
        return false;
      }
      
      if (ttl) {
        await this.client.setex(key, ttl, value);
      } else {
        await this.client.set(key, value);
      }
      return true;
    } catch (error) {
      logger.error(`Redis SET error for key ${key}:`, error);
      return false;
    }
  }

  async del(key) {
    try {
      if (!this.isConnectionReady()) {
        logger.warn('Redis not ready, skipping delete operation');
        return false;
      }
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error(`Redis DEL error for key ${key}:`, error);
      return false;
    }
  }

  async increment(key, ttl = config.performance.cacheTtl) {
    try {
      if (!this.isConnectionReady()) {
        logger.warn('Redis not ready, skipping increment operation');
        return 0;
      }
      
      const result = await this.client.incr(key);
      if (ttl && result === 1) {
        await this.client.expire(key, ttl);
      }
      return result;
    } catch (error) {
      logger.error(`Redis INCR error for key ${key}:`, error);
      return 0;
    }
  }

  // Health check method
  async healthCheck() {
    try {
      if (!this.isConnectionReady()) {
        throw new Error('Redis not connected');
      }
      
      const pong = await this.client.ping();
      if (pong !== 'PONG') {
        throw new Error('Redis ping failed');
      }
      
      return { status: 'healthy', timestamp: new Date() };
    } catch (error) {
      return { 
        status: 'unhealthy', 
        error: error.message, 
        timestamp: new Date() 
      };
    }
  }
}

// Create singleton instance
const redisConnection = new RedisConnection();

// Export the connection function for backwards compatibility
export const connectToRedis = () => redisConnection.connect();
export const disconnectFromRedis = () => redisConnection.disconnect();
export const getRedisClient = () => redisConnection.getClient();
export const isRedisReady = () => redisConnection.isConnectionReady();
export const redisHealthCheck = () => redisConnection.healthCheck();

// Export convenient cache operations
export const cache = {
  get: (key) => redisConnection.get(key),
  set: (key, value, ttl) => redisConnection.set(key, value, ttl),
  del: (key) => redisConnection.del(key),
  increment: (key, ttl) => redisConnection.increment(key, ttl),
};

export default redisConnection;