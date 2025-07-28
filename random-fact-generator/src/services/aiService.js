import ModelClient, { isUnexpected } from "@azure-rest/ai-inference";
import { AzureKeyCredential } from "@azure/core-auth";
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { cache } from '../config/redis.js';

class AIService {
  constructor() {
    this.client = null;
    this.isInitialized = false;
    this.requestCount = 0;
    this.lastRequestTime = null;
  }

  async initialize() {
    try {
      if (!config.ai.githubToken) {
        throw new Error('GitHub token not configured');
      }

      this.client = ModelClient(
        config.ai.endpoint,
        new AzureKeyCredential(config.ai.githubToken)
      );

      this.isInitialized = true;
      logger.info('AI Service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize AI Service:', error);
      throw error;
    }
  }

  async generateFact(category = 'general', options = {}) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Check cache first
      const cacheKey = `ai_fact_${category}_${JSON.stringify(options)}`;
      const cachedFact = await cache.get(cacheKey);
      
      if (cachedFact && !options.forceNew) {
        logger.info('Returning cached AI-generated fact', { category });
        return JSON.parse(cachedFact);
      }

      // Rate limiting check
      this.updateRequestTracking();

      const messages = this.buildFactGenerationMessages(category, options);
      
      const startTime = Date.now();
      const response = await this.client.path("/chat/completions").post({
        body: {
          messages,
          temperature: options.temperature || 0.8,
          top_p: options.topP || 0.9,
          max_tokens: options.maxTokens || 200,
          model: config.ai.model
        }
      });

      const responseTime = Date.now() - startTime;
      logger.logPerformance('AI Fact Generation', responseTime, { category });

      if (isUnexpected(response)) {
        throw new Error(`AI API Error: ${response.body.error?.message || 'Unknown error'}`);
      }

      const factText = response.body.choices[0].message.content;
      const factData = this.parseFactResponse(factText, category);

      // Cache the result
      await cache.set(cacheKey, JSON.stringify(factData), 3600); // 1 hour cache

      logger.logBusiness('AI Fact Generated', {
        category,
        factLength: factText.length,
        responseTime,
        model: config.ai.model
      });

      return factData;
    } catch (error) {
      logger.logError(error, null, { operation: 'generateFact', category });
      throw new Error(`Failed to generate AI fact: ${error.message}`);
    }
  }

  buildFactGenerationMessages(category, options) {
    const systemPrompt = `You are an expert fact generator. Create fascinating, accurate, and verified facts.
    
    Requirements:
    - Facts must be 100% accurate and verifiable
    - Include interesting details that engage readers
    - Keep facts concise but informative (50-150 words)
    - Provide source context when possible
    - Make facts appropriate for general audiences
    
    Category focus: ${category}
    
    Response format:
    {
      "fact": "The actual fact text",
      "category": "${category}",
      "source_context": "Brief context about where this fact comes from",
      "verification_level": "high|medium|low",
      "tags": ["tag1", "tag2", "tag3"]
    }`;

    const userPrompt = options.specificRequest 
      ? `Generate a fact about: ${options.specificRequest}`
      : `Generate an interesting fact in the ${category} category`;

    return [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ];
  }

  parseFactResponse(response, category) {
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(response);
      return {
        fact: parsed.fact,
        category: parsed.category || category,
        source_context: parsed.source_context || 'AI Generated',
        verification_level: parsed.verification_level || 'medium',
        tags: parsed.tags || [category],
        generated_at: new Date().toISOString(),
        ai_model: config.ai.model
      };
    } catch (error) {
      // Fallback: treat entire response as fact text
      return {
        fact: response.trim(),
        category: category,
        source_context: 'AI Generated',
        verification_level: 'medium',
        tags: [category],
        generated_at: new Date().toISOString(),
        ai_model: config.ai.model
      };
    }
  }

  async moderateContent(text) {
    try {
      if (!config.ai.contentModerationEnabled) {
        return { approved: true, confidence: 1.0 };
      }

      const messages = [
        {
          role: "system",
          content: `You are a content moderator. Analyze the following text for:
          - Inappropriate content
          - Misinformation
          - Harmful content
          - Copyright violations
          
          Respond with JSON:
          {
            "approved": true/false,
            "confidence": 0.0-1.0,
            "issues": ["issue1", "issue2"],
            "recommendation": "explanation"
          }`
        },
        {
          role: "user",
          content: `Moderate this content: "${text}"`
        }
      ];

      const response = await this.client.path("/chat/completions").post({
        body: {
          messages,
          temperature: 0.1,
          model: config.ai.model
        }
      });

      if (isUnexpected(response)) {
        logger.warn('Content moderation failed, defaulting to manual review');
        return { approved: false, confidence: 0.5, requiresManualReview: true };
      }

      const result = JSON.parse(response.body.choices[0].message.content);
      logger.logSecurity('Content Moderation', { 
        approved: result.approved, 
        confidence: result.confidence 
      });

      return result;
    } catch (error) {
      logger.logError(error, null, { operation: 'moderateContent' });
      return { approved: false, confidence: 0.0, requiresManualReview: true };
    }
  }

  async generateFactSuggestions(theme, count = 5) {
    try {
      const messages = [
        {
          role: "system",
          content: `Generate ${count} diverse fact ideas related to: ${theme}. 
          Respond with a JSON array of objects:
          [
            {
              "title": "Brief fact title",
              "category": "suggested category",
              "complexity": "simple|intermediate|advanced",
              "estimated_interest": 1-10
            }
          ]`
        },
        {
          role: "user",
          content: `Suggest interesting facts about: ${theme}`
        }
      ];

      const response = await this.client.path("/chat/completions").post({
        body: {
          messages,
          temperature: 0.9,
          model: config.ai.model
        }
      });

      if (isUnexpected(response)) {
        throw new Error('Failed to generate suggestions');
      }

      return JSON.parse(response.body.choices[0].message.content);
    } catch (error) {
      logger.logError(error, null, { operation: 'generateFactSuggestions', theme });
      throw error;
    }
  }

  updateRequestTracking() {
    this.requestCount++;
    this.lastRequestTime = Date.now();
    
    // Log usage patterns
    if (this.requestCount % 100 === 0) {
      logger.logBusiness('AI Service Usage Milestone', {
        totalRequests: this.requestCount,
        model: config.ai.model
      });
    }
  }

  // Health check for AI service
  async healthCheck() {
    try {
      if (!this.isInitialized) {
        return { status: 'unhealthy', error: 'Service not initialized' };
      }

      // Simple test request
      const testResponse = await this.client.path("/chat/completions").post({
        body: {
          messages: [
            { role: "system", content: "You are a helpful assistant." },
            { role: "user", content: "Say 'OK' if you're working." }
          ],
          temperature: 0.1,
          max_tokens: 10,
          model: config.ai.model
        }
      });

      if (isUnexpected(testResponse)) {
        throw new Error('AI service test failed');
      }

      return { 
        status: 'healthy', 
        model: config.ai.model,
        requestCount: this.requestCount,
        lastRequest: this.lastRequestTime
      };
    } catch (error) {
      return { 
        status: 'unhealthy', 
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  getUsageStats() {
    return {
      requestCount: this.requestCount,
      lastRequestTime: this.lastRequestTime,
      isInitialized: this.isInitialized,
      model: config.ai.model,
      enabled: config.ai.enabled
    };
  }
}

// Create singleton instance
const aiService = new AIService();

export default aiService;