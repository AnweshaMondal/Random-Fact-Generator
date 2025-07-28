#!/usr/bin/env node

import dotenv from 'dotenv';
import { connectToDatabase, databaseHealthCheck } from '../src/config/database.js';
import { connectToRedis, redisHealthCheck } from '../src/config/redis.js';
import aiService from '../src/services/aiService.js';
import logger from '../src/utils/logger.js';
import config from '../src/config/index.js';

// Load environment variables
dotenv.config();

class HealthChecker {
  constructor() {
    this.checks = new Map();
    this.overallStatus = 'unknown';
  }

  async runCheck(name, checkFunction, critical = true) {
    const startTime = Date.now();
    
    try {
      logger.info(`🔍 Running ${name} health check...`);
      const result = await checkFunction();
      const duration = Date.now() - startTime;
      
      const status = {
        name,
        status: result.status || 'healthy',
        duration: `${duration}ms`,
        details: result,
        critical,
        timestamp: new Date().toISOString()
      };
      
      this.checks.set(name, status);
      
      if (status.status === 'healthy') {
        logger.info(`✅ ${name}: Healthy (${duration}ms)`);
      } else {
        logger.warn(`⚠️  ${name}: ${status.status} (${duration}ms)`);
      }
      
      return status;
    } catch (error) {
      const duration = Date.now() - startTime;
      const status = {
        name,
        status: 'unhealthy',
        duration: `${duration}ms`,
        error: error.message,
        critical,
        timestamp: new Date().toISOString()
      };
      
      this.checks.set(name, status);
      logger.error(`❌ ${name}: Failed (${duration}ms) - ${error.message}`);
      
      return status;
    }
  }

  async runAllChecks() {
    logger.info('🏥 Starting comprehensive health check...');
    
    // Database health check
    await this.runCheck('Database', async () => {
      await connectToDatabase();
      return await databaseHealthCheck();
    }, true);
    
    // Redis health check
    await this.runCheck('Redis', async () => {
      await connectToRedis();
      return await redisHealthCheck();
    }, false); // Non-critical since app can work without Redis
    
    // AI Service health check
    await this.runCheck('AI Service', async () => {
      if (!config.ai.enabled) {
        return { status: 'disabled', message: 'AI service is disabled' };
      }
      return await aiService.healthCheck();
    }, false);
    
    // Environment check
    await this.runCheck('Environment', async () => {
      const requiredVars = ['NODE_ENV', 'MONGODB_URI', 'JWT_SECRET'];
      const missing = requiredVars.filter(varName => !process.env[varName]);
      
      if (missing.length > 0) {
        throw new Error(`Missing environment variables: ${missing.join(', ')}`);
      }
      
      return {
        status: 'healthy',
        node_env: process.env.NODE_ENV,
        node_version: process.version,
        platform: process.platform,
        uptime: process.uptime()
      };
    }, true);
    
    // Memory check
    await this.runCheck('Memory', async () => {
      const memoryUsage = process.memoryUsage();
      const totalMemoryMB = Math.round(memoryUsage.rss / 1024 / 1024);
      const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
      
      // Warning if using more than 500MB
      const status = totalMemoryMB > 500 ? 'warning' : 'healthy';
      
      return {
        status,
        memory_usage: {
          rss: `${totalMemoryMB}MB`,
          heap_used: `${heapUsedMB}MB`,
          heap_total: `${heapTotalMB}MB`,
          external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`
        }
      };
    }, false);
    
    // Disk space check (basic)
    await this.runCheck('Disk Space', async () => {
      const fs = await import('fs/promises');
      try {
        await fs.access('./logs', fs.constants.W_OK);
        return { status: 'healthy', message: 'Write access available' };
      } catch (error) {
        return { status: 'warning', message: 'Limited write access' };
      }
    }, false);
    
    this.calculateOverallStatus();
    this.printSummary();
    
    return this.getResults();
  }

  calculateOverallStatus() {
    const criticalChecks = Array.from(this.checks.values()).filter(check => check.critical);
    const allChecks = Array.from(this.checks.values());
    
    const criticalFailed = criticalChecks.some(check => check.status === 'unhealthy');
    const anyWarnings = allChecks.some(check => check.status === 'warning');
    
    if (criticalFailed) {
      this.overallStatus = 'unhealthy';
    } else if (anyWarnings) {
      this.overallStatus = 'degraded';
    } else {
      this.overallStatus = 'healthy';
    }
  }

  printSummary() {
    logger.info('\n📊 Health Check Summary:');
    logger.info('═'.repeat(50));
    
    Array.from(this.checks.values()).forEach(check => {
      const icon = check.status === 'healthy' ? '✅' : 
                   check.status === 'warning' ? '⚠️' : '❌';
      const critical = check.critical ? ' (Critical)' : '';
      
      logger.info(`${icon} ${check.name}${critical}: ${check.status} (${check.duration})`);
      
      if (check.error) {
        logger.info(`   Error: ${check.error}`);
      }
    });
    
    logger.info('═'.repeat(50));
    
    const statusIcon = this.overallStatus === 'healthy' ? '🟢' : 
                       this.overallStatus === 'degraded' ? '🟡' : '🔴';
    
    logger.info(`${statusIcon} Overall Status: ${this.overallStatus.toUpperCase()}`);
    
    if (this.overallStatus === 'unhealthy') {
      logger.warn('⚠️  Application may not function properly');
      process.exitCode = 1;
    } else if (this.overallStatus === 'degraded') {
      logger.warn('⚠️  Application running with reduced functionality');
    } else {
      logger.info('🎉 All systems operational');
    }
  }

  getResults() {
    return {
      overall_status: this.overallStatus,
      timestamp: new Date().toISOString(),
      checks: Object.fromEntries(this.checks),
      environment: process.env.NODE_ENV || 'unknown',
      version: process.env.npm_package_version || '1.0.0'
    };
  }
}

// CLI execution
async function runHealthCheck() {
  const checker = new HealthChecker();
  
  try {
    const results = await checker.runAllChecks();
    
    // Output JSON for programmatic use
    if (process.argv.includes('--json')) {
      console.log(JSON.stringify(results, null, 2));
    }
    
    // Exit with appropriate code
    process.exit(results.overall_status === 'unhealthy' ? 1 : 0);
    
  } catch (error) {
    logger.error('❌ Health check failed:', error);
    process.exit(1);
  }
}

// Export for use in other modules
export default HealthChecker;

// Run if called directly
if (process.argv[1].endsWith('healthCheck.js')) {
  runHealthCheck();
}
