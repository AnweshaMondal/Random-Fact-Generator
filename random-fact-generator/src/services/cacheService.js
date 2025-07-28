import { cache } from '../config/redis.js';
import logger from '../utils/logger.js';
import config from '../config/index.js';

class CacheService {
  constructor() {
    this.defaultTTL = config.performance.cacheTtl;
    this.keyPrefix = 'rfg:'; // Random Fact Generator prefix
  }

  // Generate cache key with prefix
  generateKey(key) {
    return `${this.keyPrefix}${key}`;
  }

  // Get value from cache
  async get(key) {
    try {
      const cacheKey = this.generateKey(key);
      const value = await cache.get(cacheKey);
      
      if (value) {
        logger.debug('Cache hit', { key: cacheKey });
        return JSON.parse(value);
      }
      
      logger.debug('Cache miss', { key: cacheKey });
      return null;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  // Set value in cache
  async set(key, value, ttl = this.defaultTTL) {
    try {
      const cacheKey = this.generateKey(key);
      const success = await cache.set(cacheKey, JSON.stringify(value), ttl);
      
      if (success) {
        logger.debug('Cache set successful', { key: cacheKey, ttl });
      }
      
      return success;
    } catch (error) {
      logger.error('Cache set error:', error);
      return false;
    }
  }

  // Delete value from cache
  async del(key) {
    try {
      const cacheKey = this.generateKey(key);
      const success = await cache.del(cacheKey);
      
      if (success) {
        logger.debug('Cache delete successful', { key: cacheKey });
      }
      
      return success;
    } catch (error) {
      logger.error('Cache delete error:', error);
      return false;
    }
  }

  // Increment counter in cache
  async increment(key, ttl = this.defaultTTL) {
    try {
      const cacheKey = this.generateKey(key);
      const result = await cache.increment(cacheKey, ttl);
      
      logger.debug('Cache increment', { key: cacheKey, result });
      return result;
    } catch (error) {
      logger.error('Cache increment error:', error);
      return 0;
    }
  }

  // Get multiple values
  async mget(keys) {
    try {
      const cacheKeys = keys.map(key => this.generateKey(key));
      const values = await Promise.all(
        cacheKeys.map(key => cache.get(key))
      );
      
      const result = {};
      keys.forEach((originalKey, index) => {
        const value = values[index];
        result[originalKey] = value ? JSON.parse(value) : null;
      });
      
      return result;
    } catch (error) {
      logger.error('Cache mget error:', error);
      return {};
    }
  }

  // Set multiple values
  async mset(keyValuePairs, ttl = this.defaultTTL) {
    try {
      const promises = Object.entries(keyValuePairs).map(([key, value]) =>
        this.set(key, value, ttl)
      );
      
      const results = await Promise.all(promises);
      return results.every(result => result === true);
    } catch (error) {
      logger.error('Cache mset error:', error);
      return false;
    }
  }

  // Check if key exists
  async exists(key) {
    try {
      const value = await this.get(key);
      return value !== null;
    } catch (error) {
      logger.error('Cache exists error:', error);
      return false;
    }
  }

  // Cache with refresh strategy
  async getOrSet(key, fetchFunction, ttl = this.defaultTTL) {
    try {
      // Try to get from cache first
      let value = await this.get(key);
      
      if (value !== null) {
        return value;
      }
      
      // If not in cache, fetch using the provided function
      logger.debug('Cache miss, fetching data', { key });
      value = await fetchFunction();
      
      if (value !== null && value !== undefined) {
        await this.set(key, value, ttl);
      }
      
      return value;
    } catch (error) {
      logger.error('Cache getOrSet error:', error);
      // Fallback to fetch function
      try {
        return await fetchFunction();
      } catch (fetchError) {
        logger.error('Fetch function error:', fetchError);
        throw fetchError;
      }
    }
  }

  // Cache with tags for easy invalidation
  async setWithTags(key, value, tags = [], ttl = this.defaultTTL) {
    try {
      // Set the main value
      await this.set(key, value, ttl);
      
      // Set tag associations
      for (const tag of tags) {
        const tagKey = `tag:${tag}`;
        let taggedKeys = await this.get(tagKey) || [];
        
        if (!taggedKeys.includes(key)) {
          taggedKeys.push(key);
          await this.set(tagKey, taggedKeys, ttl);
        }
      }
      
      return true;
    } catch (error) {
      logger.error('Cache setWithTags error:', error);
      return false;
    }
  }

  // Invalidate by tags
  async invalidateByTag(tag) {
    try {
      const tagKey = `tag:${tag}`;
      const taggedKeys = await this.get(tagKey);
      
      if (taggedKeys && Array.isArray(taggedKeys)) {
        const deletePromises = taggedKeys.map(key => this.del(key));
        await Promise.all(deletePromises);
        
        // Delete the tag itself
        await this.del(tagKey);
        
        logger.info('Cache invalidated by tag', { tag, keysCount: taggedKeys.length });
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Cache invalidateByTag error:', error);
      return false;
    }
  }

  // Clear all cache (use with caution)
  async clear() {
    try {
      logger.warn('Clearing all cache - this should only be used in development');
      // Note: This is a simplified clear - in production you'd want to scan keys with prefix
      return true;
    } catch (error) {
      logger.error('Cache clear error:', error);
      return false;
    }
  }

  // Get cache statistics
  async getStats() {
    try {
      // This would need to be implemented based on your Redis setup
      // For now, return basic info
      return {
        status: 'active',
        prefix: this.keyPrefix,
        defaultTTL: this.defaultTTL
      };
    } catch (error) {
      logger.error('Cache getStats error:', error);
      return { status: 'error' };
    }
  }
}

// Create singleton instance
const cacheService = new CacheService();

// Legacy exports for backward compatibility
export const getCachedFact = (key) => cacheService.get(key);
export const setCachedFact = (key, value, ttl) => cacheService.set(key, value, ttl);
export const deleteCachedFact = (key) => cacheService.del(key);

export default cacheService;