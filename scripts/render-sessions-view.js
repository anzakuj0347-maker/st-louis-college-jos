require('dotenv').config();
const mongoose = require('mongoose');
const { connectRemoteWithFallback, prepareAtlasDns } = require('../utils/atlasUri');

async function open(uri) {
  const conn = mongoose.createConnection(uri, { serverSelectionTimeoutMS: 10000 });
  await conn.asPromise();
  return conn;
}

function renderSessionsTable(label, sessions) {
  console.log(`\n=== ${label} (what Manage Session would show) ===`);
  console.log(`All Sessions (${sessions.length})`);
  if (!sessions.length) {
    console.log('  (empty)');
    return;
  }
  console.log('  Session          | Term         | Status');
  console.log('  -----------------|--------------|--------');
  for (const s of sessions) {
    const term = s.term || '—';
    const status = s.isActive ? 'Active' : 'Inactive';
    console.log(`  ${String(s.name).padEnd(16)} | ${String(term).padEnd(12)} | ${status}`);
  }
}

async function main() {
  prepareAtlasDns();
  const local = await open(process.env.LOCAL_MONGODB_URI);
  const { conn: remote } = await connectRemoteWithFallback((uri) => open(uri));

  const sort = { name: 1, term: 1 };
  const localSessions = await local.collection('academicsessions').find().sort(sort).toArray();
  const remoteSessions = await remote.collection('academicsessions').find().sort(sort).toArray();

  renderSessionsTable('LOCAL (localhost:3000)', localSessions);
  renderSessionsTable('ONLINE (louisvillejos.sch.ng / Atlas)', remoteSessions);

  const localKeys = localSessions.map((s) => `${s.name}||${s.term || ''}`).sort();
  const remoteKeys = remoteSessions.map((s) => `${s.name}||${s.term || ''}`).sort();
  console.log('\n=== DATA COMPARISON ===');
  console.log('Same session list?', localKeys.join('|') === remoteKeys.join('|') ? 'YES' : 'NO');
  if (localKeys.join('|') !== remoteKeys.join('|')) {
    console.log('Only local:', localKeys.filter((k) => !remoteKeys.includes(k)));
    console.log('Only online:', remoteKeys.filter((k) => !localKeys.includes(k)));
  }

  await local.close();
  await remote.close();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
