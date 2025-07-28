import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import config from '../config/index.js';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username must be less than 30 characters'],
    match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false // Don't include password in queries by default
  },
  firstName: {
    type: String,
    trim: true,
    maxlength: [50, 'First name must be less than 50 characters']
  },
  lastName: {
    type: String,
    trim: true,
    maxlength: [50, 'Last name must be less than 50 characters']
  },
  company: {
    type: String,
    trim: true,
    maxlength: [100, 'Company name must be less than 100 characters']
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'moderator'],
    default: 'user'
  },
  plan: {
    type: String,
    enum: ['basic', 'premium', 'platinum'],
    default: 'basic'
  },
  planLimits: {
    monthly_requests: {
      type: Number,
      default: 1000 // Basic plan limit
    },
    features: [{
      type: String,
      enum: ['basic_facts', 'all_categories', 'ai_facts', 'priority_support', 'custom_integration']
    }]
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
    last_request: {
      type: Date
    },
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
  billing: {
    customer_id: String, // Stripe customer ID
    subscription_id: String, // Stripe subscription ID
    payment_status: {
      type: String,
      enum: ['active', 'past_due', 'canceled', 'unpaid'],
      default: 'active'
    },
    billing_email: String,
    last_payment: Date,
    next_billing_date: Date
  },
  preferences: {
    email_notifications: {
      type: Boolean,
      default: true
    },
    marketing_emails: {
      type: Boolean,
      default: false
    },
    preferred_categories: [{
      type: String
    }],
    default_language: {
      type: String,
      default: 'en'
    }
  },
  status: {
    type: String,
    enum: ['active', 'suspended', 'pending_verification', 'deleted'],
    default: 'active'
  },
  verification: {
    email_verified: {
      type: Boolean,
      default: false
    },
    email_verification_token: String,
    email_verification_expires: Date,
    phone_verified: {
      type: Boolean,
      default: false
    }
  },
  security: {
    password_reset_token: String,
    password_reset_expires: Date,
    last_login: Date,
    login_attempts: {
      type: Number,
      default: 0
    },
    locked_until: Date,
    two_factor_enabled: {
      type: Boolean,
      default: false
    }
  },
  metadata: {
    ip_address: String,
    user_agent: String,
    referral_source: String,
    signup_date: {
      type: Date,
      default: Date.now
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
      delete ret.password;
      delete ret.security;
      delete ret.verification;
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ plan: 1 });
userSchema.index({ status: 1 });
userSchema.index({ 'usage.monthly_reset_date': 1 });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName || ''} ${this.lastName || ''}`.trim();
});

// Virtual for remaining requests this month
userSchema.virtual('remainingRequests').get(function() {
  return Math.max(0, this.planLimits.monthly_requests - this.usage.monthly_requests);
});

// Virtual for usage percentage
userSchema.virtual('usagePercentage').get(function() {
  if (this.planLimits.monthly_requests === 0) return 0;
  return Math.min(100, (this.usage.monthly_requests / this.planLimits.monthly_requests) * 100);
});

// Pre-save middleware
userSchema.pre('save', async function(next) {
  // Hash password if modified
  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
  }
  
  // Update plan limits based on plan
  if (this.isModified('plan')) {
    this.updatePlanLimits();
  }
  
  // Reset monthly usage if needed
  if (new Date() >= this.usage.monthly_reset_date) {
    this.resetMonthlyUsage();
  }
  
  next();
});

// Instance methods
userSchema.methods.comparePassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

userSchema.methods.generateJWT = function() {
  return jwt.sign(
    { 
      id: this._id, 
      username: this.username,
      email: this.email,
      role: this.role 
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
};

userSchema.methods.incrementUsage = function() {
  this.usage.total_requests += 1;
  this.usage.monthly_requests += 1;
  this.usage.last_request = new Date();
  return this.save();
};

userSchema.methods.resetMonthlyUsage = function() {
  this.usage.monthly_requests = 0;
  const resetDate = new Date();
  resetDate.setMonth(resetDate.getMonth() + 1);
  resetDate.setDate(1);
  resetDate.setHours(0, 0, 0, 0);
  this.usage.monthly_reset_date = resetDate;
};

userSchema.methods.updatePlanLimits = function() {
  const planConfig = {
    basic: {
      monthly_requests: 1000,
      features: ['basic_facts']
    },
    premium: {
      monthly_requests: 100000,
      features: ['basic_facts', 'all_categories', 'ai_facts', 'priority_support']
    },
    platinum: {
      monthly_requests: -1, // Unlimited
      features: ['basic_facts', 'all_categories', 'ai_facts', 'priority_support', 'custom_integration']
    }
  };
  
  const config = planConfig[this.plan] || planConfig.basic;
  this.planLimits.monthly_requests = config.monthly_requests;
  this.planLimits.features = config.features;
};

userSchema.methods.hasFeature = function(feature) {
  return this.planLimits.features.includes(feature);
};

userSchema.methods.canMakeRequest = function() {
  if (this.status !== 'active') return false;
  if (this.planLimits.monthly_requests === -1) return true; // Unlimited
  return this.usage.monthly_requests < this.planLimits.monthly_requests;
};

userSchema.methods.isAccountLocked = function() {
  return this.security.locked_until && this.security.locked_until > Date.now();
};

userSchema.methods.lockAccount = function(duration = 30 * 60 * 1000) { // 30 minutes default
  this.security.locked_until = Date.now() + duration;
  this.security.login_attempts = 0;
  return this.save();
};

userSchema.methods.recordFailedLogin = function() {
  this.security.login_attempts += 1;
  
  // Lock account after 5 failed attempts
  if (this.security.login_attempts >= 5) {
    return this.lockAccount();
  }
  
  return this.save();
};

userSchema.methods.recordSuccessfulLogin = function() {
  this.security.login_attempts = 0;
  this.security.locked_until = undefined;
  this.security.last_login = new Date();
  return this.save();
};

// Static methods
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

userSchema.statics.findByUsername = function(username) {
  return this.findOne({ username: username.toLowerCase() });
};

userSchema.statics.getActiveUsers = function() {
  return this.find({ status: 'active' });
};

userSchema.statics.getUserStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$plan',
        count: { $sum: 1 },
        total_requests: { $sum: '$usage.total_requests' }
      }
    }
  ]);
};

const User = mongoose.model('User', userSchema);

export default User;