import mongoose from 'mongoose';

const apiKeySchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: '30d' // Automatically delete the API key after 30 days
  },
  usageCount: {
    type: Number,
    default: 0
  }
});

const ApiKey = mongoose.model('ApiKey', apiKeySchema);

export default ApiKey;