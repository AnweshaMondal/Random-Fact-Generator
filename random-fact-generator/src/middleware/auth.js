import jwt from 'jsonwebtoken';
import ApiKey from '../models/ApiKey.js';
import User from '../models/User.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';

class AuthMiddleware {
  // API Key authentication middleware
  static async apiKeyAuth(req, res, next) {
    try {
      const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');

      if (!apiKey) {
        return res.status(401).json({
          status: 'error',
          message: 'API key is required',
          error_code: 'MISSING_API_KEY'
        });
      }

      // Find API key with populated user data
      const apiKeyRecord = await ApiKey.findByKey(apiKey);

      if (!apiKeyRecord) {
        logger.logSecurity('Invalid API Key Attempt', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          apiKey: apiKey.substring(0, 8) + '...'
        });

        return res.status(403).json({
          status: 'error',
          message: 'Invalid API key',
          error_code: 'INVALID_API_KEY'
        });
      }

      // Check if API key is valid for this request
      const clientIP = req.ip || req.connection.remoteAddress;
      const origin = req.get('Origin') || req.get('Referer');

      if (!apiKeyRecord.isValidForRequest(clientIP, origin)) {
        logger.logSecurity('API Key Access Denied', {
          keyId: apiKeyRecord._id,
          ip: clientIP,
          origin,
          reason: 'IP or origin restriction'
        });

        return res.status(403).json({
          status: 'error',
          message: 'API key not authorized for this request',
          error_code: 'ACCESS_DENIED'
        });
      }

      // Check user account status
      const user = apiKeyRecord.userId;
      if (!user || user.status !== 'active') {
        return res.status(403).json({
          status: 'error',
          message: 'User account is not active',
          error_code: 'INACTIVE_ACCOUNT'
        });
      }

      // Check if user can make requests (rate limits, plan limits)
      if (!user.canMakeRequest()) {
        return res.status(429).json({
          status: 'error',
          message: 'Request limit exceeded for your plan',
          error_code: 'LIMIT_EXCEEDED',
          remaining_requests: user.remainingRequests,
          reset_date: user.usage.monthly_reset_date
        });
      }

      // Attach user and API key to request
      req.user = user;
      req.apiKey = apiKeyRecord;
      req.clientIP = clientIP;

      // Track request start time for analytics
      req.requestStartTime = Date.now();

      next();
    } catch (error) {
      logger.logError(error, req, { middleware: 'apiKeyAuth' });
      return res.status(500).json({
        status: 'error',
        message: 'Authentication error',
        error_code: 'AUTH_ERROR'
      });
    }
  }

  // JWT authentication middleware (for user sessions)
  static async jwtAuth(req, res, next) {
    try {
      const token = req.headers['authorization']?.replace('Bearer ', '') ||
                   req.headers['x-auth-token'] ||
                   req.cookies?.token;

      if (!token) {
        return res.status(401).json({
          status: 'error',
          message: 'Authentication token is required',
          error_code: 'MISSING_TOKEN'
        });
      }

      // Verify JWT token
      const decoded = jwt.verify(token, config.jwt.secret);
      
      // Find user by ID
      const user = await User.findById(decoded.id).select('+security');
      
      if (!user) {
        return res.status(403).json({
          status: 'error',
          message: 'Invalid authentication token',
          error_code: 'INVALID_TOKEN'
        });
      }

      // Check if account is locked
      if (user.isAccountLocked()) {
        return res.status(423).json({
          status: 'error',
          message: 'Account is temporarily locked',
          error_code: 'ACCOUNT_LOCKED',
          unlock_time: user.security.locked_until
        });
      }

      // Check account status
      if (user.status !== 'active') {
        return res.status(403).json({
          status: 'error',
          message: 'Account is not active',
          error_code: 'INACTIVE_ACCOUNT'
        });
      }

      req.user = user;
      next();
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        return res.status(403).json({
          status: 'error',
          message: 'Invalid authentication token',
          error_code: 'INVALID_TOKEN'
        });
      }

      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          status: 'error',
          message: 'Authentication token has expired',
          error_code: 'TOKEN_EXPIRED'
        });
      }

      logger.logError(error, req, { middleware: 'jwtAuth' });
      return res.status(500).json({
        status: 'error',
        message: 'Authentication error',
        error_code: 'AUTH_ERROR'
      });
    }
  }

  // Optional authentication (for public endpoints with enhanced features for authenticated users)
  static async optionalAuth(req, res, next) {
    try {
      const apiKey = req.headers['x-api-key'];
      const jwtToken = req.headers['authorization']?.replace('Bearer ', '');

      if (apiKey) {
        // Try API key authentication
        return AuthMiddleware.apiKeyAuth(req, res, next);
      } else if (jwtToken) {
        // Try JWT authentication
        return AuthMiddleware.jwtAuth(req, res, next);
      } else {
        // No authentication provided - continue as anonymous user
        req.user = null;
        req.apiKey = null;
        next();
      }
    } catch (error) {
      // If optional auth fails, continue as anonymous user
      req.user = null;
      req.apiKey = null;
      next();
    }
  }

  // Admin role check middleware
  static requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Admin access required',
        error_code: 'INSUFFICIENT_PRIVILEGES'
      });
    }
    next();
  }

  // Moderator role check middleware
  static requireModerator(req, res, next) {
    if (!req.user || !['admin', 'moderator'].includes(req.user.role)) {
      return res.status(403).json({
        status: 'error',
        message: 'Moderator access required',
        error_code: 'INSUFFICIENT_PRIVILEGES'
      });
    }
    next();
  }

  // Plan feature check middleware
  static requireFeature(feature) {
    return (req, res, next) => {
      if (!req.user || !req.user.hasFeature(feature)) {
        return res.status(403).json({
          status: 'error',
          message: `This feature requires a plan that includes: ${feature}`,
          error_code: 'FEATURE_NOT_AVAILABLE',
          required_feature: feature,
          current_plan: req.user?.plan,
          upgrade_url: '/upgrade'
        });
      }
      next();
    };
  }

  // API endpoint permission check
  static requirePermission(endpoint) {
    return (req, res, next) => {
      if (!req.apiKey || !req.apiKey.hasPermission(endpoint)) {
        return res.status(403).json({
          status: 'error',
          message: `API key does not have permission for: ${endpoint}`,
          error_code: 'INSUFFICIENT_PERMISSIONS',
          required_permission: endpoint,
          available_permissions: req.apiKey?.permissions.endpoints || []
        });
      }
      next();
    };
  }

  // Request tracking middleware (to be used after authentication)
  static async trackRequest(req, res, next) {
    const originalSend = res.send;
    const originalJson = res.json;

    // Override response methods to track usage
    res.send = function(data) {
      trackRequestCompletion(req, res);
      return originalSend.call(this, data);
    };

    res.json = function(data) {
      trackRequestCompletion(req, res);
      return originalJson.call(this, data);
    };

    next();
  }
}

