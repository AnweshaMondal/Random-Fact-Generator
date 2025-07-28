import mongoose from 'mongoose';
import config from './index.js';
import logger from '../utils/logger.js';

class DatabaseConnection {
  constructor() {
    this.connection = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      // Avoid multiple connections
      if (this.isConnected) {
        logger.info('Database already connected');
        return this.connection;
      }

      const dbUri = config.nodeEnv === 'test' ? config.database.testUri : config.database.uri;
      
      mongoose.set('strictQuery', false);
      
      // Connection event handlers
      mongoose.connection.on('connected', () => {
        this.isConnected = true;
        logger.info(`MongoDB connected to ${dbUri}`);
      });

      mongoose.connection.on('error', (error) => {
        this.isConnected = false;
        logger.error('MongoDB connection error:', error);
      });

      mongoose.connection.on('disconnected', () => {
        this.isConnected = false;
        logger.warn('MongoDB disconnected');
      });

      // Graceful shutdown
      process.on('SIGINT', () => {
        mongoose.connection.close(() => {
          logger.info('MongoDB connection closed due to application termination');
          process.exit(0);
        });
      });

      this.connection = await mongoose.connect(dbUri, config.database.options);
      
      return this.connection;
    } catch (error) {
      this.isConnected = false;
      logger.error('MongoDB connection failed:', error.message);
      
      if (config.nodeEnv === 'production') {
        process.exit(1);
      }
      
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.connection) {
        await mongoose.connection.close();
        this.isConnected = false;
        logger.info('MongoDB connection closed');
      }
    } catch (error) {
      logger.error('Error closing MongoDB connection:', error);
      throw error;
    }
  }

  getConnection() {
    return this.connection;
  }

  isConnectionReady() {
    return this.isConnected && mongoose.connection.readyState === 1;
  }

  // Health check method
  async healthCheck() {
    try {
      if (!this.isConnectionReady()) {
        throw new Error('Database not connected');
      }
      
      // Simple ping to check connection
      await mongoose.connection.db.admin().ping();
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
const databaseConnection = new DatabaseConnection();

// Export the connection function for backwards compatibility
export const connectToDatabase = () => databaseConnection.connect();
export const disconnectFromDatabase = () => databaseConnection.disconnect();
export const getDatabaseConnection = () => databaseConnection.getConnection();
export const isDatabaseReady = () => databaseConnection.isConnectionReady();
export const databaseHealthCheck = () => databaseConnection.healthCheck();

export default databaseConnection;