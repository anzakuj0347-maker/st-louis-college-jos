require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  try {
    console.log("URI:", process.env.MONGODB_URI);

    await mongoose.connect(process.env.MONGODB_URI);

    console.log("✅ Connected to MongoDB Atlas successfully!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Connection failed");
    console.error(err);
    process.exit(1);
  }
})();