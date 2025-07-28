import mongoose from 'mongoose';

const factSchema = new mongoose.Schema({
  fact: {
    type: String,
    required: true,
    minlength: [10, 'Fact must be at least 10 characters long'],
    maxlength: [1000, 'Fact must be less than 1000 characters'],
    trim: true
  },
  category: {
    type: String,
    required: true,
    lowercase: true,
    enum: [
      'science', 'history', 'technology', 'nature', 'space', 'animals',
      'geography', 'sports', 'entertainment', 'health', 'food', 'general'
    ],
    index: true
  },
  source: {
    type: String,
    required: true,
    default: 'Unknown'
  },
  source_url: {
    type: String,
    validate: {
      validator: function(v) {
        return !v || /^https?:\/\/.+/.test(v);
      },
      message: 'Source URL must be a valid HTTP/HTTPS URL'
    }
  },
  verified: {
    type: Boolean,
    default: false,
    index: true
  },
  verification_date: {
    type: Date
  },
  verified_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  tags: [{
    type: String,
    lowercase: true,
    trim: true
  }],
  difficulty_level: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'intermediate'
  },
  view_count: {
    type: Number,
    default: 0,
    min: 0
  },
  likes: {
    type: Number,
    default: 0,
    min: 0
  },
  dislikes: {
    type: Number,
    default: 0,
    min: 0
  },
  ai_generated: {
    type: Boolean,
    default: false,
    index: true
  },
  ai_model: {
    type: String
  },
  moderation_score: {
    type: Number,
    min: 0,
    max: 1
  },
  language: {
    type: String,
    default: 'en',
    lowercase: true
  },
  reading_time_seconds: {
    type: Number,
    min: 1
  },
  featured: {
    type: Boolean,
    default: false,
    index: true
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updated_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  meta: {
    keywords: [String],
    description: String,
    external_id: String
  }
}, {
  timestamps: { 
    createdAt: 'created_at', 
    updatedAt: 'updated_at' 
  },
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Indexes for performance
factSchema.index({ category: 1, verified: 1 });
factSchema.index({ created_at: -1 });
factSchema.index({ view_count: -1 });
factSchema.index({ likes: -1 });
factSchema.index({ tags: 1 });
factSchema.index({ ai_generated: 1 });

// Text index for search functionality
factSchema.index({ 
  fact: 'text', 
  tags: 'text',
  'meta.keywords': 'text'
}, {
  weights: {
    fact: 10,
    tags: 5,
    'meta.keywords': 3
  }
});

// Virtual for popularity score
factSchema.virtual('popularity_score').get(function() {
  return (this.likes * 2) + this.view_count - (this.dislikes * 0.5);
});

// Virtual for engagement rate
factSchema.virtual('engagement_rate').get(function() {
  if (this.view_count === 0) return 0;
  return ((this.likes + this.dislikes) / this.view_count) * 100;
});

// Virtual for estimated reading time
factSchema.virtual('estimated_reading_time').get(function() {
  if (this.reading_time_seconds) return this.reading_time_seconds;
  // Estimate: average reading speed 200 words per minute
  const words = this.fact.split(' ').length;
  return Math.max(Math.ceil((words / 200) * 60), 5); // minimum 5 seconds
});

// Pre-save middleware
factSchema.pre('save', function(next) {
  // Auto-generate tags if not provided
  if (!this.tags || this.tags.length === 0) {
    this.tags = [this.category];
  }
  
  // Calculate reading time
  if (!this.reading_time_seconds) {
    const words = this.fact.split(' ').length;
    this.reading_time_seconds = Math.max(Math.ceil((words / 200) * 60), 5);
  }
  
  // Auto-verify AI facts with high moderation scores
  if (this.ai_generated && this.moderation_score >= 0.9 && !this.verified) {
    this.verified = true;
    this.verification_date = new Date();
  }
  
  next();
});

// Instance methods
factSchema.methods.incrementViews = function() {
  this.view_count = (this.view_count || 0) + 1;
  return this.save();
};

factSchema.methods.addLike = function() {
  this.likes = (this.likes || 0) + 1;
  return this.save();
};

factSchema.methods.addDislike = function() {
  this.dislikes = (this.dislikes || 0) + 1;
  return this.save();
};

factSchema.methods.verify = function(verifiedBy) {
  this.verified = true;
  this.verification_date = new Date();
  if (verifiedBy) {
    this.verified_by = verifiedBy;
  }
  return this.save();
};

// Static methods
factSchema.statics.getRandomByCategory = function(category) {
  const query = category ? { category, verified: true } : { verified: true };
  return this.aggregate([
    { $match: query },
    { $sample: { size: 1 } }
  ]);
};

factSchema.statics.getTopRated = function(limit = 10) {
  return this.find({ verified: true })
    .sort({ likes: -1, view_count: -1 })
    .limit(limit);
};

factSchema.statics.getRecentlyAdded = function(limit = 10) {
  return this.find({ verified: true })
    .sort({ created_at: -1 })
    .limit(limit);
};

factSchema.statics.getTrending = function(limit = 10) {
  // Facts with high engagement in the last 7 days
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return this.find({ 
    verified: true,
    updated_at: { $gte: weekAgo }
  })
  .sort({ view_count: -1, likes: -1 })
  .limit(limit);
};

factSchema.statics.searchFacts = function(query, options = {}) {
  const searchQuery = {
    $text: { $search: query },
    verified: true
  };
  
  if (options.category) {
    searchQuery.category = options.category;
  }
  
  return this.find(searchQuery, { score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' } })
    .limit(options.limit || 20);
};

const Fact = mongoose.model('Fact', factSchema);

export default Fact;