const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.LOCAL_MONGODB_URI || 'mongodb://127.0.0.1:27017/stlouis_college_jos';
  await mongoose.connect(uri);
  console.log('MongoDB connected');

  const AcademicSession = require('../models/AcademicSession');
  const sessionCount = await AcademicSession.countDocuments();
  if (sessionCount === 0) {
    await AcademicSession.create({ name: '2025/2026', isActive: true });
    console.log('Default academic session 2025/2026 created and activated.');
  }
};

module.exports = connectDB;
