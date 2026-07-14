const express = require('express');
const router = express.Router();
const PressClub = require('../models/PressClub');
const Event = require('../models/Event');
const News = require('../models/News');
const { requirePressClub } = require('../middleware/pressClubAuth');
const { parseDateTimeLocal, toDateTimeLocalValue } = require('../utils/dateHelpers');

function renderPressClub(res, view, data = {}) {
  res.render(view, {
    title: data.title || 'Press Club',
    pageTitle: data.pageTitle || 'Press Club',
    activeSection: data.activeSection || '',
    error: null,
    success: null,
    ...data
  });
}

router.get('/login', (req, res) => {
  if (req.session.pressClub) return res.redirect('/press-club/events');
  renderPressClub(res, 'press-club/login', { title: 'Press Club Login', error: null });
});

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const member = await PressClub.findOne({ username: username?.trim() });
    if (!member || !(await member.comparePassword(password))) {
      return renderPressClub(res, 'press-club/login', {
        title: 'Press Club Login',
        error: 'Invalid username or password.'
      });
    }
    req.session.pressClub = {
      id: member._id,
      username: member.username,
      name: member.name
    };
    res.redirect('/press-club/events');
  } catch (err) {
    next(err);
  }
});

router.post('/logout', requirePressClub, (req, res) => {
  delete req.session.pressClub;
  res.redirect('/press-club/login');
});

router.get('/', requirePressClub, (req, res) => {
  res.redirect('/press-club/events');
});

/* ----- Events ----- */
router.get('/events', requirePressClub, async (req, res, next) => {
  try {
    const events = await Event.find().sort('-eventDate');
    renderPressClub(res, 'press-club/events', {
      title: 'Manage Events',
      pageTitle: 'School Events',
      activeSection: 'events',
      events,
      editEvent: null,
      toDateTimeLocalValue,
      success: req.query.success ? decodeURIComponent(req.query.success) : null,
      error: req.query.error ? decodeURIComponent(req.query.error) : null
    });
  } catch (err) {
    next(err);
  }
});

router.post('/events', requirePressClub, async (req, res, next) => {
  try {
    const title = req.body.title?.trim();
    const eventDate = parseDateTimeLocal(req.body.eventDate);

    if (!title) {
      return res.redirect(`/press-club/events?error=${encodeURIComponent('Event title is required.')}`);
    }
    if (!eventDate) {
      return res.redirect(`/press-club/events?error=${encodeURIComponent('A valid date and time is required.')}`);
    }

    await Event.create({
      title,
      description: req.body.description?.trim() || '',
      eventDate,
      location: req.body.location?.trim() || '',
      featured: req.body.featured === 'true'
    });

    res.redirect(`/press-club/events?success=${encodeURIComponent('Event added successfully.')}`);
  } catch (err) {
    next(err);
  }
});

router.get('/events/:id/edit', requirePressClub, async (req, res, next) => {
  try {
    const [events, editEvent] = await Promise.all([
      Event.find().sort('-eventDate'),
      Event.findById(req.params.id)
    ]);
    if (!editEvent) return res.redirect('/press-club/events');

    renderPressClub(res, 'press-club/events', {
      title: 'Manage Events',
      pageTitle: 'School Events',
      activeSection: 'events',
      events,
      editEvent,
      toDateTimeLocalValue,
      error: null,
      success: null
    });
  } catch (err) {
    next(err);
  }
});

router.post('/events/:id', requirePressClub, async (req, res, next) => {
  try {
    const title = req.body.title?.trim();
    const eventDate = parseDateTimeLocal(req.body.eventDate);

    if (!title) {
      return res.redirect(`/press-club/events?error=${encodeURIComponent('Event title is required.')}`);
    }
    if (!eventDate) {
      return res.redirect(`/press-club/events?error=${encodeURIComponent('A valid date and time is required.')}`);
    }

    await Event.findByIdAndUpdate(
      req.params.id,
      {
        title,
        description: req.body.description?.trim() || '',
        eventDate,
        location: req.body.location?.trim() || '',
        featured: req.body.featured === 'true'
      },
      { timestamps: true }
    );

    res.redirect(`/press-club/events?success=${encodeURIComponent('Event updated successfully.')}`);
  } catch (err) {
    next(err);
  }
});

router.post('/events/:id/delete', requirePressClub, async (req, res, next) => {
  try {
    await Event.findByIdAndDelete(req.params.id);
    res.redirect(`/press-club/events?success=${encodeURIComponent('Event deleted.')}`);
  } catch (err) {
    next(err);
  }
});

/* ----- News ----- */
router.get('/news', requirePressClub, async (req, res, next) => {
  try {
    const newsItems = await News.find().sort('-publishedAt');
    renderPressClub(res, 'press-club/news', {
      title: 'Manage News',
      pageTitle: 'School News',
      activeSection: 'news',
      newsItems,
      editNews: null,
      toDateTimeLocalValue,
      success: req.query.success ? decodeURIComponent(req.query.success) : null,
      error: req.query.error ? decodeURIComponent(req.query.error) : null
    });
  } catch (err) {
    next(err);
  }
});

router.post('/news', requirePressClub, async (req, res, next) => {
  try {
    const title = req.body.title?.trim();
    const publishedAt = parseDateTimeLocal(req.body.publishedAt) || new Date();

    if (!title) {
      return res.redirect(`/press-club/news?error=${encodeURIComponent('News title is required.')}`);
    }

    await News.create({
      title,
      excerpt: req.body.excerpt?.trim() || '',
      content: req.body.content?.trim() || '',
      publishedAt,
      featured: req.body.featured === 'true'
    });

    res.redirect(`/press-club/news?success=${encodeURIComponent('News article added successfully.')}`);
  } catch (err) {
    next(err);
  }
});

router.get('/news/:id/edit', requirePressClub, async (req, res, next) => {
  try {
    const [newsItems, editNews] = await Promise.all([
      News.find().sort('-publishedAt'),
      News.findById(req.params.id)
    ]);
    if (!editNews) return res.redirect('/press-club/news');

    renderPressClub(res, 'press-club/news', {
      title: 'Manage News',
      pageTitle: 'School News',
      activeSection: 'news',
      newsItems,
      editNews,
      toDateTimeLocalValue,
      error: null,
      success: null
    });
  } catch (err) {
    next(err);
  }
});

router.post('/news/:id', requirePressClub, async (req, res, next) => {
  try {
    const title = req.body.title?.trim();
    const publishedAt = parseDateTimeLocal(req.body.publishedAt);

    if (!title) {
      return res.redirect(`/press-club/news?error=${encodeURIComponent('News title is required.')}`);
    }
    if (!publishedAt) {
      return res.redirect(`/press-club/news?error=${encodeURIComponent('A valid publish date is required.')}`);
    }

    await News.findByIdAndUpdate(
      req.params.id,
      {
        title,
        excerpt: req.body.excerpt?.trim() || '',
        content: req.body.content?.trim() || '',
        publishedAt,
        featured: req.body.featured === 'true'
      },
      { timestamps: true }
    );

    res.redirect(`/press-club/news?success=${encodeURIComponent('News article updated successfully.')}`);
  } catch (err) {
    next(err);
  }
});

router.post('/news/:id/delete', requirePressClub, async (req, res, next) => {
  try {
    await News.findByIdAndDelete(req.params.id);
    res.redirect(`/press-club/news?success=${encodeURIComponent('News article deleted.')}`);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
