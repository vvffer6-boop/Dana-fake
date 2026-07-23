const clients = new Map();
const MAX_CLIENTS = 10000;

function pruneClients() {
  if (clients.size > MAX_CLIENTS) {
    const now = Date.now();
    for (const [key, client] of clients.entries()) {
      if (now > client.resetTime + 60000) {
        clients.delete(key);
      }
    }
  }
}

export function createRateLimiter(options = {}) {
  const windowMs = parseInt(options.windowMs || process.env.RATE_LIMIT_WINDOW_MS) || 60000;
  const maxRequests = parseInt(options.maxRequests || process.env.RATE_LIMIT_MAX_REQUESTS) || 100;
  const endpointName = options.endpoint || 'default';

  return function rateLimit(req, res) {
    const key = req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || 'unknown';
    const now = Date.now();

    pruneClients();

    const client = clients.get(key) || { count: 0, resetTime: now + windowMs, endpoints: {} };

    if (now > client.resetTime) {
      client.count = 0;
      client.resetTime = now + windowMs;
      client.endpoints = {};
    }

    client.count++;
    client.endpoints[endpointName] = (client.endpoints[endpointName] || 0) + 1;
    clients.set(key, client);

    const remaining = Math.max(0, maxRequests - client.count);
    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader('X-RateLimit-Reset', new Date(client.resetTime).toISOString());

    if (client.count > maxRequests) {
      res.setHeader('Retry-After', Math.ceil((client.resetTime - now) / 1000).toString());
      return res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil((client.resetTime - now) / 1000),
        limit: maxRequests,
        windowMs,
        requestId: req.requestId || null
      });
    }

    return null;
  };
}

export default createRateLimiter;