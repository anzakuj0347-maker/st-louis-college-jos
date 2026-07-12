const mongoose = require('mongoose');
const { connectRemoteWithFallback, prepareAtlasDns } = require('./atlasUri');

const COLLECTIONS = {
  subjects: { uniqueKey: 'code' },
  academicsessions: { uniqueKey: 'name' },
  users: { uniqueKey: 'studentId', refFields: [{ field: 'offeredSubjects', collection: 'subjects', mapKey: 'code' }] },
  staffs: {
    uniqueKey: 'staffId',
    refFields: [
      { field: 'assignedSubjects', collection: 'subjects', mapKey: 'code', isArray: true },
      { field: 'classAssignments', collection: 'subjects', mapKey: 'code', nestedField: 'subject', isArray: true }
    ]
  },
  results: {
    compoundKey: true,
    refFields: [
      { field: 'student', collection: 'users', mapKey: 'studentId' },
      { field: 'subject', collection: 'subjects', mapKey: 'code' }
    ]
  },
  heroslides: { uniqueKey: 'order' }
};

function getLocalUri() {
  return process.env.LOCAL_MONGODB_URI || 'mongodb://127.0.0.1:27017/stlouis_college_jos';
}

function getPrimaryUri() {
  return process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/stlouis_college_jos';
}

function getRemoteUri() {
  if (process.env.REMOTE_MONGODB_URI_STANDARD) return process.env.REMOTE_MONGODB_URI_STANDARD;
  if (process.env.REMOTE_MONGODB_URI) return process.env.REMOTE_MONGODB_URI;

  const primary = getPrimaryUri();
  const local = getLocalUri();
  if (primary && primary !== local) return primary;

  return '';
}

async function getResolvedRemoteUri() {
  const uri = getRemoteUri();
  if (!uri) return uri;
  if (process.env.REMOTE_MONGODB_URI_STANDARD) return process.env.REMOTE_MONGODB_URI_STANDARD;
  prepareAtlasDns();
  return uri;
}

async function openRemoteConnection() {
  const { conn } = await connectRemoteWithFallback((uri) => openConnection(uri));
  return conn;
}

function isHostedEnvironment() {
  return process.env.RENDER === 'true';
}

function getUnavailableReason() {
  if (isHostedEnvironment()) {
    return 'Synchronise must be run from your local computer, not the Render website. Start the app on your PC with local MongoDB after working offline, then open Synchronise on localhost.';
  }

  const remote = getRemoteUri();
  if (!remote) {
    return 'No online database found. Set MONGODB_URI to your MongoDB Atlas connection string, or add REMOTE_MONGODB_URI in .env.';
  }

  if (remote === getLocalUri()) {
    return 'Local and online databases are the same. Set MONGODB_URI to Atlas and keep LOCAL_MONGODB_URI pointing to your local MongoDB.';
  }

  return 'Sync is not available.';
}

function isSyncConfigured() {
  if (isHostedEnvironment()) return false;

  const local = getLocalUri();
  const remote = getRemoteUri();
  return Boolean(remote) && remote !== local;
}

function isSyncAvailable() {
  return isSyncConfigured();
}

function emptyCounts() {
  return Object.keys(COLLECTIONS).reduce((acc, key) => {
    acc[key] = { created: 0, updated: 0 };
    return acc;
  }, {});
}

const CONNECT_OPTIONS = {
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000
};

function buildBasePreview(overrides = {}) {
  return {
    onRender: isHostedEnvironment(),
    configured: isSyncConfigured(),
    connected: false,
    available: false,
    canSubmit: false,
    localConnected: false,
    remoteConnected: false,
    localUri: maskUri(getLocalUri()),
    remoteUri: maskUri(getRemoteUri()) || 'Not set',
    reason: '',
    counts: emptyCounts(),
    totals: { created: 0, updated: 0 },
    ...overrides
  };
}

async function openConnection(uri) {
  const conn = mongoose.createConnection(uri, CONNECT_OPTIONS);
  await conn.asPromise();
  return conn;
}

async function testConnection(uri, { remote = false } = {}) {
  let conn;

  try {
    if (remote) {
      conn = await openRemoteConnection();
      return { ok: true, error: null };
    }
    conn = await openConnection(uri);
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err };
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
}

async function testConnections() {
  const [local, remote] = await Promise.all([
    testConnection(getLocalUri()),
    testConnection(getRemoteUri(), { remote: true })
  ]);
  return { local, remote };
}

async function countLocalDocuments(localConn) {
  const counts = {};
  for (const name of Object.keys(COLLECTIONS)) {
    counts[name] = { created: await localConn.collection(name).countDocuments(), updated: 0 };
  }
  return counts;
}

