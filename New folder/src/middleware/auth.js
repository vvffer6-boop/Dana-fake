import crypto from 'crypto';

function header(req, name) {
  const normalized = String(name).toLowerCase();
  const value = req.headers[normalized];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value || null;
}

function normalizeHeaderValue(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }
  return value.trim();
}

function isValidApiKeyFormat(key) {
  if (!key || typeof key !== 'string') {
    return false;
  }
  return /^[A-Za-z0-9\-_]{32,128}$/.test(key);
}

function getClientIp(req) {
  const forwarded = header(req, 'x-forwarded-for');
  if (forwarded) {
    const parts = forwarded.split(',');
    return parts[0].trim();
  }
  return req.socket?.remoteAddress || null;
}

export default function auth(req, res) {
  const apiKey = normalizeHeaderValue(header(req, 'x-api-key'));
  const authHeader = normalizeHeaderValue(header(req, 'authorization'));
  const signature = normalizeHeaderValue(header(req, 'x-signature'));
  const timestamp = normalizeHeaderValue(header(req, 'x-timestamp'));
  const expectedKey = normalizeHeaderValue(process.env.API_KEY);

  if (!expectedKey) {
    return res.status(500).json({
      error: 'Server configuration error',
      message: 'API_KEY is not configured on server'
    });
  }

  if (!isValidApiKeyFormat(expectedKey)) {
    return res.status(500).json({
      error: 'Server configuration error',
      message: 'API_KEY format is invalid'
    });
  }

  const ip = getClientIp(req);
  req.clientIp = ip;

  let authenticated = false;
  let authMethod = null;

  if (apiKey && !authenticated) {
    const aBuffer = Buffer.from(String(apiKey));
    const bBuffer = Buffer.from(String(expectedKey));
    if (aBuffer.length === bBuffer.length) {
      let result = 0;
      for (let i = 0; i < aBuffer.length; i++) {
        result |= aBuffer[i] ^ bBuffer[i];
      }
      if (result === 0) {
        authenticated = true;
        authMethod = 'X-API-Key';
      }
    }
  }

  if (!authenticated && authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const aBuffer = Buffer.from(String(token));
    const bBuffer = Buffer.from(String(expectedKey));
    if (aBuffer.length === bBuffer.length) {
      let result = 0;
      for (let i = 0; i < aBuffer.length; i++) {
        result |= aBuffer[i] ^ bBuffer[i];
      }
      if (result === 0) {
        authenticated = true;
        authMethod = 'Bearer';
      }
    }
  }

  if (!authenticated && signature && timestamp) {
    const sigHex = signature.startsWith('sha256=') ? signature.slice(7) : signature;
    const ts = parseInt(timestamp, 10);
    const now = Date.now();

    if (ts && !Number.isNaN(ts) && Math.abs(now - ts) <= 300000) {
      const signPayload = `${req.method}:${req.url}:${timestamp}`;
      try {
        const expectedSig = crypto
          .createHmac('sha256', expectedKey)
          .update(signPayload)
          .digest('hex');

        if (crypto.timingSafeEqual(Buffer.from(sigHex), Buffer.from(expectedSig))) {
          authenticated = true;
          authMethod = 'HMAC-SHA256';
        }
      } catch {
        authenticated = false;
      }
    }
  }

  if (!authenticated) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Valid X-API-Key, Bearer token, or HMAC signature required'
    });
  }

  res.setHeader('X-Auth-Method', authMethod);
}