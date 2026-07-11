const mongoose = require('mongoose');

const newsSchema = new mongoose.Schema({
  title: { type: String, required: true },
  excerpt: String,
  content: String,
  publishedAt: { type: Date, default: Date.now },
  featured: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('News', newsSchema);
