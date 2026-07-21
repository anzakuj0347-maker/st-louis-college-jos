const dns = require('dns');
const dnsPromises = dns.promises;

const PUBLIC_DNS = ['8.8.8.8', '8.8.4.4', '1.1.1.1'];

function prepareAtlasDns() {
  dns.setServers(PUBLIC_DNS);
}

function parseSrvUri(uri) {
  if (!uri || !uri.startsWith('mongodb+srv://')) {
    return null;
  }

  const withoutScheme = uri.slice('mongodb+srv://'.length);
  const atIndex = withoutScheme.lastIndexOf('@');
  if (atIndex === -1) return null;

  const authPart = withoutScheme.slice(0, atIndex);
  const hostPart = withoutScheme.slice(atIndex + 1);
  const colonIndex = authPart.indexOf(':');
  if (colonIndex === -1) return null;

  const username = decodeURIComponent(authPart.slice(0, colonIndex));
  const password = decodeURIComponent(authPart.slice(colonIndex + 1));
  const slashIndex = hostPart.indexOf('/');
  const hostname = slashIndex === -1 ? hostPart : hostPart.slice(0, slashIndex);
  const pathAndQuery = slashIndex === -1 ? '' : hostPart.slice(slashIndex + 1);
  const questionIndex = pathAndQuery.indexOf('?');
  const database = questionIndex === -1 ? pathAndQuery : pathAndQuery.slice(0, questionIndex);
  const query = questionIndex === -1 ? '' : pathAndQuery.slice(questionIndex + 1);

  return { username, password, hostname, database, query };
}

async function resolveSrvRecords(hostname) {
  const lookupHost = `_mongodb._tcp.${hostname}`;
  const errors = [];

  for (const servers of [PUBLIC_DNS, null]) {
    try {
      if (servers) dns.setServers(servers);
      return await dnsPromises.resolveSrv(lookupHost);
    } catch (err) {
      errors.push(err.message || String(err));
    }
  }

  throw new Error(errors.join(' | '));
}

function buildStandardUri({ username, password, hostname, database, query }, srvRecords) {
  const hosts = srvRecords.map((record) => `${record.name}:${record.port}`).join(',');
  const params = new URLSearchParams(query);

  params.set('ssl', 'true');
  params.set('authSource', 'admin');

  if (!params.has('retryWrites')) params.set('retryWrites', 'true');
  if (!params.has('w')) params.set('w', 'majority');

  params.delete('appName');

  // Do not set replicaSet — an incorrect name causes server selection timeout.
  // The driver discovers the replica set from the host list (same as Compass).

  const auth = `${encodeURIComponent(username)}:${encodeURIComponent(password)}@`;
  return `mongodb://${auth}${hosts}/${database}?${params.toString()}`;
}

async function resolveAtlasUri(uri) {
  if (!uri) return uri;
  if (process.env.REMOTE_MONGODB_URI_STANDARD) return process.env.REMOTE_MONGODB_URI_STANDARD;
  if (!uri.startsWith('mongodb+srv://')) return uri;

  prepareAtlasDns();

  const parsed = parseSrvUri(uri);
  if (!parsed) return uri;

  const srvRecords = await resolveSrvRecords(parsed.hostname);
  return buildStandardUri(parsed, srvRecords);
}

async function connectRemoteUri() {
  prepareAtlasDns();

  if (process.env.REMOTE_MONGODB_URI_STANDARD) {
    return process.env.REMOTE_MONGODB_URI_STANDARD;
  }

  const uri = process.env.REMOTE_MONGODB_URI || '';
  if (!uri.startsWith('mongodb+srv://')) return uri;

  // Try SRV first (works once DNS uses public resolvers, like Compass).
  return uri;
}

async function connectRemoteWithFallback(openConnection) {
  prepareAtlasDns();
  const primaryUri = await connectRemoteUri();

  try {
    return { conn: await openConnection(primaryUri), uri: primaryUri };
  } catch (err) {
    const srvUri = process.env.REMOTE_MONGODB_URI;
    if (!srvUri?.startsWith('mongodb+srv://')) throw err;

    const message = err?.message || '';
    const shouldFallback = /querySrv|Server selection timed out|ENOTFOUND|ETIMEDOUT|ECONNRESET|socket|closed|authentication failed|bad auth/i.test(message);
    if (!shouldFallback) throw err;

    const fallbackUri = await resolveAtlasUri(srvUri);
    if (fallbackUri === primaryUri) throw err;

    return { conn: await openConnection(fallbackUri), uri: fallbackUri };
  }
}

module.exports = {
  resolveAtlasUri,
  connectRemoteUri,
  connectRemoteWithFallback,
  prepareAtlasDns,
  parseSrvUri,
  buildStandardUri
};
