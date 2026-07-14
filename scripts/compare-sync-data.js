require('dotenv').config();
const mongoose = require('mongoose');
const { connectRemoteWithFallback, prepareAtlasDns } = require('../utils/atlasUri');

async function open(uri) {
  const c = mongoose.createConnection(uri, { serverSelectionTimeoutMS: 10000 });
  await c.asPromise();
  return c;
}

async function main() {
  prepareAtlasDns();
  const local = await open(process.env.LOCAL_MONGODB_URI);
  const { conn: remote } = await connectRemoteWithFallback((u) => open(u));

  const lSubs = await local.collection('subjects').find().toArray();
  const rSubs = await remote.collection('subjects').find().toArray();
  const lCodeById = new Map(lSubs.map((s) => [String(s._id), s.code]));
  const rCodeById = new Map(rSubs.map((s) => [String(s._id), s.code]));

  const samples = ['SLC/2022/001', 'SLC/2022/002', 'SLC2027001'];
  const lUsers = await local.collection('users').find({ studentId: { $in: samples } }).toArray();
  const rUsers = await remote.collection('users').find({ studentId: { $in: samples } }).toArray();
  const rBySid = new Map(rUsers.map((u) => [u.studentId, u]));

  for (const u of lUsers) {
    const r = rBySid.get(u.studentId);
    const lCodes = (u.offeredSubjects || []).map((id) => lCodeById.get(String(id)) || '?').sort();
    const rCodes = (r.offeredSubjects || []).map((id) => rCodeById.get(String(id)) || 'INVALID').sort();
    console.log('---', u.studentId);
    console.log('local codes:', lCodes.join(', '));
    console.log('remote codes:', rCodes.join(', '));
    console.log('match?', lCodes.join('|') === rCodes.join('|'));
    console.log('updatedAt L/R', u.updatedAt, r?.updatedAt);
  }

  let invalid = 0;
  const allRUsers = await remote.collection('users').find({}, { projection: { offeredSubjects: 1 } }).toArray();
  for (const u of allRUsers) {
    for (const id of u.offeredSubjects || []) {
      if (!rCodeById.has(String(id))) invalid += 1;
    }
  }
  console.log('Invalid remote subject refs:', invalid);

  let codeMismatches = 0;
  const lAll = await local.collection('users').find({}, { projection: { studentId: 1, offeredSubjects: 1, updatedAt: 1 } }).toArray();
  const rAllMap = new Map((await remote.collection('users').find({}, { projection: { studentId: 1, offeredSubjects: 1, updatedAt: 1 } }).toArray()).map((u) => [u.studentId, u]));
  for (const u of lAll) {
    const r = rAllMap.get(u.studentId);
    if (!r) continue;
    const lCodes = (u.offeredSubjects || []).map((id) => lCodeById.get(String(id)) || '?').sort().join('|');
    const rCodes = (r.offeredSubjects || []).map((id) => rCodeById.get(String(id)) || 'INVALID').sort().join('|');
    if (lCodes !== rCodes) codeMismatches += 1;
  }
  console.log('Students with different offer codes:', codeMismatches);

  await local.close();
  await remote.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
