import security from './security.js';
import { createRateLimiter } from './rateLimit.js';
import auth from './auth.js';
import { log } from '../lib/logger.js';
import { checkMemoryPressure } from '../lib/memory.js';

const defaultRateLimiter = createRateLimiter();

export function withApiHandlers(options = {}) {
  const rateLimiter = options.rateLimiter || defaultRateLimiter;
  const requireAuth = options.requireAuth !== false;
  const methods = options.methods || ['GET'];
  const endpointName = options.endpoint || 'default';

  return async function handler(req, res) {
    const startTime = Date.now();
    security(req, res);
    res.setHeader('Content-Type', 'application/json');

    const incoming = req.headers['x-request-id'];
    const requestId = incoming && typeof incoming === 'string' && incoming.trim()
      ? incoming.trim()
      : `req_${Date.now()}_${Math.random().toString(36).slice(2, 12).toUpperCase()}`;
    res.setHeader('X-Request-Id', requestId);
    req.requestId = requestId;

    if (!methods.includes(req.method)) {
      const duration = Date.now() - startTime;
      log('warn', 'Method Not Allowed', {
        requestId,
        method: req.method,
        url: req.url,
        statusCode: 405,
        durationMs: duration,
        ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null
      });
      return res.status(405).json({ error: 'Method Not Allowed', status: '405', requestId });
    }

    const rateLimitResult = rateLimiter(req, res);
    if (rateLimitResult) {
      const duration = Date.now() - startTime;
      log('warn', 'Rate limit exceeded', {
        requestId,
        method: req.method,
        url: req.url,
        statusCode: 429,
        durationMs: duration,
        ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null
      });
      return rateLimitResult;
    }

    if (requireAuth) {
      const authResult = auth(req, res);
      if (authResult) {
        const duration = Date.now() - startTime;
        log('warn', 'Unauthorized', {
          requestId,
          method: req.method,
          url: req.url,
          statusCode: 401,
          durationMs: duration,
          ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null
        });
        return authResult;
      }
    }

    try {
      const memory = checkMemoryPressure();
      if (memory.level === 'critical') {
        log('error', 'Critical memory pressure', {
          requestId,
          memory: {
            rss: memory.rss,
            heapUsed: memory.heapUsed,
            heapTotal: memory.heapTotal
          }
        });
      }

      const response = await options.handler(req, res, { requestId, endpointName });
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode || 200;

      if (statusCode >= 400) {
        log('error', 'Request failed', {
          requestId,
          method: req.method,
          url: req.url,
          statusCode,
          durationMs: duration,
          error: response?.error || 'Request failed',
          ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null
        });
      } else {
        log('info', 'Request completed', {
          requestId,
          method: req.method,
          url: req.url,
          statusCode,
          durationMs: duration,
          ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null
        });
      }

      return response;
    } catch (err) {
      const duration = Date.now() - startTime;

      if (!res.headersSent) {
        log('error', 'Unhandled exception', {
          requestId,
          method: req.method,
          url: req.url,
          statusCode: 500,
          durationMs: duration,
          error: err.message || 'Unknown error',
          stack: process.env.NODE_ENV !== 'production' ? err.stack : null,
          ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null
        });

        return res.status(500).json({
          error: {
            message: 'Internal server error',
            status: '500',
            code: 'INTERNAL_ERROR',
            requestId
          }
        });
      }

      log('error', 'Response already sent before exception', {
        requestId,
        method: req.method,
        url: req.url,
        statusCode: 500,
        durationMs: duration,
        error: err.message || 'Unknown error',
        stack: process.env.NODE_ENV !== 'production' ? err.stack : null,
        ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null
      });

      return null;
    }
  };
}