const mongoose = require('mongoose');
const { connectRemoteWithFallback, prepareAtlasDns } = require('./atlasUri');
const { readSyncState, markSyncCompleted } = require('./syncState');

const COLLECTIONS = {
  subjects: { uniqueKey: 'code' },
  academicsessions: { compoundUniqueKeys: ['name', 'term'] },
  users: { uniqueKey: 'studentId', refFields: [{ field: 'offeredSubjects', collection: 'subjects', mapKey: 'code', isArray: true }] },
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
  heroslides: { uniqueKey: 'order' },
  pages: { uniqueKey: 'slug' },
  admissionlists: { uniqueKey: 'key' },
  admissionpins: { uniqueKey: 'pin' },
  admissionapplications: {
    uniqueKey: 'applicationId',
    refFields: [{ field: 'admissionPin', collection: 'admissionpins' }]
  },
  events: { compoundUniqueKeys: ['title', 'eventDate'] },
  news: { compoundUniqueKeys: ['title', 'publishedAt'] }
};

const SYNC_STEP_LABELS = {
  connect: 'Connecting to databases',
  subjects: 'Subjects',
  academicsessions: 'Sessions',
  users: 'Students',
  staffs: 'Staff',
  heroslides: 'Hero slides',
  pages: 'Pages',
  admissionlists: 'Admission List PDF',
  admissionpins: 'Admission PINs',
  admissionapplications: 'Admission Applications',
  events: 'Events',
  news: 'News',
  results: 'Results'
};

const SYNC_COLLECTION_ORDER = ['subjects', 'academicsessions', 'users', 'staffs', 'heroslides', 'pages', 'admissionlists', 'admissionpins', 'admissionapplications', 'events', 'news', 'results'];
const SYNC_PREVIEW_TIMEOUT_MS = 15000;
const SYNC_BATCH_SIZE = 100;

function getLocalSyncQuery(lastSyncedAt) {
  if (!lastSyncedAt) return {};
  return { updatedAt: { $gt: lastSyncedAt } };
}

function getRecordKey(doc, config) {
  if (config.compoundUniqueKeys?.length) {
    return config.compoundUniqueKeys
      .map((key) => {
        if (key === 'term') return doc[key] || 'First Term';
        if (key === 'eventDate' || key === 'publishedAt') {
          return new Date(doc[key]).toISOString();
        }
        return String(doc[key] ?? '');
      })
      .join('||');
  }

  return String(doc[config.uniqueKey] ?? '');
}

async function countCollectionPending(localCol, lastSyncedAt) {
  if (!lastSyncedAt) {
    const total = await localCol.countDocuments();
    return { created: total, updated: 0 };
  }

  const pending = await localCol.countDocuments(getLocalSyncQuery(lastSyncedAt));
  return { created: 0, updated: pending };
}

async function getIncrementalPreviewCounts(localConn, lastSyncedAt) {
  const counts = {};

  for (const name of Object.keys(COLLECTIONS)) {
    counts[name] = await countCollectionPending(localConn.collection(name), lastSyncedAt);
  }

  const totals = Object.values(counts).reduce(
    (acc, item) => ({
      created: acc.created + item.created,
      updated: acc.updated + item.updated
    }),
    { created: 0, updated: 0 }
  );

  return { counts, totals, incremental: Boolean(lastSyncedAt) };
}

async function buildRemoteLookupMap(remoteCol, config) {
  const docs = await remoteCol.find({}).toArray();
  const map = new Map();

  for (const doc of docs) {
    map.set(getRecordKey(doc, config), doc);
  }

  return map;
}

async function buildIdMapBulk(localCol, remoteCol, keyField) {
  const map = new Map();
  const [localDocs, remoteDocs] = await Promise.all([
    localCol.find({}, { projection: { [keyField]: 1 } }).toArray(),
    remoteCol.find({}, { projection: { _id: 1, [keyField]: 1 } }).toArray()
  ]);

  const remoteByKey = new Map();
  for (const doc of remoteDocs) {
    if (doc[keyField] == null) continue;
    remoteByKey.set(String(doc[keyField]), doc._id);
  }

  for (const doc of localDocs) {
    if (doc[keyField] == null) continue;
    const remoteId = remoteByKey.get(String(doc[keyField]));
    if (remoteId) map.set(toIdString(doc._id), remoteId);
  }

  return map;
}

function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

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

