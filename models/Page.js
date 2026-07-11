const mongoose = require('mongoose');

const pageSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  section: { type: String, required: true },
  content: { type: String, required: true },
  metaDescription: String,
  order: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Page', pageSchema);
