import factService from '../services/factService.js';
import aiService from '../services/aiService.js';
import logger from '../utils/logger.js';
import { validateFactInput, validatePaginationParams } from '../utils/validators.js';

class FactController {
  /**
   * @swagger
   * /api/v1/facts/random:
   *   get:
   *     summary: Get a random fact
   *     tags: [Facts]
   *     security:
   *       - ApiKeyAuth: []
   *     parameters:
   *       - in: query
   *         name: category
   *         schema:
   *           type: string
   *         description: Optional category filter
   *       - in: query
   *         name: ai_fallback
   *         schema:
   *           type: boolean
   *         description: Enable AI fallback if no database fact found
   *     responses:
   *       200:
   *         description: Random fact retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                   example: success
   *                 data:
   *                   $ref: '#/components/schemas/Fact'
   *                 meta:
   *                   type: object
   *                   properties:
   *                     response_time:
   *                       type: number
   *                     source:
   *                       type: string
   */
  async getRandomFact(req, res, next) {
    try {
      const startTime = Date.now();
      const { category, ai_fallback } = req.query;
      
      const options = {
        category: category?.toLowerCase(),
        forceNew: req.query.force_new === 'true',
        saveAIFacts: ai_fallback !== 'false'
      };

      const fact = await factService.getRandomFact(options);
      
      // Increment view count
      if (fact._id) {
        await fact.incrementViews();
      }

      const responseTime = Date.now() - startTime;
      
      res.status(200).json({
        status: 'success',
        data: fact,
        meta: {
          response_time: responseTime,
          source: fact.ai_generated ? 'ai' : 'database',
          cached: false
        }
      });

      // Log the request
      logger.logRequest(req, res, responseTime);
      
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /api/v1/facts/category/{category}:
   *   get:
   *     summary: Get a random fact from a specific category
   *     tags: [Facts]
   *     security:
   *       - ApiKeyAuth: []
   *     parameters:
   *       - in: path
   *         name: category
   *         required: true
   *         schema:
   *           type: string
   *         description: The fact category
   *     responses:
   *       200:
   *         description: Category fact retrieved successfully
   */
  async getFactByCategory(req, res, next) {
    try {
      const startTime = Date.now();
      const { category } = req.params;
      const { exclude_ai } = req.query;

      const options = {
        excludeAI: exclude_ai === 'true'
      };

      const fact = await factService.getFactByCategory(category.toLowerCase(), options);
      
      // Increment view count
      if (fact._id) {
        await fact.incrementViews();
      }

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
      next(error);
    }
  }

  /**
   * @swagger
   * /api/v1/facts:
   *   get:
   *     summary: Get paginated list of facts
   *     tags: [Facts]
   *     security:
   *       - ApiKeyAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           minimum: 1
   *         description: Page number
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *         description: Items per page
   *       - in: query
   *         name: category
   *         schema:
   *           type: string
   *         description: Filter by category
   *       - in: query
   *         name: verified
   *         schema:
   *           type: boolean
   *         description: Filter by verification status
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *         description: Search facts by text
   */
  async getFacts(req, res, next) {
    try {
      const startTime = Date.now();
      
      // Validate pagination parameters
      const validationResult = validatePaginationParams(req.query);
      if (!validationResult.isValid) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid parameters',
          errors: validationResult.errors
        });
      }

      const options = {
        page: parseInt(req.query.page) || 1,
        limit: Math.min(parseInt(req.query.limit) || 10, 100),
        category: req.query.category?.toLowerCase(),
        verified: req.query.verified !== undefined ? req.query.verified === 'true' : true,
        search: req.query.search,
        sortBy: req.query.sort_by || 'created_at',
        sortOrder: req.query.sort_order || 'desc'
      };

      const result = await factService.getFacts(options);
      const responseTime = Date.now() - startTime;

      res.status(200).json({
        status: 'success',
        data: result.facts,
        pagination: result.pagination,
        meta: {
          response_time: responseTime,
          filters_applied: {
            category: options.category,
            verified: options.verified,
            search: options.search
          }
        }
      });

      logger.logRequest(req, res, responseTime);
      
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /api/v1/facts:
   *   post:
   *     summary: Create a new fact
   *     tags: [Facts]
   *     security:
   *       - ApiKeyAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - fact
   *               - category
   *             properties:
   *               fact:
   *                 type: string
   *                 minLength: 10
   *                 maxLength: 1000
   *               category:
   *                 type: string
   *               source:
   *                 type: string
   *               tags:
   *                 type: array
   *                 items:
   *                   type: string
   */
  async createFact(req, res, next) {
    try {
      const startTime = Date.now();
      
      // Validate input
      const validationResult = validateFactInput(req.body);
      if (!validationResult.isValid) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid fact data',
          errors: validationResult.errors
        });
      }

      const factData = {
        ...req.body,
        created_by: req.user?.id,
        category: req.body.category.toLowerCase()
      };

      const newFact = await factService.addFact(factData);
      const responseTime = Date.now() - startTime;

      res.status(201).json({
        status: 'success',
        data: newFact,
        meta: {
          response_time: responseTime,
          message: 'Fact created successfully'
        }
      });

