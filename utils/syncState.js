const fs = require('fs');
const path = require('path');

const STATE_PATH = path.join(__dirname, '..', 'data', 'sync-state.json');

function readSyncState() {
  try {
    const raw = fs.readFileSync(STATE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      lastSyncedAt: parsed.lastSyncedAt ? new Date(parsed.lastSyncedAt) : null
    };
  } catch (_) {
    return { lastSyncedAt: null };
  }
}

function writeSyncState(state) {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify({
    lastSyncedAt: state.lastSyncedAt ? new Date(state.lastSyncedAt).toISOString() : null
  }, null, 2));
}

function markSyncCompleted(at = new Date()) {
  writeSyncState({ lastSyncedAt: at });
}

module.exports = {
  readSyncState,
  writeSyncState,
  markSyncCompleted
};