function sumCreated(counts) {
  return Object.values(counts).reduce((sum, row) => sum + (row.created || 0), 0);
}

async function getLocalPreviewCounts() {
  let localConn;
  try {
    localConn = await openConnection(getLocalUri());
    const counts = await countLocalDocuments(localConn);
    return {
      counts,
      totals: { created: sumCreated(counts), updated: 0 },
      localRecordTotal: sumCreated(counts)
    };
  } catch (err) {
    return null;
  } finally {
    if (localConn) await localConn.close().catch(() => {});
  }
}

function toIdString(id) {
  return id ? String(id) : '';
}

function isNewer(localUpdatedAt, remoteUpdatedAt) {
  if (!remoteUpdatedAt) return true;
  if (!localUpdatedAt) return false;
  return new Date(localUpdatedAt) > new Date(remoteUpdatedAt);
}

async function buildIdMap(localCol, remoteCol, localKeyField, remoteKeyField) {
  const map = new Map();
  const localDocs = await localCol.find({}, { projection: { [localKeyField]: 1 } }).toArray();

  for (const doc of localDocs) {
    const keyValue = doc[localKeyField];
    if (keyValue == null) continue;
    const remoteDoc = await remoteCol.findOne({ [remoteKeyField]: keyValue }, { projection: { _id: 1 } });
    if (remoteDoc) {
      map.set(toIdString(doc._id), remoteDoc._id);
    }
  }

  return map;
}

async function resolveSubjectId(localCol, remoteCol, localId) {
  const localDoc = await localCol.findOne({ _id: localId }, { projection: { code: 1 } });
  if (!localDoc) return null;
  const remoteDoc = await remoteCol.findOne({ code: localDoc.code }, { projection: { _id: 1 } });
  return remoteDoc ? remoteDoc._id : null;
}

async function resolveUserId(localUsers, remoteUsers, localId) {
  const localDoc = await localUsers.findOne({ _id: localId }, { projection: { studentId: 1 } });
  if (!localDoc) return null;
  const remoteDoc = await remoteUsers.findOne({ studentId: localDoc.studentId }, { projection: { _id: 1 } });
  return remoteDoc ? remoteDoc._id : null;
}

function remapObjectIds(value, idMap) {
  if (!value) return value;
  const mapped = idMap.get(toIdString(value));
  return mapped || value;
}

function applyRefMappings(doc, refFields, idMaps) {
  const next = { ...doc };

  for (const ref of refFields) {
    if (ref.nestedField) {
      if (!Array.isArray(next[ref.field])) continue;
      next[ref.field] = next[ref.field].map((item) => {
        if (!item || typeof item !== 'object') return item;
        return {
          ...item,
          [ref.nestedField]: remapObjectIds(item[ref.nestedField], idMaps[ref.collection])
        };
      });
      continue;
    }

    if (ref.isArray) {
      if (!Array.isArray(next[ref.field])) continue;
      next[ref.field] = next[ref.field].map((id) => remapObjectIds(id, idMaps[ref.collection]));
      continue;
    }

    next[ref.field] = remapObjectIds(next[ref.field], idMaps[ref.collection]);
  }

  return next;
}

async function countPendingForCollection(localCol, remoteCol, config, idMaps, context) {
  let created = 0;
  let updated = 0;
  const localDocs = await localCol.find().toArray();

  for (const doc of localDocs) {
    let remoteDoc = null;

    if (config.compoundKey) {
      const studentId = await resolveUserId(context.localUsers, context.remoteUsers, doc.student);
      const subjectId = await resolveSubjectId(context.localSubjects, context.remoteSubjects, doc.subject);
      if (!studentId || !subjectId) continue;
      remoteDoc = await remoteCol.findOne({
        student: studentId,
        subject: subjectId,
        term: doc.term,
        session: doc.session,
        arm: doc.arm
      });
    } else {
      remoteDoc = await remoteCol.findOne({ [config.uniqueKey]: doc[config.uniqueKey] });
    }

    if (!remoteDoc) {
      created += 1;
    } else if (isNewer(doc.updatedAt, remoteDoc.updatedAt)) {
      updated += 1;
    }
  }

  return { created, updated };
}

