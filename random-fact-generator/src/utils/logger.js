import winston from 'winston';
import config from '../config/index.js';

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    
    // Add stack trace for errors
    if (stack) {
      log += `\n${stack}`;
    }
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      log += `\n${JSON.stringify(meta, null, 2)}`;
    }
    
    return log;
  })
);

// Define file format (without colors for file logs)
const fileFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create transports array
const transports = [
  // Console transport
  new winston.transports.Console({
    level: config.nodeEnv === 'development' ? 'debug' : 'info',
    format: logFormat,
    handleExceptions: true,
    handleRejections: true
  })
];

// Add file transports for production
if (config.nodeEnv === 'production') {
  transports.push(
    // Error logs
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      handleExceptions: true,
      handleRejections: true
    }),
    // Combined logs
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // Access logs
    new winston.transports.File({
      filename: 'logs/access.log',
      level: 'info',
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  );
}

// Create logger instance
const logger = winston.createLogger({
  level: config.logging?.level || 'info',
  format: fileFormat,
  transports,
  exitOnError: false,
  // Silent during testing
  silent: config.nodeEnv === 'test'
});

// Add request logging helper
logger.logRequest = (req, res, responseTime) => {
  const { method, url, ip } = req;
  const { statusCode } = res;
  const userAgent = req.get('User-Agent') || 'Unknown';
  
  logger.info('HTTP Request', {
    method,
    url,
    ip,
    statusCode,
    responseTime: `${responseTime}ms`,
    userAgent,
    timestamp: new Date().toISOString()
  });
};

// Add error logging helper
logger.logError = (error, req = null, additionalInfo = {}) => {
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
    ...additionalInfo
  };
  
  if (req) {
    errorInfo.request = {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id,
      apiKey: req.apiKey?.id
    };
  }
  
  logger.error('Application Error', errorInfo);
};

// Add performance logging helper
logger.logPerformance = (operation, duration, metadata = {}) => {
  logger.info('Performance Metric', {
    operation,
    duration: `${duration}ms`,
    timestamp: new Date().toISOString(),
    ...metadata
  });
};

// Add security logging helper
logger.logSecurity = (event, details = {}) => {
  logger.warn('Security Event', {
    event,
    timestamp: new Date().toISOString(),
    ...details
  });
};

// Add business logic logging helper
logger.logBusiness = (event, data = {}) => {
  logger.info('Business Event', {
    event,
    timestamp: new Date().toISOString(),
    ...data
  });
};

// Handle uncaught exceptions and unhandled rejections
if (config.nodeEnv === 'production') {
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    process.exit(1);
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Promise Rejection', {
      reason: reason?.message || reason,
      stack: reason?.stack,
      promise: promise.toString(),
      timestamp: new Date().toISOString()
    });
  });
}

export default logger;