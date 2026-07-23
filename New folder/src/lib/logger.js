const logs = [];
const MAX_LOGS = 200;
let startupTime = Date.now();

export function recordStartup() {
  startupTime = Date.now();
  return log('info', 'Server starting', {
    environment: process.env.NODE_ENV || 'production',
    region: process.env.VERCEL_REGION || 'unknown',
    nodeVersion: process.version,
    apiBase: process.env.DANA_API_BASE || 'https://api.saas.dana.id',
    merchantId: process.env.DANA_MERCHANT_ID || null,
    clientId: process.env.DANA_CLIENT_ID || null
  });
}

export function recordReady() {
  return log('info', 'Server ready', {
    startupMs: Date.now() - startupTime,
    environment: process.env.NODE_ENV || 'production',
    region: process.env.VERCEL_REGION || 'unknown',
    nodeVersion: process.version
  });
}

export function log(level, message, meta = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    requestId: meta.requestId || null,
    merchantTrxId: meta.merchantTrxId || null,
    statusCode: meta.statusCode || null,
    method: meta.method || null,
    url: meta.url || null,
    userId: meta.userId || null,
    ip: meta.ip || null,
    durationMs: meta.durationMs || null,
    error: meta.error || null,
    stack: meta.stack || null,
    meta
  };

  logs.push(entry);
  if (logs.length > MAX_LOGS) logs.shift();

  return entry;
}

export function getLogs(filters = {}) {
  let results = [...logs];

  if (filters.level) {
    results = results.filter(l => l.level === filters.level);
  }
  if (filters.requestId) {
    results = results.filter(l => l.requestId === filters.requestId);
  }
  if (filters.merchantTrxId) {
    results = results.filter(l => l.merchantTrxId === filters.merchantTrxId);
  }
  if (filters.from) {
    results = results.filter(l => l.timestamp >= filters.from);
  }

  results.reverse();
  return results;
}

export function getLogCount() {
  return logs.length;
}

export default { log, getLogs, getLogCount, recordStartup, recordReady }