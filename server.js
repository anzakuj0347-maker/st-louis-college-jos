require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const connectDB = require('./config/db');
const { getAppMongoUri, isHostedEnvironment } = require('./config/mongoUri');
const navigation = require('./config/navigation');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const mongoUrl = getAppMongoUri();
if (!mongoUrl) {
  console.error(
    isHostedEnvironment()
      ? 'Missing MONGODB_URI on Render. Add your Atlas connection string under Environment → Environment Variables.'
      : 'Missing MongoDB URI. Set LOCAL_MONGODB_URI or MONGODB_URI in .env'
  );
  process.exit(1);
}

app.use(session({
  secret: process.env.SESSION_SECRET || 'stlouis-college-jos-secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl }),
  cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

app.use((req, res, next) => {
  res.locals.navigation = navigation;
  res.locals.currentPath = req.path;
  res.locals.user = req.session.user || null;
  res.locals.schoolName = 'St. Louis College Jos';
  next();
});

app.use('/', require('./routes/index'));
app.use('/results', require('./routes/auth'));
app.use('/staff', require('./routes/staffAuth'));
app.use('/slc-admin', require('./routes/admin'));
app.use('/press-club', require('./routes/pressClub'));

app.use((req, res) => {
  res.status(404).render('pages/404', { title: 'Page Not Found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('pages/error', { title: 'Error', message: err.message });
});

async function start() {
  try {
    await connectDB();
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    if (!isHostedEnvironment()) {
      console.error('');
      console.error('MongoDB is not running. Start it first:');
      console.error('  Option 1: Double-click start-mongodb.bat in this folder');
      console.error('  Option 2: Run in a separate terminal:');
      console.error('    "C:\\Program Files\\MongoDB\\Server\\4.4\\bin\\mongod.exe" --dbpath "data\\db"');
      console.error('');
      console.error('Then run: npm start');
    }
    process.exit(1);
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`St. Louis College Jos website running at http://localhost:${PORT}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Either stop the other process or set PORT in .env to a different number.`);
      console.error('Windows: netstat -ano | findstr :' + PORT);
      console.error('Then:   taskkill /PID <pid> /F');
      process.exit(1);
    }
    throw err;
  });
}

start();
