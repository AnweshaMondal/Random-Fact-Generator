import Fact from '../models/Fact.js';
import { getCachedFact, setCachedFact } from '../services/cacheService.js';

// Fetch a random fact from the database or cache
export const getRandomFact = async () => {
    const cachedFact = await getCachedFact('randomFact');
    if (cachedFact) {
        return cachedFact;
    }

    const fact = await Fact.aggregate([{ $sample: { size: 1 } }]);
    if (fact.length > 0) {
        await setCachedFact('randomFact', fact[0]);
        return fact[0];
    }
    throw new Error('No facts available');
};

// Fetch a random fact by category
export const getFactByCategory = async (category) => {
    const cachedFact = await getCachedFact(`factByCategory:${category}`);
    if (cachedFact) {
        return cachedFact;
    }

    const fact = await Fact.findOne({ category }).exec();
    if (fact) {
        await setCachedFact(`factByCategory:${category}`, fact);
        return fact;
    }
    throw new Error(`No facts found for category: ${category}`);
};

// Add a new fact to the database
export const addFact = async (factData) => {
    const newFact = new Fact(factData);
    await newFact.save();
    return newFact;
};

// Update an existing fact
export const updateFact = async (id, updatedData) => {
    const updatedFact = await Fact.findByIdAndUpdate(id, updatedData, { new: true });
    if (!updatedFact) {
        throw new Error('Fact not found');
    }
    return updatedFact;
};

// Delete a fact
export const deleteFact = async (id) => {
    const deletedFact = await Fact.findByIdAndDelete(id);
    if (!deletedFact) {
        throw new Error('Fact not found');
    }
    return deletedFact;
};