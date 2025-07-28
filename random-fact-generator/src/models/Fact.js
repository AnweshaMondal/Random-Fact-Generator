const mongoose = require('mongoose');

const factSchema = new mongoose.Schema({
  fact_text: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    required: true,
  },
  source: {
    type: String,
    required: true,
  },
}, {
  timestamps: true,
});

const Fact = mongoose.model('Fact', factSchema);

module.exports = Fact;