// Helper function to track request completion
async function trackRequestCompletion(req, res) {
  try {
    const responseTime = Date.now() - (req.requestStartTime || Date.now());
    const endpoint = req.route?.path || req.path;

    // Update user usage
    if (req.user && res.statusCode < 400) {
      await req.user.incrementUsage();
    }

    // Update API key usage and analytics
    if (req.apiKey && res.statusCode < 400) {
      await req.apiKey.incrementUsage(endpoint);
      await req.apiKey.updateResponseTime(responseTime);
    }

    // Record errors
    if (req.apiKey && res.statusCode >= 400) {
      await req.apiKey.recordError();
    }

    // Log successful requests
    if (res.statusCode < 400) {
      logger.logBusiness('API Request Completed', {
        endpoint,
        method: req.method,
        statusCode: res.statusCode,
        responseTime,
        userId: req.user?._id,
        apiKeyId: req.apiKey?._id,
        ip: req.ip
      });
    }
  } catch (error) {
    logger.logError(error, req, { operation: 'track_request_completion' });
  }
}

// Export individual middleware functions for backward compatibility
export const apiKeyAuth = AuthMiddleware.apiKeyAuth;
export const jwtAuth = AuthMiddleware.jwtAuth;
export const optionalAuth = AuthMiddleware.optionalAuth;
export const requireAdmin = AuthMiddleware.requireAdmin;
export const requireModerator = AuthMiddleware.requireModerator;
export const requireFeature = AuthMiddleware.requireFeature;
export const requirePermission = AuthMiddleware.requirePermission;
export const trackRequest = AuthMiddleware.trackRequest;

export default AuthMiddleware;