function sortedIdStrings(values) {
  return [...(values || [])].map((value) => String(value)).sort();
}

function remapRefArray(values, idMap) {
  return [...new Set(
    (values || [])
      .map((value) => {
        const mapped = idMap.get(toIdString(value));
        return mapped ? String(mapped) : null;
      })
      .filter(Boolean)
  )].sort();
}

function hasInvalidRemoteRefs(values, validRemoteIds) {
  return (values || []).some((value) => !validRemoteIds.has(String(value)));
}

async function buildValidRemoteSubjectIds(remoteSubjects) {
  const ids = await remoteSubjects.find({}, { projection: { _id: 1 } }).toArray();
  return new Set(ids.map((doc) => String(doc._id)));
}

function documentsNeedSync(localDoc, remoteDoc, config, idMaps, context = {}) {
  if (!remoteDoc) return true;
  if (isNewer(localDoc.updatedAt, remoteDoc.updatedAt)) return true;

  if (config.uniqueKey === 'code') {
    for (const field of ['name', 'classLevel', 'department']) {
      if (String(localDoc[field] || '') !== String(remoteDoc[field] || '')) return true;
    }
  }

  if (config.compoundUniqueKeys?.includes('term')) {
    if (String(localDoc.name || '') !== String(remoteDoc.name || '')) return true;
    if (Boolean(localDoc.isActive) !== Boolean(remoteDoc.isActive)) return true;
    if (String(localDoc.term || 'First Term') !== String(remoteDoc.term || 'First Term')) return true;
  }

  if (config.compoundUniqueKeys?.includes('eventDate')) {
    for (const field of ['title', 'description', 'location']) {
      if (String(localDoc[field] || '') !== String(remoteDoc[field] || '')) return true;
    }
    if (Boolean(localDoc.featured) !== Boolean(remoteDoc.featured)) return true;
    if (new Date(localDoc.eventDate).getTime() !== new Date(remoteDoc.eventDate).getTime()) return true;
  }

  if (config.compoundUniqueKeys?.includes('publishedAt')) {
    for (const field of ['title', 'excerpt', 'content']) {
      if (String(localDoc[field] || '') !== String(remoteDoc[field] || '')) return true;
    }
    if (Boolean(localDoc.featured) !== Boolean(remoteDoc.featured)) return true;
    if (new Date(localDoc.publishedAt).getTime() !== new Date(remoteDoc.publishedAt).getTime()) return true;
  }

  if (config.uniqueKey === 'slug') {
    for (const field of ['title', 'section', 'content']) {
      if (String(localDoc[field] || '') !== String(remoteDoc[field] || '')) return true;
    }
  }

  if (config.uniqueKey === 'key') {
    for (const field of ['title', 'originalName', 'mimeType']) {
      if (String(localDoc[field] || '') !== String(remoteDoc[field] || '')) return true;
    }
    const localSize = localDoc.data?.length || localDoc.fileSize || 0;
    const remoteSize = remoteDoc.data?.length || remoteDoc.fileSize || 0;
    if (localSize !== remoteSize) return true;
  }

  if (config.uniqueKey === 'pin') {
    for (const field of ['status', 'label', 'createdBy']) {
      if (String(localDoc[field] || '') !== String(remoteDoc[field] || '')) return true;
    }
    if (Boolean(localDoc.usedAt) !== Boolean(remoteDoc.usedAt)) return true;
    if (localDoc.usedAt && remoteDoc.usedAt &&
      new Date(localDoc.usedAt).getTime() !== new Date(remoteDoc.usedAt).getTime()) {
      return true;
    }
  }

  if (config.uniqueKey === 'applicationId') {
    const fields = [
      'firstName', 'middleName', 'lastName', 'gender', 'nationality', 'stateOfOrigin',
      'localGovernment', 'religion', 'classApplyingFor', 'previousSchool', 'lastClassCompleted',
      'parentName', 'parentPhone', 'parentEmail', 'parentAddress', 'emergencyContactName',
      'emergencyContactPhone', 'applicantNotes', 'status', 'adminNotes'
    ];
    for (const field of fields) {
      if (String(localDoc[field] || '') !== String(remoteDoc[field] || '')) return true;
    }
    if (new Date(localDoc.dateOfBirth).getTime() !== new Date(remoteDoc.dateOfBirth).getTime()) return true;

    const remappedPin = remapObjectIds(localDoc.admissionPin, idMaps.admissionpins || new Map());
    if (String(remappedPin || '') !== String(remoteDoc.admissionPin || '')) return true;
  }

  if (config.uniqueKey === 'studentId' && config.refFields) {
    if (String(localDoc.feeStatus || 'paid') !== String(remoteDoc.feeStatus || 'paid')) return true;

    const remappedOffers = remapRefArray(localDoc.offeredSubjects, idMaps.subjects || new Map());
    const remoteOffers = sortedIdStrings(remoteDoc.offeredSubjects);
    if (remappedOffers.join('|') !== remoteOffers.join('|')) return true;
    if (context.validRemoteSubjectIds && hasInvalidRemoteRefs(remoteDoc.offeredSubjects, context.validRemoteSubjectIds)) {
      return true;
    }
  }

  if (config.uniqueKey === 'staffId' && config.refFields) {
    const remappedAssigned = remapRefArray(localDoc.assignedSubjects, idMaps.subjects || new Map());
    const remoteAssigned = sortedIdStrings(remoteDoc.assignedSubjects);
    if (remappedAssigned.join('|') !== remoteAssigned.join('|')) return true;

    const localAssignments = (localDoc.classAssignments || []).map((item) => {
      const subjectId = idMaps.subjects?.get(toIdString(item?.subject));
      return subjectId ? `${item.classLevel || ''}:${String(subjectId)}` : null;
    }).filter(Boolean).sort();
    const remoteAssignments = (remoteDoc.classAssignments || []).map((item) => {
      return item?.subject ? `${item.classLevel || ''}:${String(item.subject)}` : null;
    }).filter(Boolean).sort();
    if (localAssignments.join('|') !== remoteAssignments.join('|')) return true;
  }

  return false;
}

