const rateLimit = require('express-rate-limit');
const { getUserPlan } = require('../services/userService');

// Define rate limits for different user tiers
const rateLimits = {
    Basic: rateLimit({
        windowMs: 30 * 60 * 1000, // 30 minutes
        max: 100, // limit each IP to 100 requests per windowMs
        message: 'Basic plan limit reached. Please upgrade your plan for more requests.'
    }),
    Premium: rateLimit({
        windowMs: 30 * 60 * 1000, // 30 minutes
        max: 1000, // limit each IP to 1000 requests per windowMs
        message: 'Premium plan limit reached. Please upgrade your plan for more requests.'
    }),
    Platinum: rateLimit({
        windowMs: 30 * 60 * 1000, // 30 minutes
        max: 5000, // limit each IP to 5000 requests per windowMs
        message: 'Platinum plan limit reached. Please upgrade your plan for more requests.'
    })
};

// Middleware to apply rate limiting based on user plan
const applyRateLimit = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey) {
        return res.status(401).json({ message: 'API key is required.' });
    }

    getUserPlan(apiKey)
        .then(plan => {
            if (rateLimits[plan]) {
                rateLimits[plan](req, res, next);
            } else {
                return res.status(403).json({ message: 'Invalid plan.' });
            }
        })
        .catch(err => {
            return res.status(500).json({ message: 'Error retrieving user plan.', error: err });
        });
};

module.exports = applyRateLimit;