import factService from '../services/factService.js';
import logger from '../utils/logger.js';

class FactController {
  async getRandomFact(req, res, next) {
    try {
      const startTime = Date.now();
      const { category } = req.query;
      
      const options = {
        category: category?.toLowerCase(),
        forceNew: req.query.force_new === 'true'
      };

      const fact = await factService.getRandomFact(options);
      const responseTime = Date.now() - startTime;
      
      res.status(200).json({
        status: 'success',
        data: fact,
        meta: {
          response_time: responseTime,
          source: fact.ai_generated ? 'ai' : 'database'
        }
      });

      logger.logRequest(req, res, responseTime);
      
    } catch (error) {
      logger.logError(error, req);
      res.status(500).json({
        status: 'error',
        message: error.message || 'Internal server error',
        error_code: 'INTERNAL_ERROR'
      });
    }
  }

  async getFactByCategory(req, res, next) {
    try {
      const startTime = Date.now();
      const { category } = req.params;

      const fact = await factService.getFactByCategory(category.toLowerCase());
      const responseTime = Date.now() - startTime;

      res.status(200).json({
        status: 'success',
        data: fact,
        meta: {
          category,
          response_time: responseTime,
          source: fact.ai_generated ? 'ai' : 'database'
        }
      });

      logger.logRequest(req, res, responseTime);
      
    } catch (error) {
      logger.logError(error, req);
      res.status(500).json({
        status: 'error',
        message: error.message || 'Internal server error',
        error_code: 'INTERNAL_ERROR'
      });
    }
  }

  async getCategories(req, res, next) {
    try {
      const categories = factService.getCategories();
      const stats = await factService.getFactStats();

      res.status(200).json({
        status: 'success',
        data: {
          categories,
          category_stats: stats.byCategory,
          total_stats: stats.total
        }
      });
      
    } catch (error) {
      logger.logError(error, req);
      res.status(500).json({
        status: 'error',
        message: error.message || 'Internal server error',
        error_code: 'INTERNAL_ERROR'
      });
    }
  }
}

const factController = new FactController();

export default factController;
