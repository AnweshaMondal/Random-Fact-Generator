module.exports = {
    generateRandomNumber: (min, max) => {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    formatResponse: (status, data, message = '') => {
        return {
            status,
            message,
            data,
        };
    },

    isValidCategory: (category, validCategories) => {
        return validCategories.includes(category);
    },

    handleError: (error) => {
        console.error(error);
        return {
            status: 'error',
            message: error.message || 'An unexpected error occurred.',
        };
    },
};