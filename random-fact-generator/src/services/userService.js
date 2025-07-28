import User from '../models/User.js';
import ApiKey from '../models/ApiKey.js';

// Function to register a new user
export const registerUser = async (userData) => {
    const user = new User(userData);
    await user.save();
    return user;
};

// Function to authenticate a user
export const authenticateUser = async (email, password) => {
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
        throw new Error('Invalid credentials');
    }
    return user;
};

// Function to track API usage
export const trackUsage = async (userId) => {
    const user = await User.findById(userId);
    if (!user) {
        throw new Error('User not found');
    }
    user.usageCount += 1; // Increment usage count
    await user.save();
    return user.usageCount;
};

// Function to get user details
export const getUserDetails = async (userId) => {
    const user = await User.findById(userId);
    if (!user) {
        throw new Error('User not found');
    }
    return user;
};

// Function to update user information
export const updateUser = async (userId, updateData) => {
    const user = await User.findByIdAndUpdate(userId, updateData, { new: true });
    if (!user) {
        throw new Error('User not found');
    }
    return user;
};

// Function to delete a user
export const deleteUser = async (userId) => {
    const user = await User.findByIdAndDelete(userId);
    if (!user) {
        throw new Error('User not found');
    }
    return user;
};