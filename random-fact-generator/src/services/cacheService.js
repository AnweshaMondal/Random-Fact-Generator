import redis from 'redis';
import { promisify } from 'util';
import config from '../config/index.js';

const redisClient = redis.createClient(config.redis);

redisClient.on('error', (err) => {
  console.error('Redis error:', err);
});

const getAsync = promisify(redisClient.get).bind(redisClient);
const setAsync = promisify(redisClient.set).bind(redisClient);
const delAsync = promisify(redisClient.del).bind(redisClient);

export const cacheService = {
  get: async (key) => {
    const value = await getAsync(key);
    return value ? JSON.parse(value) : null;
  },

  set: async (key, value, expiration = 3600) => {
    await setAsync(key, JSON.stringify(value), 'EX', expiration);
  },

  del: async (key) => {
    await delAsync(key);
  },
};