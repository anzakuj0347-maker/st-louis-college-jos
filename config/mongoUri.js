function isHostedEnvironment() {
  return process.env.RENDER === 'true';
}

/**
 * Database URI for the running app (not the sync tool).
 * - Render / production: Atlas via MONGODB_URI or REMOTE_MONGODB_URI
 * - Local offline work: LOCAL_MONGODB_URI
 */
function getAppMongoUri() {
  if (isHostedEnvironment()) {
    return process.env.MONGODB_URI || process.env.REMOTE_MONGODB_URI || '';
  }

  return (
    process.env.LOCAL_MONGODB_URI ||
    process.env.MONGODB_URI ||
    'mongodb://127.0.0.1:27017/stlouis_college_jos'
  );
}

module.exports = {
  isHostedEnvironment,
  getAppMongoUri
};
