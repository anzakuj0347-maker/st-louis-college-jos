require('dotenv').config();
const mongoose = require('mongoose');
const { connectRemoteWithFallback, prepareAtlasDns, resolveAtlasUri } = require('../utils/atlasUri');

async function test(label, connectFn) {
  try {
    const { conn, uri } = await connectFn((u) => {
      const c = mongoose.createConnection(u, {
        serverSelectionTimeoutMS: 15000,
        connectTimeoutMS: 15000
      });
      return c.asPromise().then(() => c);
    });
    await conn.close();
    console.log(`✅ ${label}: connected`);
    return true;
  } catch (err) {
    console.log(`❌ ${label}: ${err.message.split('\n')[0]}`);
    return false;
  }
}

(async () => {
  const remote = process.env.REMOTE_MONGODB_URI;
  const standard = process.env.REMOTE_MONGODB_URI_STANDARD;

  if (!remote && !standard) {
    console.log('Add REMOTE_MONGODB_URI to your .env file first.');
    process.exit(1);
  }

  console.log('Testing Atlas connection (same method as Synchronise)...\n');

  if (standard) {
    prepareAtlasDns();
    const ok = await test('Standard URI (REMOTE_MONGODB_URI_STANDARD)', async (open) => {
      const conn = await open(standard);
      return { conn, uri: standard };
    });
    process.exit(ok ? 0 : 1);
  }

  const ok = await test('Atlas via sync connection logic', () => connectRemoteWithFallback(async (uri) => {
    const conn = mongoose.createConnection(uri, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000
    });
    await conn.asPromise();
    return conn;
  }));

  if (!ok) {
    console.log('\nTroubleshooting:');
    console.log('1. Confirm the same connection string works in MongoDB Compass');
    console.log('2. Copy Compass’s connection string into .env as REMOTE_MONGODB_URI_STANDARD=...');
    console.log('3. Restart the app and run npm run test:atlas again');
  }

  process.exit(ok ? 0 : 1);
})();
