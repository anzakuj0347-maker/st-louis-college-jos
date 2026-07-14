const mongoose = require('mongoose');
const { getAppMongoUri, isHostedEnvironment } = require('./mongoUri');
const { prepareAtlasDns } = require('../utils/atlasUri');

const CONNECT_OPTIONS = {
  serverSelectionTimeoutMS: 15000,
  connectTimeoutMS: 15000
};

const connectDB = async () => {
  const uri = getAppMongoUri();

  if (!uri) {
    throw new Error(
      isHostedEnvironment()
        ? 'Set MONGODB_URI to your MongoDB Atlas connection string in the Render dashboard (Environment variables).'
        : 'No MongoDB URI configured.'
    );
  }

  if (uri.startsWith('mongodb+srv://')) {
    prepareAtlasDns();
  }

  await mongoose.connect(uri, CONNECT_OPTIONS);
  console.log('MongoDB connected');

  const AcademicSession = require('../models/AcademicSession');
  const sessionCollection = mongoose.connection.collection('academicsessions');
  try {
    await sessionCollection.dropIndex('name_1');
  } catch (_) {
    // Old single-field index may not exist.
  }
  await AcademicSession.syncIndexes();

  const sessionCount = await AcademicSession.countDocuments();
  if (sessionCount === 0) {
    await AcademicSession.create({ name: '2025/2026', term: 'First Term', isActive: true });
    console.log('Default academic session 2025/2026 created and activated.');
  }
};

module.exports = connectDB;
