const ApiKey = require('../models/ApiKey');

const authMiddleware = async (req, res, next) => {
    const apiKey = req.header('X-API-KEY');

    if (!apiKey) {
        return res.status(401).json({ error: 'API key is required' });
    }

    try {
        const apiKeyRecord = await ApiKey.findOne({ key: apiKey });

        if (!apiKeyRecord) {
            return res.status(403).json({ error: 'Invalid API key' });
        }

        req.user = apiKeyRecord.user; // Attach user information to the request
        next();
    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = authMiddleware;