require('dotenv').config();
const mongoose = require('mongoose');
const { connectRemoteWithFallback } = require('../utils/atlasUri');
const { getAppMongoUri } = require('../config/mongoUri');

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

async function pushCollection(localConn, remoteConn, name, uniqueKey) {
  const docs = await localConn.collection(name).find({}).toArray();
  let created = 0;
  let updated = 0;

  for (const doc of docs) {
    const payload = { ...doc };
    delete payload._id;

    const result = await remoteConn.collection(name).updateOne(
      { [uniqueKey]: doc[uniqueKey] },
      { $set: payload },
      { upsert: true }
    );

    if (result.upsertedCount > 0) created += 1;
    else if (result.modifiedCount > 0) updated += 1;
  }

  return { total: docs.length, created, updated };
}

async function main() {
  const localUri = getAppMongoUri();
  const localConn = mongoose.createConnection(localUri, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000
  });
  await localConn.asPromise();

  const remoteConn = await openRemote();

  const pins = await pushCollection(localConn, remoteConn, 'admissionpins', 'pin');
  const applications = await pushCollection(localConn, remoteConn, 'admissionapplications', 'applicationId');
  const lists = await pushCollection(localConn, remoteConn, 'admissionlists', 'key');

  console.log(`Admission PINs: pushed ${pins.total} (${pins.created} new, ${pins.updated} updated)`);
  console.log(`Admission Applications: pushed ${applications.total} (${applications.created} new, ${applications.updated} updated)`);
  console.log(`Admission List PDF: pushed ${lists.total} (${lists.created} new, ${lists.updated} updated)`);

  await localConn.close();
  await remoteConn.close();
}

main().catch((err) => {
  console.error('Push failed:', err.message);
  process.exit(1);
});
