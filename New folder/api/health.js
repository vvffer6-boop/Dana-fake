export default function handler(req, res) {
  const startTime = Date.now();
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime ? process.uptime() : 0,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    region: process.env.VERCEL_REGION || 'unknown',
    memory: process.memoryUsage ? {
      rss: process.memoryUsage().rss,
      heapUsed: process.memoryUsage().heapUsed
    } : null,
    responseTime: `${Date.now() - startTime}ms`
  });
}