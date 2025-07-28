import { body, param, query } from 'express-validator';
import mongoose from 'mongoose';

// Fact validation rules
export const factValidators = {
  // Get random fact validation
  getRandom: [
    query('category')
      .optional()
      .isIn(['science', 'history', 'technology', 'nature', 'space', 'animals', 'geography', 'sports', 'entertainment', 'health', 'food', 'general'])
      .withMessage('Invalid category'),
    query('ai_fallback')
      .optional()
      .isBoolean()
      .withMessage('ai_fallback must be a boolean'),
    query('force_new')
      .optional()
      .isBoolean()
      .withMessage('force_new must be a boolean')
  ],

  // Get by category validation
  getByCategory: [
    param('category')
      .isIn(['science', 'history', 'technology', 'nature', 'space', 'animals', 'geography', 'sports', 'entertainment', 'health', 'food', 'general'])
      .withMessage('Invalid category'),
    query('exclude_ai')
      .optional()
      .isBoolean()
      .withMessage('exclude_ai must be a boolean')
  ],

  // Get by ID validation
  getById: [
    param('id')
      .isMongoId()
      .withMessage('Invalid fact ID')
  ],

  // Search facts validation
  search: [
    query('q')
      .notEmpty()
      .withMessage('Search query is required')
      .isLength({ min: 2, max: 100 })
      .withMessage('Search query must be between 2 and 100 characters'),
    query('category')
      .optional()
      .isIn(['science', 'history', 'technology', 'nature', 'space', 'animals', 'geography', 'sports', 'entertainment', 'health', 'food', 'general'])
      .withMessage('Invalid category'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
  ],

  // Create fact validation
  create: [
    body('fact')
      .notEmpty()
      .withMessage('Fact text is required')
      .isLength({ min: 10, max: 1000 })
      .withMessage('Fact must be between 10 and 1000 characters')
      .custom(value => {
        // Basic profanity and spam check
        const badWords = ['spam', 'fake', 'scam']; // Add more as needed
        const lowerFact = value.toLowerCase();
        if (badWords.some(word => lowerFact.includes(word))) {
          throw new Error('Fact contains inappropriate content');
        }
        return true;
      }),
    body('category')
      .notEmpty()
      .withMessage('Category is required')
      .isIn(['science', 'history', 'technology', 'nature', 'space', 'animals', 'geography', 'sports', 'entertainment', 'health', 'food', 'general'])
      .withMessage('Invalid category'),
    body('source')
      .optional()
      .isLength({ max: 200 })
      .withMessage('Source must be less than 200 characters'),
    body('source_url')
      .optional()
      .isURL()
      .withMessage('Source URL must be a valid URL'),
    body('tags')
      .optional()
      .isArray({ max: 10 })
      .withMessage('Tags must be an array with maximum 10 items'),
    body('tags.*')
      .optional()
      .isLength({ min: 1, max: 30 })
      .withMessage('Each tag must be between 1 and 30 characters'),
    body('difficulty_level')
      .optional()
      .isIn(['beginner', 'intermediate', 'advanced'])
      .withMessage('Invalid difficulty level'),
    body('verified')
      .optional()
      .isBoolean()
      .withMessage('Verified must be a boolean')
  ],

  // Update fact validation
  update: [
    param('id')
      .isMongoId()
      .withMessage('Invalid fact ID'),
    body('fact')
      .optional()
      .isLength({ min: 10, max: 1000 })
      .withMessage('Fact must be between 10 and 1000 characters'),
    body('category')
      .optional()
      .isIn(['science', 'history', 'technology', 'nature', 'space', 'animals', 'geography', 'sports', 'entertainment', 'health', 'food', 'general'])
      .withMessage('Invalid category'),
    body('source')
      .optional()
      .isLength({ max: 200 })
      .withMessage('Source must be less than 200 characters'),
    body('source_url')
      .optional()
      .isURL()
      .withMessage('Source URL must be a valid URL'),
    body('tags')
      .optional()
      .isArray({ max: 10 })
      .withMessage('Tags must be an array with maximum 10 items'),
    body('verified')
      .optional()
      .isBoolean()
      .withMessage('Verified must be a boolean')
  ],

  // Delete fact validation
  delete: [
    param('id')
      .isMongoId()
      .withMessage('Invalid fact ID')
  ],

  // Bulk import validation
  bulkImport: [
    body('facts')
      .isArray({ min: 1, max: 1000 })
      .withMessage('Facts must be an array with 1-1000 items'),
    body('facts.*.fact')
      .notEmpty()
      .withMessage('Each fact must have fact text')
      .isLength({ min: 10, max: 1000 })
      .withMessage('Each fact must be between 10 and 1000 characters'),
    body('facts.*.category')
      .notEmpty()
      .withMessage('Each fact must have a category')
      .isIn(['science', 'history', 'technology', 'nature', 'space', 'animals', 'geography', 'sports', 'entertainment', 'health', 'food', 'general'])
      .withMessage('Invalid category in facts array')
  ],

  // Fact interaction validation
  interaction: [
    param('id')
      .isMongoId()
      .withMessage('Invalid fact ID')
  ],

  // Moderation validation
  moderate: [
    param('id')
      .isMongoId()
      .withMessage('Invalid fact ID'),
    body('reason')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Reason must be less than 500 characters')
  ]
};

// AI validation rules
export const aiValidators = {
  // Generate fact validation
  generateFact: [
    body('category')
      .optional()
      .isIn(['science', 'history', 'technology', 'nature', 'space', 'animals', 'geography', 'sports', 'entertainment', 'health', 'food', 'general'])
      .withMessage('Invalid category'),
    body('specific_request')
      .optional()
      .isLength({ min: 3, max: 200 })
      .withMessage('Specific request must be between 3 and 200 characters'),
    body('temperature')
      .optional()
      .isFloat({ min: 0, max: 2 })
      .withMessage('Temperature must be between 0 and 2'),
    body('max_tokens')
      .optional()
      .isInt({ min: 50, max: 500 })
      .withMessage('Max tokens must be between 50 and 500'),
    body('save_to_database')
      .optional()
      .isBoolean()
      .withMessage('save_to_database must be a boolean')
  ],

  // Suggest facts validation
  suggestFacts: [
    body('theme')
      .notEmpty()
      .withMessage('Theme is required')
      .isLength({ min: 3, max: 100 })
      .withMessage('Theme must be between 3 and 100 characters'),
    body('count')
      .optional()
      .isInt({ min: 1, max: 20 })
      .withMessage('Count must be between 1 and 20')
  ],

  // Content moderation validation
  moderateContent: [
    body('content')
      .notEmpty()
      .withMessage('Content is required')
      .isLength({ min: 1, max: 2000 })
      .withMessage('Content must be between 1 and 2000 characters')
  ],

  // Batch generate validation
  batchGenerate: [
    body('requests')
      .isArray({ min: 1, max: 50 })
      .withMessage('Requests must be an array with 1-50 items'),
    body('requests.*.category')
      .optional()
      .isIn(['science', 'history', 'technology', 'nature', 'space', 'animals', 'geography', 'sports', 'entertainment', 'health', 'food', 'general'])
      .withMessage('Invalid category in requests array'),
    body('requests.*.specific_request')
      .optional()
      .isLength({ min: 3, max: 200 })
      .withMessage('Specific request must be between 3 and 200 characters')
  ],

  // Switch model validation
  switchModel: [
    body('model')
      .notEmpty()
      .withMessage('Model is required')
      .isIn(['xai/grok-3', 'meta-llama/Llama-3.2-11B-Vision-Instruct', 'openai/gpt-4o-mini'])
      .withMessage('Invalid model selection')
  ]
};

// User validation rules
export const userValidators = {
  // Register validation
  register: [
    body('username')
      .notEmpty()
      .withMessage('Username is required')
      .isLength({ min: 3, max: 30 })
      .withMessage('Username must be between 3 and 30 characters')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username can only contain letters, numbers, and underscores'),
    body('email')
      .isEmail()
      .withMessage('Valid email is required')
      .normalizeEmail(),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    body('firstName')
      .optional()
      .isLength({ max: 50 })
      .withMessage('First name must be less than 50 characters'),
    body('lastName')
      .optional()
      .isLength({ max: 50 })
      .withMessage('Last name must be less than 50 characters')
  ],

  // Login validation
  login: [
    body('email')
      .isEmail()
      .withMessage('Valid email is required')
      .normalizeEmail(),
    body('password')
      .notEmpty()
      .withMessage('Password is required')
  ],

  // Update profile validation
  updateProfile: [
    body('firstName')
      .optional()
      .isLength({ max: 50 })
      .withMessage('First name must be less than 50 characters'),
    body('lastName')
      .optional()
      .isLength({ max: 50 })
      .withMessage('Last name must be less than 50 characters'),
    body('bio')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Bio must be less than 500 characters')
  ],

  // Change password validation
  changePassword: [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
  ]
};

// API Key validation rules
export const apiKeyValidators = {
  // Create API key validation
  create: [
    body('name')
      .notEmpty()
      .withMessage('API key name is required')
      .isLength({ min: 3, max: 100 })
      .withMessage('Name must be between 3 and 100 characters'),
    body('description')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Description must be less than 500 characters'),
    body('restrictions.domains')
      .optional()
      .isArray()
      .withMessage('Domains must be an array'),
    body('restrictions.domains.*')
      .optional()
      .isFQDN()
      .withMessage('Invalid domain format'),
    body('restrictions.ip_addresses')
      .optional()
      .isArray()
      .withMessage('IP addresses must be an array'),
    body('restrictions.ip_addresses.*')
      .optional()
      .isIP()
      .withMessage('Invalid IP address format')
  ],

  // Update API key validation
  update: [
    param('id')
      .isMongoId()
      .withMessage('Invalid API key ID'),
    body('name')
      .optional()
      .isLength({ min: 3, max: 100 })
      .withMessage('Name must be between 3 and 100 characters'),
    body('description')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Description must be less than 500 characters'),
    body('status')
      .optional()
      .isIn(['active', 'suspended', 'revoked'])
      .withMessage('Invalid status')
  ]
};

// Pagination validation
export const paginationValidators = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('sort_by')
    .optional()
    .isIn(['created_at', 'updated_at', 'view_count', 'likes', 'popularity_score'])
    .withMessage('Invalid sort field'),
  query('sort_order')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc')
];

// Common validation helpers
export const validateObjectId = (value) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new Error('Invalid ID format');
  }
  return true;
};

export const validateFactInput = factValidators.create;
export const validatePaginationParams = paginationValidators;

export default {
  factValidators,
  aiValidators,
  userValidators,
  apiKeyValidators,
  paginationValidators,
  validateObjectId,
  validateFactInput,
  validatePaginationParams
};