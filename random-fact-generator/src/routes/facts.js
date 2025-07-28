import express from 'express';
import FactController from '../controllers/factController.js';
import AuthMiddleware from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';
import { validateRequest } from '../middleware/validation.js';
import { factValidators } from '../utils/validators.js';

const router = express.Router();

// Rate limiters for different endpoints
const generalRateLimit = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 100 }); // 100 requests per 15 minutes
const searchRateLimit = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 50 }); // 50 searches per 15 minutes
const bulkRateLimit = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 10 }); // 10 bulk operations per hour

/**
 * @swagger
 * components:
 *   schemas:
 *     Fact:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         fact:
 *           type: string
 *         category:
 *           type: string
 *         source:
 *           type: string
 *         verified:
 *           type: boolean
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *         view_count:
 *           type: number
 *         likes:
 *           type: number
 *         created_at:
 *           type: string
 *           format: date-time
 *   securitySchemes:
 *     ApiKeyAuth:
 *       type: apiKey
 *       in: header
 *       name: X-API-KEY
 */

// Public endpoints (with API key)
router.get('/random', 
  AuthMiddleware.apiKeyAuth, 
  generalRateLimit,
  FactController.getRandomFact
);

router.get('/category/:category', 
  AuthMiddleware.apiKeyAuth, 
  generalRateLimit,
  validateRequest(factValidators.getByCategory),
  FactController.getFactByCategory
);

router.get('/search', 
  AuthMiddleware.apiKeyAuth, 
  searchRateLimit,
  validateRequest(factValidators.search),
  FactController.searchFacts
);

router.get('/trending', 
  AuthMiddleware.apiKeyAuth, 
  generalRateLimit,
  FactController.getTrendingFacts
);

router.get('/recent', 
  AuthMiddleware.apiKeyAuth, 
  generalRateLimit,
  FactController.getRecentFacts
);

router.get('/top-rated', 
  AuthMiddleware.apiKeyAuth, 
  generalRateLimit,
  FactController.getTopRatedFacts
);

router.get('/categories', 
  AuthMiddleware.apiKeyAuth, 
  generalRateLimit,
  FactController.getCategories
);

router.get('/stats', 
  AuthMiddleware.apiKeyAuth, 
  generalRateLimit,
  FactController.getFactStats
);

// Get specific fact by ID
router.get('/:id', 
  AuthMiddleware.apiKeyAuth, 
  generalRateLimit,
  validateRequest(factValidators.getById),
  FactController.getFactById
);

// Admin/authenticated user endpoints (with JWT)
router.post('/', 
  AuthMiddleware.jwtAuth, 
  AuthMiddleware.requirePermission('create_facts'),
  generalRateLimit,
  validateRequest(factValidators.create),
  FactController.createFact
);

router.put('/:id', 
  AuthMiddleware.jwtAuth, 
  AuthMiddleware.requirePermission('edit_facts'),
  generalRateLimit,
  validateRequest(factValidators.update),
  FactController.updateFact
);

router.delete('/:id', 
  AuthMiddleware.jwtAuth, 
  AuthMiddleware.requirePermission('delete_facts'),
  generalRateLimit,
  validateRequest(factValidators.delete),
  FactController.deleteFact
);

// Bulk operations (admin only)
router.post('/bulk/import', 
  AuthMiddleware.jwtAuth, 
  AuthMiddleware.requirePermission('bulk_import'),
  bulkRateLimit,
  validateRequest(factValidators.bulkImport),
  FactController.bulkImportFacts
);

router.post('/bulk/export', 
  AuthMiddleware.jwtAuth, 
  AuthMiddleware.requirePermission('bulk_export'),
  bulkRateLimit,
  FactController.bulkExportFacts
);

// Fact interaction endpoints
router.post('/:id/like', 
  AuthMiddleware.apiKeyAuth, 
  generalRateLimit,
  validateRequest(factValidators.interaction),
  FactController.likeFact
);

router.post('/:id/view', 
  AuthMiddleware.apiKeyAuth, 
  generalRateLimit,
  validateRequest(factValidators.interaction),
  FactController.incrementViews
);

// Moderation endpoints (moderator only)
router.post('/:id/verify', 
  AuthMiddleware.jwtAuth, 
  AuthMiddleware.requirePermission('moderate_facts'),
  generalRateLimit,
  validateRequest(factValidators.moderate),
  FactController.verifyFact
);

router.post('/:id/reject', 
  AuthMiddleware.jwtAuth, 
  AuthMiddleware.requirePermission('moderate_facts'),
  generalRateLimit,
  validateRequest(factValidators.moderate),
  FactController.rejectFact
);

export default router;