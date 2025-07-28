const { body, validationResult } = require('express-validator');

const validateFactRequest = [
    body('category')
        .optional()
        .isString()
        .withMessage('Category must be a string'),
    body('fact_text')
        .exists()
        .withMessage('Fact text is required')
        .isString()
        .withMessage('Fact text must be a string')
        .isLength({ min: 1 })
        .withMessage('Fact text must not be empty'),
];

const validateUserRequest = [
    body('username')
        .exists()
        .withMessage('Username is required')
        .isString()
        .withMessage('Username must be a string')
        .isLength({ min: 3 })
        .withMessage('Username must be at least 3 characters long'),
    body('password')
        .exists()
        .withMessage('Password is required')
        .isString()
        .withMessage('Password must be a string')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters long'),
];

const validateApiKeyRequest = [
    body('apiKey')
        .exists()
        .withMessage('API key is required')
        .isString()
        .withMessage('API key must be a string'),
];

const validateRequest = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

module.exports = {
    validateFactRequest,
    validateUserRequest,
    validateApiKeyRequest,
    validateRequest,
};