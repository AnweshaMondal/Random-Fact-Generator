import rateLimit from 'express-rate-limit';
import { cache } from '../config/redis.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';

class RateLimiter {
  // General rate limiter for unauthenticated requests
  static general = rateLimit({
    windowMs: config.rateLimit.windowMs, // 15 minutes default
    max: config.rateLimit.maxRequests, // 100 requests default
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: 'error',
      message: 'Too many requests, please try again later',
      error_code: 'RATE_LIMIT_EXCEEDED',
      retry_after: config.rateLimit.windowMs / 1000
    },
    skip: (req) => {
      // Skip rate limiting for authenticated users (they have their own limits)
      return !!(req.headers['x-api-key'] || req.headers['authorization']);
    },
    onLimitReached: (req, res) => {
      logger.logSecurity('Rate Limit Exceeded', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.originalUrl
      });
    }
  });

  // Strict rate limiter for sensitive endpoints
  static strict = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5, // 5 requests per minute
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: 'error',
      message: 'Rate limit exceeded for sensitive endpoint',
      error_code: 'STRICT_RATE_LIMIT_EXCEEDED'
    },
    onLimitReached: (req, res) => {
      logger.logSecurity('Strict Rate Limit Exceeded', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.originalUrl,
        severity: 'high'
      });
    }
  });

  // Custom rate limiter for authenticated users based on their plan
  static async customRateLimit(req, res, next) {
    try {
      // Skip if no API key (handled by general rate limiter)
      if (!req.apiKey) {
        return next();
      }

      const keyId = req.apiKey._id.toString();
      const now = new Date();
      const windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), Math.floor(now.getMinutes() / 15) * 15);
      const cacheKey = `rate_limit:${keyId}:${windowStart.getTime()}`;

      // Get current request count
      let requestCount = await cache.get(cacheKey);
      requestCount = requestCount ? parseInt(requestCount) : 0;

      // Get rate limit for this API key/user
      const rateLimit = RateLimiter.getRateLimitForUser(req.user, req.apiKey);
      
      // Check if limit exceeded
      if (requestCount >= rateLimit.max) {
        logger.logSecurity('User Rate Limit Exceeded', {
          userId: req.user._id,
          apiKeyId: req.apiKey._id,
          currentCount: requestCount,
          limit: rateLimit.max,
          plan: req.user.plan
        });

        return res.status(429).json({
          status: 'error',
          message: 'Rate limit exceeded for your plan',
          error_code: 'USER_RATE_LIMIT_EXCEEDED',
          current_usage: requestCount,
          limit: rateLimit.max,
          window_minutes: rateLimit.windowMinutes,
          reset_time: new Date(windowStart.getTime() + (rateLimit.windowMinutes * 60 * 1000)),
          plan: req.user.plan,
          upgrade_url: req.user.plan === 'basic' ? '/upgrade' : undefined
        });
      }

      // Increment counter
      await cache.increment(cacheKey, rateLimit.windowMinutes * 60);
      
      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': rateLimit.max,
        'X-RateLimit-Remaining': Math.max(0, rateLimit.max - requestCount - 1),
        'X-RateLimit-Reset': new Date(windowStart.getTime() + (rateLimit.windowMinutes * 60 * 1000)).toISOString()
      });

      next();
    } catch (error) {
      logger.logError(error, req, { middleware: 'customRateLimit' });
      // On error, allow the request to continue (fail open)
      next();
    }
  }

  // AI endpoint rate limiter (more restrictive)
  static async aiRateLimit(req, res, next) {
    try {
      if (!req.user) {
        return res.status(401).json({
          status: 'error',
          message: 'Authentication required for AI endpoints'
        });
      }

      // Check if user has AI features
      if (!req.user.hasFeature('ai_facts')) {
        return res.status(403).json({
          status: 'error',
          message: 'AI features require Premium or Platinum plan',
          upgrade_url: '/upgrade'
        });
      }

      const userId = req.user._id.toString();
      const now = Date.now();
      const windowStart = now - (now % (60 * 1000)); // 1-minute windows
      const cacheKey = `ai_rate_limit:${userId}:${windowStart}`;

      let requestCount = await cache.get(cacheKey);
      requestCount = requestCount ? parseInt(requestCount) : 0;

      // AI rate limits based on plan
      const aiLimits = {
        basic: { max: 0, windowMinutes: 1 }, // No AI access
        premium: { max: 10, windowMinutes: 1 }, // 10 per minute
        platinum: { max: 50, windowMinutes: 1 } // 50 per minute
      };

      const limit = aiLimits[req.user.plan] || aiLimits.basic;

      if (requestCount >= limit.max) {
        return res.status(429).json({
          status: 'error',
          message: 'AI rate limit exceeded',
          error_code: 'AI_RATE_LIMIT_EXCEEDED',
          current_usage: requestCount,
          limit: limit.max,
          plan: req.user.plan
        });
      }

      await cache.increment(cacheKey, 60); // 1-minute TTL

      res.set({
        'X-AI-RateLimit-Limit': limit.max,
        'X-AI-RateLimit-Remaining': Math.max(0, limit.max - requestCount - 1)
      });

      next();
    } catch (error) {
      logger.logError(error, req, { middleware: 'aiRateLimit' });
      next();
    }
  }

  // Bulk operation rate limiter
  static async bulkOperationLimit(req, res, next) {
    try {
      if (!req.user) {
        return res.status(401).json({
          status: 'error',
          message: 'Authentication required for bulk operations'
        });
      }

      const userId = req.user._id.toString();
      const now = Date.now();
      const windowStart = now - (now % (60 * 60 * 1000)); // 1-hour windows
      const cacheKey = `bulk_limit:${userId}:${windowStart}`;

      let operationCount = await cache.get(cacheKey);
      operationCount = operationCount ? parseInt(operationCount) : 0;

      // Bulk operation limits
      const bulkLimits = {
        basic: { max: 1, windowHours: 1 },
        premium: { max: 10, windowHours: 1 },
        platinum: { max: 100, windowHours: 1 }
      };

      const limit = bulkLimits[req.user.plan] || bulkLimits.basic;

      if (operationCount >= limit.max) {
        return res.status(429).json({
          status: 'error',
          message: 'Bulk operation limit exceeded',
          error_code: 'BULK_LIMIT_EXCEEDED',
          current_usage: operationCount,
          limit: limit.max,
          plan: req.user.plan
        });
      }

      await cache.increment(cacheKey, 60 * 60); // 1-hour TTL

      next();
    } catch (error) {
      logger.logError(error, req, { middleware: 'bulkOperationLimit' });
      next();
    }
  }

  // Helper method to get rate limit configuration for user
  static getRateLimitForUser(user, apiKey) {
    // Check for API key specific override
    if (apiKey.permissions.rate_limit_override) {
      return {
        max: apiKey.permissions.rate_limit_override,
        windowMinutes: 15
      };
    }

    // Plan-based limits
    const planLimits = {
      basic: {
        max: 100, // 100 requests per 15 minutes
        windowMinutes: 15
      },
      premium: {
        max: 1000, // 1000 requests per 15 minutes
        windowMinutes: 15
      },
      platinum: {
        max: 10000, // 10000 requests per 15 minutes (effectively unlimited for most use cases)
        windowMinutes: 15
      }
    };

    return planLimits[user.plan] || planLimits.basic;
  }

  // Dynamic rate limiter that adjusts based on system load
  static async adaptiveRateLimit(req, res, next) {
    try {
      // This could integrate with system metrics to adjust rates
      // For now, use standard rate limiting
      return RateLimiter.customRateLimit(req, res, next);
    } catch (error) {
      logger.logError(error, req, { middleware: 'adaptiveRateLimit' });
      next();
    }
  }

  // Rate limiter for login attempts
  static loginAttemptLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 login attempts per 15 minutes per IP
    skipSuccessfulRequests: true,
    message: {
      status: 'error',
      message: 'Too many login attempts, please try again later',
      error_code: 'LOGIN_RATE_LIMIT_EXCEEDED'
    },
    onLimitReached: (req, res) => {
      logger.logSecurity('Login Rate Limit Exceeded', {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
    }
  });

  // Rate limiter for password reset requests
  static passwordResetLimit = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 password reset attempts per hour per IP
    message: {
      status: 'error',
      message: 'Too many password reset attempts, please try again later',
      error_code: 'PASSWORD_RESET_RATE_LIMIT_EXCEEDED'
    },
    onLimitReached: (req, res) => {
      logger.logSecurity('Password Reset Rate Limit Exceeded', {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
    }
  });
}

// Export rate limiting middleware
export const generalRateLimit = RateLimiter.general;
export const strictRateLimit = RateLimiter.strict;
export const customRateLimit = RateLimiter.customRateLimit;
export const aiRateLimit = RateLimiter.aiRateLimit;
export const bulkOperationLimit = RateLimiter.bulkOperationLimit;
export const adaptiveRateLimit = RateLimiter.adaptiveRateLimit;
export const loginAttemptLimit = RateLimiter.loginAttemptLimit;
export const passwordResetLimit = RateLimiter.passwordResetLimit;

export default RateLimiter;
        .then(plan => {
            if (rateLimits[plan]) {
                rateLimits[plan](req, res, next);
            } else {
                return res.status(403).json({ message: 'Invalid plan.' });
            }
        })
        .catch(err => {
            return res.status(500).json({ message: 'Error retrieving user plan.', error: err });
        });
};

module.exports = applyRateLimit;