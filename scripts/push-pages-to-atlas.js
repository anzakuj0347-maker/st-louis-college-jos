require('dotenv').config();
const mongoose = require('mongoose');
const { connectRemoteWithFallback } = require('../utils/atlasUri');
const { getAppMongoUri } = require('../config/mongoUri');
const leadershipContent = require('../config/leadershipContent');

async function openRemote() {
  const { conn } = await connectRemoteWithFallback((uri) => {
    const connection = mongoose.createConnection(uri, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000
    });
    return connection.asPromise().then(() => connection);
  });
  return conn;
}

async function main() {
  const localUri = getAppMongoUri();
  const localConn = mongoose.createConnection(localUri, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000
  });
  await localConn.asPromise();

  await localConn.collection('pages').updateOne(
    { slug: 'school-leadership', section: 'about' },
    {
      $set: {
        title: 'School Leadership',
        section: 'about',
        content: leadershipContent,
        updatedAt: new Date()
      }
    }
  );

  const pages = await localConn.collection('pages').find({}).toArray();
  const remoteConn = await openRemote();
  let created = 0;
  let updated = 0;

  for (const page of pages) {
    const payload = { ...page };
    delete payload._id;

    const result = await remoteConn.collection('pages').updateOne(
      { slug: page.slug },
      { $set: payload },
      { upsert: true }
    );

    if (result.upsertedCount > 0) created += 1;
    else if (result.modifiedCount > 0) updated += 1;
  }

  console.log(`Pushed ${pages.length} page(s) to Atlas (${created} new, ${updated} updated).`);
  console.log('School Leadership page is now updated on the online database.');

  await localConn.close();
  await remoteConn.close();
}

main().catch((err) => {
  console.error('Push failed:', err.message);
  process.exit(1);
});
