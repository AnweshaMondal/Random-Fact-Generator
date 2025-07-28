import Fact from '../models/Fact.js';
import aiService from './aiService.js';
import { cache } from '../config/redis.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';

class FactService {
  constructor() {
    this.categories = [
      'science', 'history', 'technology', 'nature', 'space', 'animals', 
      'geography', 'sports', 'entertainment', 'health', 'food', 'general'
    ];
  }

  // Get a random fact with AI fallback
  async getRandomFact(options = {}) {
    try {
      const startTime = Date.now();
      let fact = null;

      // Try cache first
      const cacheKey = `random_fact_${options.category || 'any'}`;
      const cachedFact = await cache.get(cacheKey);
      
      if (cachedFact && !options.forceNew) {
        logger.logPerformance('Cache Hit - Random Fact', Date.now() - startTime);
        return JSON.parse(cachedFact);
      }

      // Try database
      if (options.category) {
        fact = await this.getFactByCategory(options.category, { skipCache: true });
      } else {
        const pipeline = [{ $sample: { size: 1 } }];
        const facts = await Fact.aggregate(pipeline);
        fact = facts.length > 0 ? facts[0] : null;
      }

      // AI fallback if no database fact found
      if (!fact && config.ai.fallbackEnabled) {
        logger.info('No database fact found, using AI fallback', { category: options.category });
        fact = await aiService.generateFact(options.category || 'general', options);
        
        // Save AI-generated fact to database for future use
        if (options.saveAIFacts !== false) {
          await this.addFact({
            ...fact,
            source: 'AI Generated',
            verified: false,
            ai_generated: true
          });
        }
      }

      if (!fact) {
        throw new Error('No facts available');
      }

      // Cache the result
      await cache.set(cacheKey, JSON.stringify(fact), 300); // 5 minutes cache

      logger.logPerformance('Get Random Fact', Date.now() - startTime, {
        category: options.category,
        source: fact.ai_generated ? 'AI' : 'Database'
      });

      return fact;
    } catch (error) {
      logger.logError(error, null, { operation: 'getRandomFact', options });
      throw error;
    }
  }

  // Get fact by category with enhanced logic
  async getFactByCategory(category, options = {}) {
    try {
      const startTime = Date.now();

      if (!this.isValidCategory(category)) {
        throw new Error(`Invalid category: ${category}`);
      }

      // Check cache first
      const cacheKey = `fact_category_${category}`;
      if (!options.skipCache) {
        const cachedFact = await cache.get(cacheKey);
        if (cachedFact) {
          logger.logPerformance('Cache Hit - Category Fact', Date.now() - startTime);
          return JSON.parse(cachedFact);
        }
      }

      // Query database
      const query = { category, verified: true };
      if (options.excludeAI) {
        query.ai_generated = { $ne: true };
      }

      const fact = await Fact.findOne(query).lean();

      if (!fact && config.ai.fallbackEnabled && !options.excludeAI) {
        logger.info('No category fact found, using AI fallback', { category });
        const aiFact = await aiService.generateFact(category, options);
        
        // Cache AI fact temporarily
        await cache.set(cacheKey, JSON.stringify(aiFact), 600); // 10 minutes
        
        return aiFact;
      }

      if (!fact) {
        throw new Error(`No facts found for category: ${category}`);
      }

      // Cache the result
      await cache.set(cacheKey, JSON.stringify(fact), 1800); // 30 minutes

      logger.logPerformance('Get Category Fact', Date.now() - startTime, { category });

      return fact;
    } catch (error) {
      logger.logError(error, null, { operation: 'getFactByCategory', category });
      throw error;
    }
  }

  // Add a new fact with validation and moderation
  async addFact(factData) {
    try {
      const startTime = Date.now();

      // Validate fact data
      this.validateFactData(factData);

      // Content moderation if enabled
      if (config.ai.contentModerationEnabled && factData.fact) {
        const moderation = await aiService.moderateContent(factData.fact);
        if (!moderation.approved) {
          throw new Error(`Content rejected: ${moderation.recommendation || 'Failed moderation'}`);
        }
        factData.moderation_score = moderation.confidence;
      }

      // Create fact with metadata
      const newFact = new Fact({
        ...factData,
        created_at: new Date(),
        updated_at: new Date(),
        verified: factData.verified || false,
        source: factData.source || 'User Submitted',
        tags: factData.tags || [factData.category],
        view_count: 0,
        likes: 0
      });

      await newFact.save();

      // Clear related caches
      await this.clearFactCaches(factData.category);

      logger.logBusiness('Fact Added', {
        id: newFact._id,
        category: newFact.category,
        source: newFact.source,
        ai_generated: newFact.ai_generated || false
      });

      logger.logPerformance('Add Fact', Date.now() - startTime);

      return newFact;
    } catch (error) {
      logger.logError(error, null, { operation: 'addFact', factData });
      throw error;
    }
  }