      logger.logBusiness('Fact Created', {
        factId: newFact._id,
        category: newFact.category,
        userId: req.user?.id
      });
      
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /api/v1/facts/{id}:
   *   put:
   *     summary: Update an existing fact
   *     tags: [Facts]
   *     security:
   *       - ApiKeyAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   */
  async updateFact(req, res, next) {
    try {
      const startTime = Date.now();
      const { id } = req.params;

      // Validate input if fact content is being updated
      if (req.body.fact || req.body.category) {
        const validationResult = validateFactInput(req.body, false);
        if (!validationResult.isValid) {
          return res.status(400).json({
            status: 'error',
            message: 'Invalid fact data',
            errors: validationResult.errors
          });
        }
      }

      const updateData = {
        ...req.body,
        updated_by: req.user?.id
      };

      if (updateData.category) {
        updateData.category = updateData.category.toLowerCase();
      }

      const updatedFact = await factService.updateFact(id, updateData);
      const responseTime = Date.now() - startTime;

      res.status(200).json({
        status: 'success',
        data: updatedFact,
        meta: {
          response_time: responseTime,
          message: 'Fact updated successfully'
        }
      });

      logger.logBusiness('Fact Updated', {
        factId: id,
        userId: req.user?.id
      });
      
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /api/v1/facts/{id}:
   *   delete:
   *     summary: Delete a fact
   *     tags: [Facts]
   *     security:
   *       - ApiKeyAuth: []
   */
  async deleteFact(req, res, next) {
    try {
      const { id } = req.params;

      const deletedFact = await factService.deleteFact(id);

      res.status(200).json({
        status: 'success',
        data: {
          id: deletedFact._id,
          fact: deletedFact.fact
        },
        meta: {
          message: 'Fact deleted successfully'
        }
      });

      logger.logBusiness('Fact Deleted', {
        factId: id,
        userId: req.user?.id
      });
      
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /api/v1/facts/{id}/like:
   *   post:
   *     summary: Like a fact
   *     tags: [Facts]
   *     security:
   *       - ApiKeyAuth: []
   */
  async likeFact(req, res, next) {
    try {
      const { id } = req.params;
      
      // Find and update fact
      const Fact = (await import('../models/Fact.js')).default;
      const fact = await Fact.findById(id);
      
      if (!fact) {
        return res.status(404).json({
          status: 'error',
          message: 'Fact not found'
        });
      }

      await fact.addLike();

      res.status(200).json({
        status: 'success',
        data: {
          id: fact._id,
          likes: fact.likes,
          popularity_score: fact.popularity_score
        },
        meta: {
          message: 'Fact liked successfully'
        }
      });
      
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /api/v1/facts/categories:
   *   get:
   *     summary: Get available fact categories
   *     tags: [Facts]
   */
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
      next(error);
    }
  }

  /**
   * @swagger
   * /api/v1/facts/search:
   *   get:
   *     summary: Search facts by text
   *     tags: [Facts]
   */
  async searchFacts(req, res, next) {
    try {
      const startTime = Date.now();
      const { q: query, category, limit = 20 } = req.query;

      if (!query || query.trim().length < 3) {
        return res.status(400).json({
          status: 'error',
          message: 'Search query must be at least 3 characters long'
        });
      }

      const Fact = (await import('../models/Fact.js')).default;
      const results = await Fact.searchFacts(query, {
        category: category?.toLowerCase(),
        limit: Math.min(parseInt(limit), 50)
      });

      const responseTime = Date.now() - startTime;

      res.status(200).json({
        status: 'success',
        data: results,
        meta: {
          query,
          category,
          count: results.length,
          response_time: responseTime
        }
      });
      
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /api/v1/facts/trending:
   *   get:
   *     summary: Get trending facts
   *     tags: [Facts]
   */
  async getTrendingFacts(req, res, next) {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 10, 50);
      
      const Fact = (await import('../models/Fact.js')).default;
      const trendingFacts = await Fact.getTrending(limit);

      res.status(200).json({
        status: 'success',
        data: trendingFacts,
        meta: {
          count: trendingFacts.length,
          period: 'last_7_days'
        }
      });
      
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /api/v1/facts/bulk:
   *   post:
   *     summary: Bulk import facts
   *     tags: [Facts]
   *     security:
   *       - ApiKeyAuth: []
   */
  async bulkImportFacts(req, res, next) {
    try {
      const { facts } = req.body;

      if (!Array.isArray(facts) || facts.length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Facts array is required and cannot be empty'
        });
      }

      if (facts.length > 1000) {
        return res.status(400).json({
          status: 'error',
          message: 'Maximum 1000 facts allowed per bulk import'
        });
      }

      const result = await factService.bulkImportFacts(facts);

      res.status(200).json({
        status: 'success',
        data: result,
        meta: {
          message: `Bulk import completed: ${result.successful} successful, ${result.errors.length} errors`
        }
      });
      
    } catch (error) {
      next(error);
    }
  }
}

// Create controller instance
const factController = new FactController();

// Export methods bound to the instance
export const getRandomFact = factController.getRandomFact.bind(factController);
export const getFactByCategory = factController.getFactByCategory.bind(factController);
export const getFacts = factController.getFacts.bind(factController);
export const createFact = factController.createFact.bind(factController);
export const updateFact = factController.updateFact.bind(factController);
export const deleteFact = factController.deleteFact.bind(factController);
export const likeFact = factController.likeFact.bind(factController);
export const getCategories = factController.getCategories.bind(factController);
export const searchFacts = factController.searchFacts.bind(factController);
export const getTrendingFacts = factController.getTrendingFacts.bind(factController);
export const bulkImportFacts = factController.bulkImportFacts.bind(factController);

export default factController;