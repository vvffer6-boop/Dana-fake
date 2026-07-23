import { withApiHandlers } from '../../src/middleware/route.js';
import { getLogs } from '../../src/lib/logger.js';
import { getStats, getBalanceSummary, getAllTransactions } from '../../src/lib/transactions.js';

export default withApiHandlers({
  methods: ['GET'],
  requireAuth: true,
  handler: (req, res, { requestId }) => {
    const { level, requestId: logRequestId, merchantTrxId, from, limit = '50' } = req.query;

    const logs = getLogs({
      level,
      requestId: logRequestId,
      merchantTrxId,
      from
    }).slice(0, Math.min(200, parseInt(limit) || 50));

    const all = getAllTransactions();
    const stats = getStats();
    const balance = getBalanceSummary();

    const memory = process.memoryUsage ? {
      rss: process.memoryUsage().rss,
      heapUsed: process.memoryUsage().heapUsed,
      heapTotal: process.memoryUsage().heapTotal,
      external: process.memoryUsage().external
    } : null;

    const uptime = process.uptime ? process.uptime() : 0;

    const monitoring = {
      status: 'ok',
      uptime,
      memory,
      region: process.env.VERCEL_REGION || 'unknown',
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'production',
      timestamp: new Date().toISOString(),
      requestId,
      summary: {
        totalTransactions: balance.totalTransactions,
        completed: balance.completed,
        pending: balance.pending,
        failed: balance.failed,
        totalAmount: balance.totalAmount,
        currency: balance.currency
      },
      traffic: {
        timeframe24h: stats.timeframe24h,
        timeframe7d: stats.timeframe7d,
        byChannel: stats.byChannel
      },
      logs
    };

    return res.status(200).json(monitoring);
  }
});