async function buildIdMap(localCol, remoteCol, localKeyField) {
  return buildIdMapBulk(localCol, remoteCol, localKeyField);
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
  return mapped || null;
}

function applyRefMappings(doc, refFields, idMaps) {
  const next = { ...doc };

  for (const ref of refFields) {
    if (ref.nestedField) {
      if (!Array.isArray(next[ref.field])) continue;
      next[ref.field] = next[ref.field]
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const mappedSubject = remapObjectIds(item[ref.nestedField], idMaps[ref.collection]);
          if (!mappedSubject) return null;
          return {
            ...item,
            [ref.nestedField]: mappedSubject
          };
        })
        .filter(Boolean);
      continue;
    }

    if (ref.isArray) {
      if (!Array.isArray(next[ref.field])) continue;
      next[ref.field] = next[ref.field]
        .map((id) => remapObjectIds(id, idMaps[ref.collection]))
        .filter(Boolean);
      continue;
    }

    next[ref.field] = remapObjectIds(next[ref.field], idMaps[ref.collection]);
  }

  return next;
}

function sessionRecordKey(doc) {
  return `${doc.name}||${doc.term || 'First Term'}`;
}

function eventRecordKey(doc) {
  return `${doc.title}||${new Date(doc.eventDate).toISOString()}`;
}

function newsRecordKey(doc) {
  return `${doc.title}||${new Date(doc.publishedAt).toISOString()}`;
}

function getUniqueFilter(doc, config) {
  if (config.compoundUniqueKeys?.length) {
    const filter = {};
    for (const key of config.compoundUniqueKeys) {
      filter[key] = key === 'term' ? (doc[key] || 'First Term') : doc[key];
    }
    return filter;
  }

  return { [config.uniqueKey]: doc[config.uniqueKey] };
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
      remoteDoc = await remoteCol.findOne(getUniqueFilter(doc, config));
    }

    if (!remoteDoc) {
      created += 1;
    } else if (documentsNeedSync(doc, remoteDoc, config, idMaps, context)) {
      updated += 1;
    }
  }

  return { created, updated };
}

async function countRemoteSessionDeletions(localCol, remoteCol) {
  const localKeys = new Set(
    (await localCol.find({}, { projection: { name: 1, term: 1 } }).toArray()).map(sessionRecordKey)
  );
  const remoteDocs = await remoteCol.find({}, { projection: { name: 1, term: 1 } }).toArray();
  return remoteDocs.filter((doc) => !localKeys.has(sessionRecordKey(doc))).length;
}

