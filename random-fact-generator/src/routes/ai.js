import express from 'express';
import AIController from '../controllers/aiController.js';
import AuthMiddleware from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';
import { validateRequest } from '../middleware/validation.js';
import { aiValidators } from '../utils/validators.js';

const router = express.Router();

// Strict rate limiting for AI endpoints
const aiRateLimit = createRateLimiter({ 
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 AI requests per 15 minutes
  message: {
    status: 'error',
    message: 'Too many AI requests. Please try again later.',
    error_code: 'AI_RATE_LIMIT_EXCEEDED'
  }
});

const moderationRateLimit = createRateLimiter({ 
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 100 // 100 moderation requests per 5 minutes
});

/**
 * @swagger
 * components:
 *   schemas:
 *     AIGeneratedFact:
 *       type: object
 *       properties:
 *         fact:
 *           type: string
 *         category:
 *           type: string
 *         source_context:
 *           type: string
 *         verification_level:
 *           type: string
 *           enum: [high, medium, low]
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *         generated_at:
 *           type: string
 *           format: date-time
 *         ai_model:
 *           type: string
 */

// AI fact generation endpoint
/**
 * @swagger
 * /api/v1/ai/generate/fact:
 *   post:
 *     summary: Generate a fact using AI
 *     tags: [AI]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               category:
 *                 type: string
 *                 description: Category for the fact
 *               specific_request:
 *                 type: string
 *                 description: Specific topic or request
 *               temperature:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 2
 *                 description: AI creativity level
 *               save_to_database:
 *                 type: boolean
 *                 description: Whether to save the generated fact
 *     responses:
 *       200:
 *         description: Fact generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/AIGeneratedFact'
 */
router.post('/generate/fact', 
  AuthMiddleware.apiKeyAuth,
  AuthMiddleware.requireSubscription(['premium', 'platinum']),
  aiRateLimit,
  validateRequest(aiValidators.generateFact),
  AIController.generateFact
);

// AI fact suggestions endpoint
router.post('/suggest/facts', 
  AuthMiddleware.apiKeyAuth,
  AuthMiddleware.requireSubscription(['premium', 'platinum']),
  aiRateLimit,
  validateRequest(aiValidators.suggestFacts),
  AIController.suggestFacts
);

// Content moderation endpoint
router.post('/moderate/content', 
  AuthMiddleware.jwtAuth,
  AuthMiddleware.requirePermission('moderate_content'),
  moderationRateLimit,
  validateRequest(aiValidators.moderateContent),
  AIController.moderateContent
);

// AI health check
router.get('/health', 
  AuthMiddleware.jwtAuth,
  AuthMiddleware.requirePermission('admin'),
  AIController.healthCheck
);

// AI usage statistics
router.get('/stats', 
  AuthMiddleware.jwtAuth,
  AuthMiddleware.requirePermission('admin'),
  AIController.getUsageStats
);

// Batch AI operations (admin only)
router.post('/batch/generate', 
  AuthMiddleware.jwtAuth,
  AuthMiddleware.requirePermission('admin'),
  createRateLimiter({ windowMs: 60 * 60 * 1000, max: 5 }), // 5 per hour
  validateRequest(aiValidators.batchGenerate),
  AIController.batchGenerateFacts
);

// AI model configuration (admin only)
router.get('/models', 
  AuthMiddleware.jwtAuth,
  AuthMiddleware.requirePermission('admin'),
  AIController.getAvailableModels
);

router.post('/models/switch', 
  AuthMiddleware.jwtAuth,
  AuthMiddleware.requirePermission('admin'),
  validateRequest(aiValidators.switchModel),
  AIController.switchModel
);

export default router;