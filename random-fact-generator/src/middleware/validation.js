import { validationResult } from 'express-validator';
import logger from '../utils/logger.js';

/**
 * Middleware to handle validation results from express-validator
 */
export const validateRequest = (validations) => {
  return async (req, res, next) => {
    // Run all validations
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(error => ({
        field: error.path || error.param,
        message: error.msg,
        value: error.value
      }));

      logger.logSecurity('Validation Error', {
        endpoint: req.originalUrl,
        method: req.method,
        errors: errorMessages,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        error_code: 'VALIDATION_ERROR',
        errors: errorMessages,
        timestamp: new Date().toISOString()
      });
    }

    next();
  };
};

/**
 * Sanitize input data to prevent XSS and injection attacks
 */
export const sanitizeInput = (req, res, next) => {
  const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    
    // Remove HTML tags and potentially dangerous characters
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]*>/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
  };

  const sanitizeObject = (obj) => {
    if (typeof obj !== 'object' || obj === null) return obj;
    
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = sanitizeString(value);
      } else if (typeof value === 'object') {
        sanitized[key] = sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  };

  // Sanitize request body
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  next();
};

/**
 * Request size limiter
 */
export const limitRequestSize = (maxSize = '10mb') => {
  return (req, res, next) => {
    const contentLength = req.get('content-length');
    
    if (contentLength) {
      const sizeInBytes = parseInt(contentLength);
      const maxSizeInBytes = parseSize(maxSize);
      
      if (sizeInBytes > maxSizeInBytes) {
        return res.status(413).json({
          status: 'error',
          message: 'Request entity too large',
          error_code: 'REQUEST_TOO_LARGE',
          max_size: maxSize
        });
      }
    }
    
    next();
  };
};

/**
 * Parse size string to bytes
 */
function parseSize(size) {
  const units = {
    'b': 1,
    'kb': 1024,
    'mb': 1024 * 1024,
    'gb': 1024 * 1024 * 1024
  };
  
  const match = size.toString().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*([kmg]?b)$/);
  if (!match) return 0;
  
  const value = parseFloat(match[1]);
  const unit = match[2];
  
  return Math.floor(value * (units[unit] || 1));
}

export default {
  validateRequest,
  sanitizeInput,
  limitRequestSize
};