async function syncSessionDeletions(localCol, remoteCol) {
  const localKeys = new Set(
    (await localCol.find({}, { projection: { name: 1, term: 1 } }).toArray()).map(sessionRecordKey)
  );
  const remoteDocs = await remoteCol.find({}, { projection: { name: 1, term: 1 } }).toArray();
  let deleted = 0;

  for (const doc of remoteDocs) {
    if (!localKeys.has(sessionRecordKey(doc))) {
      await remoteCol.deleteOne({ _id: doc._id });
      deleted += 1;
    }
  }

  return deleted;
}

async function syncAcademicSessions(localCol, remoteCol, config, idMaps, lastSyncedAt) {
  const stats = { created: 0, updated: 0, skipped: 0, deleted: 0 };
  const remoteLookup = await buildRemoteLookupMap(remoteCol, config);
  const localDocs = await localCol.find(getLocalSyncQuery(lastSyncedAt)).toArray();

  for (const doc of localDocs) {
    const uniqueFilter = getUniqueFilter(doc, config);
    const remoteDoc = remoteLookup.get(getRecordKey(doc, config));
    const shouldSync = documentsNeedSync(doc, remoteDoc, config, idMaps);

    if (!shouldSync) {
      stats.skipped += 1;
      if (remoteDoc && idMaps.academicsessions) {
        idMaps.academicsessions.set(toIdString(doc._id), remoteDoc._id);
      }
      continue;
    }

    const payload = { ...doc };
    delete payload._id;

    const result = await remoteCol.updateOne(uniqueFilter, { $set: payload }, { upsert: true });
    const syncedDoc = remoteDoc || (result.upsertedId ? { _id: result.upsertedId } : await remoteCol.findOne(uniqueFilter));

    if (syncedDoc && idMaps.academicsessions) {
      idMaps.academicsessions.set(toIdString(doc._id), syncedDoc._id);
    }

    if (result.upsertedCount > 0) stats.created += 1;
    else stats.updated += 1;
  }

  if (!lastSyncedAt) {
    stats.deleted = await syncSessionDeletions(localCol, remoteCol);
  }

  return stats;
}

async function syncContentCollection(localCol, remoteCol, config, recordKeyFn, lastSyncedAt) {
  const stats = { created: 0, updated: 0, skipped: 0, deleted: 0 };
  const remoteLookup = await buildRemoteLookupMap(remoteCol, config);
  const localDocs = await localCol.find(getLocalSyncQuery(lastSyncedAt)).toArray();
  const localKeys = new Set();

  for (const doc of localDocs) {
    localKeys.add(recordKeyFn(doc));
    const remoteDoc = remoteLookup.get(getRecordKey(doc, config));

    if (!documentsNeedSync(doc, remoteDoc, config)) {
      stats.skipped += 1;
      continue;
    }

    const uniqueFilter = getUniqueFilter(doc, config);
    const payload = { ...doc };
    delete payload._id;

    const result = await remoteCol.updateOne(uniqueFilter, { $set: payload }, { upsert: true });
    if (result.upsertedCount > 0) stats.created += 1;
    else stats.updated += 1;
  }

  if (!lastSyncedAt) {
    const remoteDocs = await remoteCol.find({}, { projection: { title: 1, eventDate: 1, publishedAt: 1 } }).toArray();
    for (const doc of remoteDocs) {
      if (!localKeys.has(recordKeyFn(doc))) {
        await remoteCol.deleteOne({ _id: doc._id });
        stats.deleted += 1;
      }
    }
  }

  return stats;
}

async function countRemoteContentDeletions(localCol, remoteCol, recordKeyFn) {
  const localKeys = new Set(
    (await localCol.find().toArray()).map(recordKeyFn)
  );
  const remoteDocs = await remoteCol.find().toArray();
  return remoteDocs.filter((doc) => !localKeys.has(recordKeyFn(doc))).length;
}

async function ensureRemoteSessionIndexes(remoteConn) {
  const collection = remoteConn.collection('academicsessions');

  try {
    await collection.dropIndex('name_1');
  } catch (_) {
    // Old single-field index may not exist on Atlas yet.
  }

  await collection.createIndex({ name: 1, term: 1 }, { unique: true, name: 'name_1_term_1' });

  const legacySessions = await collection
    .find({ $or: [{ term: { $exists: false } }, { term: null }, { term: '' }] })
    .toArray();

  for (const legacy of legacySessions) {
    const replacement = await collection.findOne({ name: legacy.name, term: 'First Term' });
    if (replacement) {
      await collection.deleteOne({ _id: legacy._id });
    } else {
      await collection.updateOne({ _id: legacy._id }, { $set: { term: 'First Term' } });
    }
  }
}