  // Update existing fact
  async updateFact(id, updatedData) {
    try {
      const startTime = Date.now();

      // Validate update data
      if (updatedData.fact) {
        this.validateFactData(updatedData);
      }

      // Content moderation for updated content
      if (config.ai.contentModerationEnabled && updatedData.fact) {
        const moderation = await aiService.moderateContent(updatedData.fact);
        if (!moderation.approved) {
          throw new Error(`Content update rejected: ${moderation.recommendation}`);
        }
        updatedData.moderation_score = moderation.confidence;
      }

      updatedData.updated_at = new Date();

      const updatedFact = await Fact.findByIdAndUpdate(
        id, 
        updatedData, 
        { new: true, runValidators: true }
      );

      if (!updatedFact) {
        throw new Error('Fact not found');
      }

      // Clear related caches
      await this.clearFactCaches(updatedFact.category);

      logger.logBusiness('Fact Updated', { id, category: updatedFact.category });
      logger.logPerformance('Update Fact', Date.now() - startTime);

      return updatedFact;
    } catch (error) {
      logger.logError(error, null, { operation: 'updateFact', id, updatedData });
      throw error;
    }
  }

  // Delete a fact
  async deleteFact(id) {
    try {
      const fact = await Fact.findById(id);
      if (!fact) {
        throw new Error('Fact not found');
      }

      await Fact.findByIdAndDelete(id);

      // Clear related caches
      await this.clearFactCaches(fact.category);

      logger.logBusiness('Fact Deleted', { id, category: fact.category });

      return fact;
    } catch (error) {
      logger.logError(error, null, { operation: 'deleteFact', id });
      throw error;
    }
  }

  // Get multiple facts with pagination
  async getFacts(options = {}) {
    try {
      const {
        category,
        page = 1,
        limit = 10,
        sortBy = 'created_at',
        sortOrder = 'desc',
        verified = true,
        search
      } = options;

      const query = {};
      
      if (category) {
        query.category = category;
      }
      
      if (typeof verified === 'boolean') {
        query.verified = verified;
      }
      
      if (search) {
        query.$text = { $search: search };
      }

      const skip = (page - 1) * limit;
      const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

      const [facts, total] = await Promise.all([
        Fact.find(query)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        Fact.countDocuments(query)
      ]);

      return {
        facts,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.logError(error, null, { operation: 'getFacts', options });
      throw error;
    }
  }

  // Get fact statistics
  async getFactStats() {
    try {
      const stats = await Fact.aggregate([
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            verified: { $sum: { $cond: ['$verified', 1, 0] } },
            ai_generated: { $sum: { $cond: ['$ai_generated', 1, 0] } }
          }
        },
        {
          $sort: { count: -1 }
        }
      ]);

      const totalStats = await Fact.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            verified: { $sum: { $cond: ['$verified', 1, 0] } },
            ai_generated: { $sum: { $cond: ['$ai_generated', 1, 0] } }
          }
        }
      ]);

      return {
        byCategory: stats,
        total: totalStats[0] || { total: 0, verified: 0, ai_generated: 0 }
      };
    } catch (error) {
      logger.logError(error, null, { operation: 'getFactStats' });
      throw error;
    }
  }

  // Bulk import facts
  async bulkImportFacts(facts) {
    try {
      const validFacts = [];
      const errors = [];

      for (let i = 0; i < facts.length; i++) {
        try {
          this.validateFactData(facts[i]);
          validFacts.push({
            ...facts[i],
            created_at: new Date(),
            updated_at: new Date(),
            verified: facts[i].verified || false,
            view_count: 0,
            likes: 0
          });
        } catch (error) {
          errors.push({ index: i, error: error.message });
        }
      }

      const result = await Fact.insertMany(validFacts, { ordered: false });

      // Clear all fact caches
      await this.clearAllFactCaches();

      logger.logBusiness('Bulk Import Completed', {
        total: facts.length,
        successful: result.length,
        errors: errors.length
      });

      return {
        successful: result.length,
        errors,
        imported: result
      };
    } catch (error) {
      logger.logError(error, null, { operation: 'bulkImportFacts' });
      throw error;
    }
  }

  // Utility methods
  isValidCategory(category) {
    return this.categories.includes(category.toLowerCase());
  }

  validateFactData(factData) {
    if (!factData.fact || typeof factData.fact !== 'string') {
      throw new Error('Fact text is required and must be a string');
    }

    if (factData.fact.length < 10 || factData.fact.length > 1000) {
      throw new Error('Fact text must be between 10 and 1000 characters');
    }

    if (!factData.category || !this.isValidCategory(factData.category)) {
      throw new Error(`Category must be one of: ${this.categories.join(', ')}`);
    }
  }

  async clearFactCaches(category) {
    const cacheKeys = [
      'random_fact_any',
      `random_fact_${category}`,
      `fact_category_${category}`
    ];

    await Promise.all(cacheKeys.map(key => cache.del(key)));
  }

  async clearAllFactCaches() {
    // Clear all fact-related cache keys
    const patterns = [
      'random_fact_*',
      'fact_category_*'
    ];

    // Note: In production, you might want to use Redis SCAN for pattern deletion
    for (const category of this.categories) {
      await this.clearFactCaches(category);
    }
  }

  getCategories() {
    return this.categories;
  }
}

// Create singleton instance
const factService = new FactService();

export default factService;