async function syncSimpleCollection(localCol, remoteCol, config, idMaps) {
  const stats = { created: 0, updated: 0, skipped: 0 };
  const localDocs = await localCol.find().toArray();

  for (const doc of localDocs) {
    const remoteDoc = await remoteCol.findOne({ [config.uniqueKey]: doc[config.uniqueKey] });
    const shouldSync = !remoteDoc || isNewer(doc.updatedAt, remoteDoc.updatedAt);

    if (!shouldSync) {
      stats.skipped += 1;
      if (remoteDoc && idMaps[localCol.collectionName]) {
        idMaps[localCol.collectionName].set(toIdString(doc._id), remoteDoc._id);
      }
      continue;
    }

    let payload = { ...doc };
    delete payload._id;

    if (config.refFields) {
      payload = applyRefMappings(payload, config.refFields, idMaps);
    }

    const result = await remoteCol.updateOne(
      { [config.uniqueKey]: doc[config.uniqueKey] },
      { $set: payload },
      { upsert: true }
    );

    const syncedDoc = await remoteCol.findOne({ [config.uniqueKey]: doc[config.uniqueKey] });
    if (syncedDoc && idMaps[localCol.collectionName]) {
      idMaps[localCol.collectionName].set(toIdString(doc._id), syncedDoc._id);
    }

    if (result.upsertedCount > 0) stats.created += 1;
    else stats.updated += 1;
  }

  return stats;
}

async function syncResults(localCol, remoteCol, context) {
  const stats = { created: 0, updated: 0, skipped: 0 };
  const localDocs = await localCol.find().toArray();

  for (const doc of localDocs) {
    const remoteStudentId = await resolveUserId(context.localUsers, context.remoteUsers, doc.student);
    const remoteSubjectId = await resolveSubjectId(context.localSubjects, context.remoteSubjects, doc.subject);

    if (!remoteStudentId || !remoteSubjectId) {
      stats.skipped += 1;
      continue;
    }

    const filter = {
      student: remoteStudentId,
      subject: remoteSubjectId,
      term: doc.term,
      session: doc.session,
      arm: doc.arm
    };

    const remoteDoc = await remoteCol.findOne(filter);
    const shouldSync = !remoteDoc || isNewer(doc.updatedAt, remoteDoc.updatedAt);

    if (!shouldSync) {
      stats.skipped += 1;
      continue;
    }

    const payload = { ...doc };
    delete payload._id;
    payload.student = remoteStudentId;
    payload.subject = remoteSubjectId;

    const result = await remoteCol.updateOne(filter, { $set: payload }, { upsert: true });
    if (result.upsertedCount > 0) stats.created += 1;
    else stats.updated += 1;
  }

  return stats;
}

async function withConnections(fn) {
  let localConn;
  let remoteConn;

  try {
    localConn = await openConnection(getLocalUri());
    remoteConn = await openRemoteConnection();
    return await fn(localConn, remoteConn);
  } finally {
    if (localConn) await localConn.close().catch(() => {});
    if (remoteConn) await remoteConn.close().catch(() => {});
  }
}

async function getSyncPreview() {
  if (isHostedEnvironment()) {
    return buildBasePreview({ reason: getUnavailableReason() });
  }

  if (!isSyncConfigured()) {
    return buildBasePreview({ reason: getUnavailableReason() });
  }

  const connections = await testConnections();
  const localConnected = connections.local.ok;
  const remoteConnected = connections.remote.ok;

  if (!localConnected || !remoteConnected) {
    const localPreview = localConnected ? await getLocalPreviewCounts() : null;
    return buildBasePreview({
      configured: true,
      localConnected,
      remoteConnected,
      reason: buildConnectionReason(connections),
      counts: localPreview?.counts,
      totals: localPreview?.totals,
      localRecordTotal: localPreview?.localRecordTotal || 0,
      showLocalTotals: Boolean(localPreview)
    });
  }

  try {
    const data = await withConnections(async (localConn, remoteConn) => {
    const context = {
      localSubjects: localConn.collection('subjects'),
      remoteSubjects: remoteConn.collection('subjects'),
      localUsers: localConn.collection('users'),
      remoteUsers: remoteConn.collection('users')
    };

    const idMaps = {
      subjects: await buildIdMap(context.localSubjects, context.remoteSubjects, 'code', 'code'),
      users: await buildIdMap(context.localUsers, context.remoteUsers, 'studentId', 'studentId'),
      staffs: new Map()
    };

    const counts = {};

    for (const [name, config] of Object.entries(COLLECTIONS)) {
      counts[name] = await countPendingForCollection(
        localConn.collection(name),
        remoteConn.collection(name),
        config,
        idMaps,
        context
      );
    }

    const totals = Object.values(counts).reduce(
      (acc, item) => ({
        created: acc.created + item.created,
        updated: acc.updated + item.updated
      }),
      { created: 0, updated: 0 }
    );

    return { counts, totals };
    });

    return buildBasePreview({
      connected: true,
      available: true,
      canSubmit: true,
      localConnected: true,
      remoteConnected: true,
      counts: data.counts,
      totals: data.totals
    });
  } catch (err) {
    return buildBasePreview({
      configured: true,
      localConnected,
      remoteConnected,
      reason: `Could not read pending changes: ${err.message || err}`
    });
  }
}