async function syncSimpleCollection(localCol, remoteCol, config, idMaps, context = {}, lastSyncedAt = null) {
  const stats = { created: 0, updated: 0, skipped: 0 };
  const remoteLookup = await buildRemoteLookupMap(remoteCol, config);
  const localDocs = await localCol.find(getLocalSyncQuery(lastSyncedAt)).toArray();
  const collectionName = localCol.collectionName;
  const pendingWrites = [];

  const flushWrites = async () => {
    if (!pendingWrites.length) return;

    const batch = pendingWrites.splice(0, pendingWrites.length);
    const result = await remoteCol.bulkWrite(batch, { ordered: false });

    stats.created += result.upsertedCount || Object.keys(result.upsertedIds || {}).length;
    stats.updated += result.modifiedCount || 0;
  };

  for (const doc of localDocs) {
    const uniqueFilter = getUniqueFilter(doc, config);
    const remoteDoc = remoteLookup.get(getRecordKey(doc, config));
    const shouldSync = documentsNeedSync(doc, remoteDoc, config, idMaps, context);

    if (!shouldSync) {
      stats.skipped += 1;
      if (remoteDoc && idMaps[collectionName]) {
        idMaps[collectionName].set(toIdString(doc._id), remoteDoc._id);
      }
      continue;
    }

    let payload = { ...doc };
    delete payload._id;

    if (config.refFields) {
      payload = applyRefMappings(payload, config.refFields, idMaps);
    }

    if (config.uniqueKey === 'studentId' && Array.isArray(payload.offeredSubjects)) {
      payload.offeredSubjects = payload.offeredSubjects.filter(Boolean);
    }

    pendingWrites.push({
      updateOne: {
        filter: uniqueFilter,
        update: { $set: payload },
        upsert: true
      }
    });

    if (pendingWrites.length >= SYNC_BATCH_SIZE) {
      await flushWrites();
    }

    if (remoteDoc && idMaps[collectionName]) {
      idMaps[collectionName].set(toIdString(doc._id), remoteDoc._id);
    }
  }

  await flushWrites();
  return stats;
}

async function buildResultSyncContext(localConn, remoteConn) {
  const [localUserDocs, localSubjectDocs, remoteResultDocs] = await Promise.all([
    localConn.collection('users').find({}, { projection: { studentId: 1 } }).toArray(),
    localConn.collection('subjects').find({}, { projection: { code: 1 } }).toArray(),
    remoteConn.collection('results').find({}, {
      projection: { student: 1, subject: 1, term: 1, session: 1, arm: 1, updatedAt: 1 }
    }).toArray()
  ]);

  const localUserStudentId = new Map(localUserDocs.map((doc) => [toIdString(doc._id), doc.studentId]));
  const localSubjectCode = new Map(localSubjectDocs.map((doc) => [toIdString(doc._id), doc.code]));
  const remoteResultMap = new Map();

  for (const doc of remoteResultDocs) {
    remoteResultMap.set(
      `${toIdString(doc.student)}|${toIdString(doc.subject)}|${doc.term}|${doc.session}|${doc.arm}`,
      doc
    );
  }

  return { localUserStudentId, localSubjectCode, remoteResultMap };
}

function resultLookupKey(remoteStudentId, remoteSubjectId, doc) {
  return `${toIdString(remoteStudentId)}|${toIdString(remoteSubjectId)}|${doc.term}|${doc.session}|${doc.arm}`;
}

