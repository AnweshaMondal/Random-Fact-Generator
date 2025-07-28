import aiService from '../services/aiService.js';
import factService from '../services/factService.js';
import logger from '../utils/logger.js';
import config from '../config/index.js';

class AIController {
  /**
   * @swagger
   * /api/v1/ai/generate-fact:
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
   *                 description: Specific topic or theme for the fact
   *               temperature:
   *                 type: number
   *                 minimum: 0
   *                 maximum: 2
   *                 description: AI creativity level
   *               save_to_database:
   *                 type: boolean
   *                 description: Whether to save the generated fact to database
   *     responses:
   *       200:
   *         description: Fact generated successfully
   *       403:
   *         description: AI features not enabled for this plan
   */
  async generateFact(req, res, next) {
    try {
      const startTime = Date.now();

      // Check if user has access to AI features
      if (!req.user?.hasFeature('ai_facts')) {
        return res.status(403).json({
          status: 'error',
          message: 'AI fact generation requires a Premium or Platinum plan',
          upgrade_url: '/upgrade'
        });
      }

      if (!config.ai.enabled) {
        return res.status(503).json({
          status: 'error',
          message: 'AI service is temporarily unavailable'
        });
      }

      const {
        category = 'general',
        specific_request,
        temperature = 0.8,
        save_to_database = true
      } = req.body;

      const options = {
        specificRequest: specific_request,
        temperature: Math.min(Math.max(temperature, 0), 2),
        forceNew: true
      };

      const generatedFact = await aiService.generateFact(category, options);
      
      // Save to database if requested
      let savedFact = null;
      if (save_to_database) {
        try {
          savedFact = await factService.addFact({
            ...generatedFact,
            created_by: req.user?.id,
            verified: false, // AI facts need verification
            ai_generated: true
          });
        } catch (saveError) {
          logger.logError(saveError, req, { operation: 'save_ai_fact' });
          // Continue without saving - still return the generated fact
        }
      }

      const responseTime = Date.now() - startTime;

      res.status(200).json({
        status: 'success',
        data: {
          fact: generatedFact,
          saved_to_database: !!savedFact,
          database_id: savedFact?._id
        },
        meta: {
          ai_model: config.ai.model,
          response_time: responseTime,
          category,
          generated_at: new Date().toISOString()
        }
      });

      logger.logBusiness('AI Fact Generated', {
        category,
        userId: req.user?.id,
        responseTime,
        saved: !!savedFact
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /api/v1/ai/moderate-content:
   *   post:
   *     summary: Moderate content using AI
   *     tags: [AI]
   *     security:
   *       - ApiKeyAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - content
   *             properties:
   *               content:
   *                 type: string
   *                 description: Content to moderate
   */
  async moderateContent(req, res, next) {
    try {
      const startTime = Date.now();
      const { content } = req.body;

      if (!content || typeof content !== 'string') {
        return res.status(400).json({
          status: 'error',
          message: 'Content is required and must be a string'
        });
      }

      if (!config.ai.contentModerationEnabled) {
        return res.status(503).json({
          status: 'error',
          message: 'Content moderation service is not available'
        });
      }

      const moderationResult = await aiService.moderateContent(content);
      const responseTime = Date.now() - startTime;

      res.status(200).json({
        status: 'success',
        data: {
          content_approved: moderationResult.approved,
          confidence: moderationResult.confidence,
          issues: moderationResult.issues || [],
          recommendation: moderationResult.recommendation,
          requires_manual_review: moderationResult.requiresManualReview || false
        },
        meta: {
          response_time: responseTime,
          content_length: content.length
        }
      });

      logger.logSecurity('Content Moderation', {
        approved: moderationResult.approved,
        confidence: moderationResult.confidence,
        userId: req.user?.id,
        contentLength: content.length
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /api/v1/ai/suggest-topics:
   *   post:
   *     summary: Get AI-generated topic suggestions
   *     tags: [AI]
   *     security:
   *       - ApiKeyAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - theme
   *             properties:
   *               theme:
   *                 type: string
   *                 description: Theme for topic suggestions
   *               count:
   *                 type: integer
   *                 minimum: 1
   *                 maximum: 20
   *                 description: Number of suggestions to generate
   */
  async suggestTopics(req, res, next) {
    try {
      const startTime = Date.now();
      const { theme, count = 5 } = req.body;

      if (!theme || typeof theme !== 'string') {
        return res.status(400).json({
          status: 'error',
          message: 'Theme is required and must be a string'
        });
      }

      const suggestionCount = Math.min(Math.max(count, 1), 20);
      const suggestions = await aiService.generateFactSuggestions(theme, suggestionCount);
      
      const responseTime = Date.now() - startTime;

      res.status(200).json({
        status: 'success',
        data: {
          theme,
          suggestions,
          count: suggestions.length
        },
        meta: {
          response_time: responseTime,
          ai_model: config.ai.model
        }
      });

      logger.logBusiness('AI Topic Suggestions', {
        theme,
        count: suggestions.length,
        userId: req.user?.id
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /api/v1/ai/heavy-task:
   *   post:
   *     summary: Handle heavy computational tasks with AI
   *     tags: [AI]
   *     security:
   *       - ApiKeyAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - task_type
   *             properties:
   *               task_type:
   *                 type: string
   *                 enum: [bulk_generation, content_analysis, fact_verification, data_processing]
   *               parameters:
   *                 type: object
   *                 description: Task-specific parameters
   */
  async handleHeavyTask(req, res, next) {
    try {
      const startTime = Date.now();
      const { task_type, parameters = {} } = req.body;

      // Check if user has access to heavy tasks (Platinum plan)
      if (!req.user?.hasFeature('custom_integration')) {
        return res.status(403).json({
          status: 'error',
          message: 'Heavy AI tasks require a Platinum plan',
          upgrade_url: '/upgrade'
        });
      }

      let result;
      
      switch (task_type) {
        case 'bulk_generation':
          result = await this.handleBulkGeneration(parameters);
          break;
          
        case 'content_analysis':
          result = await this.handleContentAnalysis(parameters);
          break;
          
        case 'fact_verification':
          result = await this.handleFactVerification(parameters);
          break;
          
        case 'data_processing':
          result = await this.handleDataProcessing(parameters);
          break;
          
        default:
          return res.status(400).json({
            status: 'error',
            message: 'Invalid task type'
          });
      }

      const responseTime = Date.now() - startTime;

      res.status(200).json({
        status: 'success',
        data: result,
        meta: {
          task_type,
          response_time: responseTime,
          processed_at: new Date().toISOString()
        }
      });

      logger.logBusiness('Heavy AI Task Completed', {
        taskType: task_type,
        userId: req.user?.id,
        responseTime
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /api/v1/ai/health:
   *   get:
   *     summary: Check AI service health
   *     tags: [AI]
   */
  async healthCheck(req, res, next) {
    try {
      const healthStatus = await aiService.healthCheck();
      const usageStats = aiService.getUsageStats();

      res.status(healthStatus.status === 'healthy' ? 200 : 503).json({
        status: healthStatus.status === 'healthy' ? 'success' : 'error',
        data: {
          service_status: healthStatus.status,
          ai_enabled: config.ai.enabled,
          model: config.ai.model,
          features: {
            fact_generation: config.ai.enabled,
            content_moderation: config.ai.contentModerationEnabled,
            fallback: config.ai.fallbackEnabled
          },
          usage_stats: usageStats
        },
        meta: {
          timestamp: new Date().toISOString(),
          error: healthStatus.error
        }
      });

    } catch (error) {
      next(error);
    }
  }

  // Helper methods for heavy tasks
  async handleBulkGeneration(parameters) {
    const { categories, count_per_category = 10, themes = [] } = parameters;
    const results = {};

    for (const category of categories) {
      results[category] = [];
      
      for (let i = 0; i < count_per_category; i++) {
        try {
          const theme = themes[i % themes.length] || undefined;
          const fact = await aiService.generateFact(category, { specificRequest: theme });
          results[category].push(fact);
        } catch (error) {
          logger.logError(error, null, { operation: 'bulk_generation', category });
          results[category].push({ error: error.message });
        }
      }
    }

    return {
      generated_facts: results,
      total_generated: Object.values(results).flat().filter(f => !f.error).length,
      errors: Object.values(results).flat().filter(f => f.error).length
    };
  }

  async handleContentAnalysis(parameters) {
    const { content_items } = parameters;
    const results = [];

    for (const item of content_items) {
      try {
        const moderation = await aiService.moderateContent(item.content);
        results.push({
          id: item.id,
          content_preview: item.content.substring(0, 100) + '...',
          analysis: moderation
        });
      } catch (error) {
        results.push({
          id: item.id,
          error: error.message
        });
      }
    }

    return {
      analyzed_items: results,
      total_analyzed: results.filter(r => !r.error).length,
      approved: results.filter(r => r.analysis?.approved).length,
      rejected: results.filter(r => r.analysis && !r.analysis.approved).length
    };
  }

  async handleFactVerification(parameters) {
    // This would integrate with external fact-checking APIs
    // For now, return a placeholder implementation
    const { facts } = parameters;
    
    return {
      verified_facts: facts.map(fact => ({
        id: fact.id,
        original_fact: fact.content,
        verification_status: 'pending_manual_review',
        confidence: 0.5,
        sources_needed: true
      })),
      message: 'Fact verification requires manual review and external source validation'
    };
  }

  async handleDataProcessing(parameters) {
    const { operation, data } = parameters;
    
    // Implement various data processing operations
    switch (operation) {
      case 'categorize':
        return this.categorizeData(data);
      case 'summarize':
        return this.summarizeData(data);
      case 'extract_keywords':
        return this.extractKeywords(data);
      default:
        throw new Error('Unknown data processing operation');
    }
  }

  async categorizeData(data) {
    // Use AI to categorize content
    const results = [];
    
    for (const item of data) {
      try {
        // This would use AI to determine the best category
        results.push({
          id: item.id,
          content: item.content,
          suggested_category: 'general', // Placeholder
          confidence: 0.8
        });
      } catch (error) {
        results.push({
          id: item.id,
          error: error.message
        });
      }
    }
    
    return { categorized_items: results };
  }

  async summarizeData(data) {
    // Use AI to create summaries
    return {
      summary: 'Data processing completed',
      processed_items: data.length,
      timestamp: new Date().toISOString()
    };
  }

  async extractKeywords(data) {
    // Use AI to extract keywords
    return {
      keywords: ['science', 'technology', 'nature'],
      processed_items: data.length
    };
  }
}

// Create controller instance
const aiController = new AIController();

// Export methods bound to the instance
export const generateFact = aiController.generateFact.bind(aiController);
export const moderateContent = aiController.moderateContent.bind(aiController);
export const suggestTopics = aiController.suggestTopics.bind(aiController);
export const handleHeavyTask = aiController.handleHeavyTask.bind(aiController);
export const healthCheck = aiController.healthCheck.bind(aiController);

export default aiController;
  try {
    const userMessage = req.body.message;
    const messages = [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: userMessage }
    ];

    const aiResponse = await generateAIResponse(messages);
    res.status(200).json({ status: "success", response: aiResponse });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
}