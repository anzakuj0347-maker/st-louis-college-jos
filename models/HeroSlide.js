const mongoose = require('mongoose');

const heroSlideSchema = new mongoose.Schema({
  image: { type: String, required: true },
  title: String,
  subtitle: String,
  order: { type: Number, default: 0 },
  active: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('HeroSlide', heroSlideSchema);
