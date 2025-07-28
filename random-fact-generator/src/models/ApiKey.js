import mongoose from 'mongoose';
import crypto from 'crypto';

const apiKeySchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: [100, 'API key name must be less than 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description must be less than 500 characters']
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['active', 'suspended', 'revoked'],
    default: 'active',
    index: true
  },
  usage: {
    total_requests: {
      type: Number,
      default: 0
    },
    monthly_requests: {
      type: Number,
      default: 0
    },
    last_used: Date,
    monthly_reset_date: {
      type: Date,
      default: () => {
        const date = new Date();
        date.setMonth(date.getMonth() + 1);
        date.setDate(1);
        date.setHours(0, 0, 0, 0);
        return date;
      }
    }
  },
  permissions: {
    endpoints: [{
      type: String,
      enum: ['facts', 'ai', 'users', 'analytics', 'admin']
    }],
    rate_limit_override: {
      type: Number,
      min: 0
    },
    ip_whitelist: [String],
    allowed_origins: [String]
  },
  expiry: {
    type: Date,
    index: { expireAfterSeconds: 0 }
  },
  metadata: {
    created_ip: String,
    user_agent: String,
    environment: {
      type: String,
      enum: ['development', 'staging', 'production'],
      default: 'production'
    },
    integration_type: String,
    webhook_url: String
  },
  analytics: {
    popular_endpoints: [{
      endpoint: String,
      count: { type: Number, default: 0 }
    }],
    error_count: {
      type: Number,
      default: 0
    },
    avg_response_time: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: { 
    createdAt: 'created_at', 
    updatedAt: 'updated_at' 
  },
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      // Mask the API key in responses (show only first and last 4 characters)
      if (ret.key && ret.key.length > 8) {
        ret.masked_key = ret.key.substring(0, 4) + '...' + ret.key.substring(ret.key.length - 4);
        delete ret.key;
      }
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes for performance
apiKeySchema.index({ userId: 1, status: 1 });
apiKeySchema.index({ 'usage.monthly_reset_date': 1 });
apiKeySchema.index({ created_at: -1 });

// Virtual properties
apiKeySchema.virtual('usage_percentage').get(function() {
  const user = this.populated('userId');
  if (!user || !user.planLimits || user.planLimits.monthly_requests === -1) return 0;
  return Math.min(100, (this.usage.monthly_requests / user.planLimits.monthly_requests) * 100);
});

apiKeySchema.virtual('is_expired').get(function() {
  return this.expiry && new Date() > this.expiry;
});

apiKeySchema.virtual('days_until_expiry').get(function() {
  if (!this.expiry) return null;
  const diffTime = this.expiry - new Date();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Pre-save middleware
apiKeySchema.pre('save', function(next) {
  // Generate API key if not provided
  if (!this.key) {
    this.key = this.generateApiKey();
  }
  
  // Reset monthly usage if needed
  if (new Date() >= this.usage.monthly_reset_date) {
    this.resetMonthlyUsage();
  }
  
  // Set default permissions
  if (!this.permissions.endpoints || this.permissions.endpoints.length === 0) {
    this.permissions.endpoints = ['facts'];
  }
  
  next();
});

// Instance methods
apiKeySchema.methods.generateApiKey = function() {
  const prefix = 'rfg'; // Random Fact Generator
  const timestamp = Date.now().toString(36);
  const randomBytes = crypto.randomBytes(20).toString('hex');
  return `${prefix}_${timestamp}_${randomBytes}`;
};

apiKeySchema.methods.incrementUsage = function(endpoint = 'unknown') {
  this.usage.total_requests += 1;
  this.usage.monthly_requests += 1;
  this.usage.last_used = new Date();
  
  // Track endpoint usage
  const endpointStat = this.analytics.popular_endpoints.find(e => e.endpoint === endpoint);
  if (endpointStat) {
    endpointStat.count += 1;
  } else {
    this.analytics.popular_endpoints.push({ endpoint, count: 1 });
  }
  
  return this.save();
};

apiKeySchema.methods.recordError = function() {
  this.analytics.error_count += 1;
  return this.save();
};

apiKeySchema.methods.updateResponseTime = function(responseTime) {
  const currentAvg = this.analytics.avg_response_time || 0;
  const totalRequests = this.usage.total_requests;
  this.analytics.avg_response_time = ((currentAvg * (totalRequests - 1)) + responseTime) / totalRequests;
  return this.save();
};

apiKeySchema.methods.resetMonthlyUsage = function() {
  this.usage.monthly_requests = 0;
  const resetDate = new Date();
  resetDate.setMonth(resetDate.getMonth() + 1);
  resetDate.setDate(1);
  resetDate.setHours(0, 0, 0, 0);
  this.usage.monthly_reset_date = resetDate;
};

apiKeySchema.methods.revoke = function() {
  this.status = 'revoked';
  return this.save();
};

apiKeySchema.methods.suspend = function() {
  this.status = 'suspended';
  return this.save();
};

apiKeySchema.methods.activate = function() {
  this.status = 'active';
  return this.save();
};

apiKeySchema.methods.hasPermission = function(endpoint) {
  return this.permissions.endpoints.includes(endpoint) || this.permissions.endpoints.includes('admin');
};

apiKeySchema.methods.isValidForRequest = function(ip, origin) {
  // Check if API key is active
  if (this.status !== 'active') return false;
  
  // Check expiry
  if (this.is_expired) return false;
  
  // Check IP whitelist
  if (this.permissions.ip_whitelist && this.permissions.ip_whitelist.length > 0) {
    if (!this.permissions.ip_whitelist.includes(ip)) return false;
  }
  
  // Check allowed origins
  if (this.permissions.allowed_origins && this.permissions.allowed_origins.length > 0) {
    if (!this.permissions.allowed_origins.includes(origin)) return false;
  }
  
  return true;
};

// Static methods
apiKeySchema.statics.findByKey = function(key) {
  return this.findOne({ key, status: 'active' }).populate('userId');
};

apiKeySchema.statics.findActiveByUser = function(userId) {
  return this.find({ userId, status: 'active' });
};

apiKeySchema.statics.cleanupExpired = function() {
  return this.deleteMany({
    expiry: { $lt: new Date() }
  });
};

apiKeySchema.statics.getUsageStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        total_requests: { $sum: '$usage.total_requests' }
      }
    }
  ]);
};

apiKeySchema.statics.getTopUsers = function(limit = 10) {
  return this.aggregate([
    { $match: { status: 'active' } },
    { $group: {
      _id: '$userId',
      total_requests: { $sum: '$usage.total_requests' },
      api_keys: { $sum: 1 }
    }},
    { $sort: { total_requests: -1 } },
    { $limit: limit },
    { $lookup: {
      from: 'users',
      localField: '_id',
      foreignField: '_id',
      as: 'user'
    }}
  ]);
};

const ApiKey = mongoose.model('ApiKey', apiKeySchema);

export default ApiKey;