async function runSync() {
  if (!isSyncAvailable()) {
    throw new Error(getUnavailableReason());
  }

  return withConnections(async (localConn, remoteConn) => {
    const context = {
      localSubjects: localConn.collection('subjects'),
      remoteSubjects: remoteConn.collection('subjects'),
      localUsers: localConn.collection('users'),
      remoteUsers: remoteConn.collection('users')
    };

    const idMaps = {
      subjects: new Map(),
      users: new Map(),
      staffs: new Map(),
      academicsessions: new Map()
    };

    const results = {};

    results.subjects = await syncSimpleCollection(
      localConn.collection('subjects'),
      remoteConn.collection('subjects'),
      COLLECTIONS.subjects,
      idMaps
    );

    results.academicsessions = await syncSimpleCollection(
      localConn.collection('academicsessions'),
      remoteConn.collection('academicsessions'),
      COLLECTIONS.academicsessions,
      idMaps
    );

    idMaps.subjects = await buildIdMap(context.localSubjects, context.remoteSubjects, 'code', 'code');

    results.users = await syncSimpleCollection(
      localConn.collection('users'),
      remoteConn.collection('users'),
      COLLECTIONS.users,
      idMaps
    );

    idMaps.users = await buildIdMap(context.localUsers, context.remoteUsers, 'studentId', 'studentId');

    results.staffs = await syncSimpleCollection(
      localConn.collection('staffs'),
      remoteConn.collection('staffs'),
      COLLECTIONS.staffs,
      idMaps
    );

    results.heroslides = await syncSimpleCollection(
      localConn.collection('heroslides'),
      remoteConn.collection('heroslides'),
      COLLECTIONS.heroslides,
      idMaps
    );

    results.results = await syncResults(
      localConn.collection('results'),
      remoteConn.collection('results'),
      context
    );

    const totals = Object.values(results).reduce(
      (acc, item) => ({
        created: acc.created + item.created,
        updated: acc.updated + item.updated,
        skipped: acc.skipped + (item.skipped || 0)
      }),
      { created: 0, updated: 0, skipped: 0 }
    );

    return { results, totals, syncedAt: new Date() };
  });
}

function maskUri(uri) {
  return uri.replace(/\/\/([^:@/]+):([^@/]+)@/, '//$1:****@');
}

function formatConnectionError(err, target) {
  const message = err?.message || String(err);

  if (target === 'remote' || /mongodb\.net|mongodb\+srv|querySrv/i.test(message)) {
    if (/querySrv ECONNREFUSED/i.test(message)) {
      return 'DNS blocked Atlas lookup on this network. The app will retry with a standard connection string. If it still fails, add REMOTE_MONGODB_URI_STANDARD from Atlas → Connect → Drivers (choose “Standard connection string”).';
    }
    if (/Server selection timed out|ETIMEDOUT|ENOTFOUND|querySrv/i.test(message)) {
      return 'Cannot reach MongoDB Atlas. Check your internet connection, Atlas cluster status, and that your IP is allowed in Atlas → Network Access.';
    }
    if (/authentication failed|bad auth/i.test(message)) {
      return 'Atlas login failed. Check the username and password in REMOTE_MONGODB_URI in your .env file.';
    }
    return `Cannot connect to MongoDB Atlas: ${message}`;
  }

  if (/ECONNREFUSED|connect ECONNREFUSED/i.test(message)) {
    return 'Cannot connect to local MongoDB. Start MongoDB first (run start-mongodb.bat), keep that window open, then reload this page.';
  }

  if (/Server selection timed out/i.test(message)) {
    return 'Local MongoDB did not respond in time. Make sure start-mongodb.bat is running, then reload this page.';
  }

  return `Connection failed: ${message}`;
}

function buildConnectionReason(connections) {
  const parts = [];

  if (!connections.local.ok) {
    parts.push(formatConnectionError(connections.local.error, 'local'));
  }
  if (!connections.remote.ok) {
    parts.push(formatConnectionError(connections.remote.error, 'remote'));
  }

  return parts.join(' ');
}

module.exports = {
  isSyncAvailable,
  getSyncPreview,
  runSync,
  getLocalUri,
  getRemoteUri
};
