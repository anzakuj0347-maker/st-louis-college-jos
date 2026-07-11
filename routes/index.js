const express = require('express');
const router = express.Router();
const Page = require('../models/Page');
const Event = require('../models/Event');
const News = require('../models/News');
const HeroSlide = require('../models/HeroSlide');

router.get('/', async (req, res, next) => {
  try {
    const [heroSlides, events, news] = await Promise.all([
      HeroSlide.find({ active: true }).sort('order'),
      Event.find().sort('-eventDate').limit(8),
      News.find().sort('-publishedAt').limit(3)
    ]);
    res.render('pages/home', {
      title: 'Home',
      heroSlides,
      events,
      news
    });
  } catch (err) {
    next(err);
  }
});

router.get('/contact', (req, res) => {
  res.render('pages/contact', { title: 'Contact Us' });
});

router.post('/contact', (req, res) => {
  const { name, email, subject, message } = req.body;
  if (!name || !email || !message) {
    return res.render('pages/contact', {
      title: 'Contact Us',
      error: 'Please fill in all required fields.',
      form: req.body
    });
  }
  res.render('pages/contact', {
    title: 'Contact Us',
    success: 'Thank you for contacting St. Louis College Jos. We will respond shortly.'
  });
});

const sectionRoutes = ['about', 'academics', 'admission', 'student-life', 'downloads'];

sectionRoutes.forEach((section) => {
  router.get(`/${section}/:slug`, async (req, res, next) => {
    try {
      const page = await Page.findOne({ slug: req.params.slug, section });
      if (!page) return res.status(404).render('pages/404', { title: 'Page Not Found' });
      res.render('pages/content', { title: page.title, page });
    } catch (err) {
      next(err);
    }
  });
});

module.exports = router;