async function syncResults(localCol, remoteCol, context, idMaps, lastSyncedAt, localConn, remoteConn) {
  const stats = { created: 0, updated: 0, skipped: 0 };
  const resultContext = await buildResultSyncContext(localConn, remoteConn);
  const localDocs = await localCol.find(getLocalSyncQuery(lastSyncedAt)).toArray();
  const pendingWrites = [];

  const flushWrites = async () => {
    if (!pendingWrites.length) return;

    const batch = pendingWrites.splice(0, pendingWrites.length);
    const result = await remoteCol.bulkWrite(batch, { ordered: false });

    stats.created += result.upsertedCount || Object.keys(result.upsertedIds || {}).length;
    stats.updated += result.modifiedCount || 0;
  };

  for (const doc of localDocs) {
    const remoteStudentId = idMaps.users?.get(toIdString(doc.student));
    const remoteSubjectId = idMaps.subjects?.get(toIdString(doc.subject));

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

    const remoteDoc = resultContext.remoteResultMap.get(
      resultLookupKey(remoteStudentId, remoteSubjectId, doc)
    );
    const shouldSync = !remoteDoc || isNewer(doc.updatedAt, remoteDoc.updatedAt);

    if (!shouldSync) {
      stats.skipped += 1;
      continue;
    }

    const payload = { ...doc };
    delete payload._id;
    payload.student = remoteStudentId;
    payload.subject = remoteSubjectId;

    pendingWrites.push({
      updateOne: {
        filter,
        update: { $set: payload },
        upsert: true
      }
    });

    if (pendingWrites.length >= SYNC_BATCH_SIZE) {
      await flushWrites();
    }
  }

  await flushWrites();
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
    const { lastSyncedAt } = readSyncState();
    const data = await withTimeout(
      openConnection(getLocalUri()).then(async (localConn) => {
        try {
          return await getIncrementalPreviewCounts(localConn, lastSyncedAt);
        } finally {
          await localConn.close().catch(() => {});
        }
      }),
      SYNC_PREVIEW_TIMEOUT_MS,
      'Preview timed out while counting pending changes'
    );

    return buildBasePreview({
      connected: true,
      available: true,
      canSubmit: true,
      localConnected: true,
      remoteConnected: true,
      incremental: data.incremental,
      lastSyncedAt,
      counts: data.counts,
      totals: data.totals
    });
  } catch (err) {
    const previewTimedOut = /timed out/i.test(err.message || '');

    if (localConnected && remoteConnected) {
      const localPreview = previewTimedOut ? await getLocalPreviewCounts() : null;
      return buildBasePreview({
        configured: true,
        connected: true,
        available: true,
        canSubmit: true,
        localConnected: true,
        remoteConnected: true,
        reason: previewTimedOut
          ? 'Both databases are connected. Pending counts could not be finished in time, but you can synchronise now.'
          : `Could not read pending changes: ${err.message || err}`,
        counts: localPreview?.counts || emptyCounts(),
        totals: localPreview?.totals || { created: 0, updated: 0 },
        showLocalTotals: Boolean(localPreview)
      });
    }

    return buildBasePreview({
      configured: true,
      localConnected,
      remoteConnected,
      reason: `Could not read pending changes: ${err.message || err}`
    });
  }
}

