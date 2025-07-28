import { Fact } from '../models/Fact.js';
import { ApiKey } from '../models/ApiKey.js';
import { cacheService } from '../services/cacheService.js';

// Fetch a random fact
export const getRandomFact = async (req, res) => {
    try {
        const cachedFact = await cacheService.getRandomFact();
        if (cachedFact) {
            return res.status(200).json({ status: 'success', fact: cachedFact });
        }

        const fact = await Fact.aggregate([{ $sample: { size: 1 } }]);
        if (!fact.length) {
            return res.status(404).json({ status: 'error', message: 'No facts found' });
        }

        await cacheService.cacheFact(fact[0]);
        res.status(200).json({ status: 'success', fact: fact[0] });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Internal Server Error' });
    }
};

// Fetch a random fact by category
export const getFactByCategory = async (req, res) => {
    const { category } = req.params;

    try {
        const cachedFact = await cacheService.getFactByCategory(category);
        if (cachedFact) {
            return res.status(200).json({ status: 'success', fact: cachedFact });
        }

        const fact = await Fact.findOne({ category }).exec();
        if (!fact) {
            return res.status(404).json({ status: 'error', message: 'No facts found in this category' });
        }

        await cacheService.cacheFact(fact);
        res.status(200).json({ status: 'success', fact });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Internal Server Error' });
    }
};