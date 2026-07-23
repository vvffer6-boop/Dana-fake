const transactions = new Map();
const MAX_TRANSACTIONS = 1000;
const PENDING_TTL_MS = 2 * 60 * 1000;
const FINAL_TTL_MS = 10 * 60 * 1000;

export function logTransaction(record) {
  if (transactions.size >= MAX_TRANSACTIONS) {
    const oldestKey = transactions.keys().next().value;
    if (oldestKey) {
      transactions.delete(oldestKey);
    }
  }
  const id = record.merchantTrxId || `TXN-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const entry = {
    id,
    requestId: record.requestId || null,
    merchantTrxId: record.merchantTrxId || id,
    transactionId: record.transactionId || null,
    type: record.type || 'PAYMENT',
    status: record.status || 'PENDING',
    amount: typeof record.amount === 'string' ? parseFloat(record.amount) : (record.amount || 0),
    currency: record.currency || 'IDR',
    channelCode: record.channelCode || null,
    buyerName: record.buyerName || null,
    buyerEmail: record.buyerEmail || null,
    buyerPhone: record.buyerPhone || null,
    paymentUrl: record.paymentUrl || null,
    qrContent: record.qrContent || null,
    errorCode: record.errorCode || null,
    errorMessage: record.errorMessage || null,
    metadata: record.metadata || {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    cachedAt: Date.now()
  };

  if (transactions.has(id)) {
    const existing = transactions.get(id);
    transactions.set(id, {
      ...existing,
      ...entry,
      updatedAt: new Date().toISOString(),
      cachedAt: Date.now(),
      metadata: { ...existing.metadata, ...entry.metadata }
    });
  } else {
    transactions.set(id, entry);
  }

  if (record.merchantTrxId && record.merchantTrxId !== id) {
    transactions.set(record.merchantTrxId, transactions.get(id) || entry);
  }

  return entry;
}

export function isTransactionStale(entry) {
  if (!entry || !entry.cachedAt) return true;
  const age = Date.now() - entry.cachedAt;
  const ttl = entry.status === 'PENDING' ? PENDING_TTL_MS : FINAL_TTL_MS;
  return age > ttl;
}

export function getTransaction(idOrMerchantTrxId) {
  const entry = transactions.get(idOrMerchantTrxId) || null;
  if (entry && isTransactionStale(entry)) {
    transactions.delete(idOrMerchantTrxId);
    return null;
  }
  return entry;
}

export function getAllTransactions(filters = {}) {
  let results = Array.from(transactions.values());

  if (filters.status) {
    results = results.filter(t => t.status === filters.status);
  }
  if (filters.type) {
    results = results.filter(t => t.type === filters.type);
  }
  if (filters.merchantTrxId) {
    results = results.filter(t => t.merchantTrxId === filters.merchantTrxId);
  }
  if (filters.fromDate) {
    results = results.filter(t => t.createdAt >= filters.fromDate);
  }
  if (filters.toDate) {
    results = results.filter(t => t.createdAt <= filters.toDate);
  }

  results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return results;
}

export function getBalanceSummary() {
  const all = getAllTransactions();
  const valid = all.filter(t => !isTransactionStale(t));
  const summary = {
    totalTransactions: valid.length,
    completed: valid.filter(t => t.status === 'SUCCESS' || t.status === 'SETTLED').length,
    pending: valid.filter(t => t.status === 'PENDING').length,
    failed: valid.filter(t => t.status === 'FAILED' || t.status === 'CANCEL').length,
    totalAmount: valid.reduce((sum, t) => sum + t.amount, 0),
    completedAmount: valid.filter(t => t.status === 'SUCCESS' || t.status === 'SETTLED').reduce((sum, t) => sum + t.amount, 0),
    pendingAmount: valid.filter(t => t.status === 'PENDING').reduce((sum, t) => sum + t.amount, 0),
    currency: 'IDR',
    lastUpdated: new Date().toISOString()
  };

  return summary;
}

export function getStats() {
  const all = getAllTransactions();
  const valid = all.filter(t => !isTransactionStale(t));
  const now = Date.now();
  const last24h = valid.filter(t => now - new Date(t.createdAt).getTime() <= 24 * 60 * 60 * 1000);
  const last7d = valid.filter(t => now - new Date(t.createdAt).getTime() <= 7 * 24 * 60 * 60 * 1000);

  return {
    timeframe24h: {
      total: last24h.length,
      success: last24h.filter(t => t.status === 'SUCCESS' || t.status === 'SETTLED').length,
      pending: last24h.filter(t => t.status === 'PENDING').length,
      failed: last24h.filter(t => t.status === 'FAILED' || t.status === 'CANCEL').length,
      volume: last24h.reduce((sum, t) => sum + t.amount, 0)
    },
    timeframe7d: {
      total: last7d.length,
      success: last7d.filter(t => t.status === 'SUCCESS' || t.status === 'SETTLED').length,
      pending: last7d.filter(t => t.status === 'PENDING').length,
      failed: last7d.filter(t => t.status === 'FAILED' || t.status === 'CANCEL').length,
      volume: last7d.reduce((sum, t) => sum + t.amount, 0)
    },
    byChannel: valid.reduce((acc, t) => {
      const key = t.channelCode || 'UNKNOWN';
      if (!acc[key]) acc[key] = { count: 0, amount: 0 };
      acc[key].count += 1;
      acc[key].amount += t.amount;
      return acc;
    }, {}),
    generatedAt: new Date().toISOString()
  };
}

export default {
  logTransaction,
  getTransaction,
  getAllTransactions,
  getBalanceSummary,
  getStats
}