async function runSync(onProgress) {
  if (!isSyncAvailable()) {
    throw new Error(getUnavailableReason());
  }

  const totalSteps = SYNC_COLLECTION_ORDER.length + 1;
  let step = 0;

  const report = (message, extra = {}) => {
    if (!onProgress) return;
    onProgress({
      step,
      totalSteps,
      percent: Math.min(99, Math.round((step / totalSteps) * 100)),
      message,
      ...extra
    });
  };

  report(SYNC_STEP_LABELS.connect, { collection: 'connect' });

  const syncStartedAt = new Date();
  const { lastSyncedAt } = readSyncState();

  return withConnections(async (localConn, remoteConn) => {
    await ensureRemoteSessionIndexes(remoteConn);

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
      academicsessions: new Map(),
      admissionpins: new Map(),
      admissionapplications: new Map(),
      admissionlists: new Map()
    };

    const results = {};

    step = 1;
    report(`Syncing ${SYNC_STEP_LABELS.subjects}...`, { collection: 'subjects' });
    results.subjects = await syncSimpleCollection(
      localConn.collection('subjects'),
      remoteConn.collection('subjects'),
      COLLECTIONS.subjects,
      idMaps,
      {},
      lastSyncedAt
    );

    step = 2;
    report(`Syncing ${SYNC_STEP_LABELS.academicsessions}...`, { collection: 'academicsessions' });
    results.academicsessions = await syncAcademicSessions(
      localConn.collection('academicsessions'),
      remoteConn.collection('academicsessions'),
      COLLECTIONS.academicsessions,
      idMaps,
      lastSyncedAt
    );

    idMaps.subjects = await buildIdMap(context.localSubjects, context.remoteSubjects, 'code');
    context.validRemoteSubjectIds = await buildValidRemoteSubjectIds(context.remoteSubjects);

    step = 3;
    report(`Syncing ${SYNC_STEP_LABELS.users}...`, { collection: 'users' });
    results.users = await syncSimpleCollection(
      localConn.collection('users'),
      remoteConn.collection('users'),
      COLLECTIONS.users,
      idMaps,
      context,
      lastSyncedAt
    );

    idMaps.users = await buildIdMap(context.localUsers, context.remoteUsers, 'studentId');

    step = 4;
    report(`Syncing ${SYNC_STEP_LABELS.staffs}...`, { collection: 'staffs' });
    results.staffs = await syncSimpleCollection(
      localConn.collection('staffs'),
      remoteConn.collection('staffs'),
      COLLECTIONS.staffs,
      idMaps,
      context,
      lastSyncedAt
    );

    step = 5;
    report(`Syncing ${SYNC_STEP_LABELS.heroslides}...`, { collection: 'heroslides' });
    results.heroslides = await syncSimpleCollection(
      localConn.collection('heroslides'),
      remoteConn.collection('heroslides'),
      COLLECTIONS.heroslides,
      idMaps,
      {},
      lastSyncedAt
    );

    step = 6;
    report(`Syncing ${SYNC_STEP_LABELS.pages}...`, { collection: 'pages' });
    results.pages = await syncSimpleCollection(
      localConn.collection('pages'),
      remoteConn.collection('pages'),
      COLLECTIONS.pages,
      idMaps,
      {},
      lastSyncedAt
    );

    step = 7;
    report(`Syncing ${SYNC_STEP_LABELS.admissionlists}...`, { collection: 'admissionlists' });
    results.admissionlists = await syncSimpleCollection(
      localConn.collection('admissionlists'),
      remoteConn.collection('admissionlists'),
      COLLECTIONS.admissionlists,
      idMaps,
      {},
      lastSyncedAt
    );

    step = 8;
    report(`Syncing ${SYNC_STEP_LABELS.admissionpins}...`, { collection: 'admissionpins' });
    results.admissionpins = await syncSimpleCollection(
      localConn.collection('admissionpins'),
      remoteConn.collection('admissionpins'),
      COLLECTIONS.admissionpins,
      idMaps,
      {},
      lastSyncedAt
    );

    idMaps.admissionpins = await buildIdMap(
      localConn.collection('admissionpins'),
      remoteConn.collection('admissionpins'),
      'pin'
    );

    step = 9;
    report(`Syncing ${SYNC_STEP_LABELS.admissionapplications}...`, { collection: 'admissionapplications' });
    results.admissionapplications = await syncSimpleCollection(
      localConn.collection('admissionapplications'),
      remoteConn.collection('admissionapplications'),
      COLLECTIONS.admissionapplications,
      idMaps,
      {},
      lastSyncedAt
    );

    step = 10;
    report(`Syncing ${SYNC_STEP_LABELS.events}...`, { collection: 'events' });
    results.events = await syncContentCollection(
      localConn.collection('events'),
      remoteConn.collection('events'),
      COLLECTIONS.events,
      eventRecordKey,
      lastSyncedAt
    );

    step = 11;
    report(`Syncing ${SYNC_STEP_LABELS.news}...`, { collection: 'news' });
    results.news = await syncContentCollection(
      localConn.collection('news'),
      remoteConn.collection('news'),
      COLLECTIONS.news,
      newsRecordKey,
      lastSyncedAt
    );

    step = 12;
    report(`Syncing ${SYNC_STEP_LABELS.results}...`, { collection: 'results' });
    results.results = await syncResults(
      localConn.collection('results'),
      remoteConn.collection('results'),
      context,
      idMaps,
      lastSyncedAt,
      localConn,
      remoteConn
    );

    step = totalSteps;
    const totals = Object.values(results).reduce(
      (acc, item) => ({
        created: acc.created + item.created,
        updated: acc.updated + item.updated,
        skipped: acc.skipped + (item.skipped || 0),
        deleted: acc.deleted + (item.deleted || 0)
      }),
      { created: 0, updated: 0, skipped: 0, deleted: 0 }
    );

    markSyncCompleted(syncStartedAt);

    const payload = { results, totals, syncedAt: syncStartedAt, incremental: Boolean(lastSyncedAt) };

    if (onProgress) {
      onProgress({
        step: totalSteps,
        totalSteps,
        percent: 100,
        message: 'Synchronisation complete',
        collection: 'done',
        result: payload
      });
    }

    return payload;
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
  getRemoteUri,
  SYNC_STEP_LABELS
};
