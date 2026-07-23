import { normalizePhone } from './phone.js';
import http from 'http';
import https from 'https';
import crypto from 'crypto';

const apiBase = (process.env.DANA_API_BASE || 'https://api.saas.dana.id').replace(/\/$/, '');
const partnerId = process.env.DANA_CLIENT_ID;
const merchantId = process.env.DANA_MERCHANT_ID;
const privateKey = process.env.DANA_PRIVATE_KEY || process.env.DANA_CLIENT_SECRET;
const origin = process.env.DANA_REDIRECT_URL || 'https://aqvx.vercel.app';
const channelId = process.env.DANA_CHANNEL_ID || '95221';
const externalId = process.env.DANA_EXTERNAL_ID || partnerId;

function signRequest(privateKeyStr, timestamp, bodyJson) {
  const signString = `${timestamp}${bodyJson}`;
  const sign = crypto.createSign('SHA256');
  sign.update(signString);
  sign.end();
  return sign.sign(privateKeyStr, 'base64');
}

function detectAuthMethod() {
  if (process.env.DANA_AUTH_METHOD === 'basic') {
    return 'basic';
  }
  if (process.env.DANA_AUTH_METHOD === 'signature') {
    return 'signature';
  }
  const keyToCheck = process.env.DANA_PRIVATE_KEY || process.env.DANA_CLIENT_SECRET || '';
  if (keyToCheck.includes('-----BEGIN') && keyToCheck.includes('-----END')) {
    return 'signature';
  }
  return 'basic';
}

function makeRequest(method, path, body = null, extraHeaders = {}, retries = 2) {
  if (!apiBase) {
    return Promise.reject(new Error('DANA_API_BASE is not configured'));
  }

  if (!partnerId || !merchantId) {
    return Promise.reject(new Error('Missing DANA credentials: DANA_CLIENT_ID, DANA_MERCHANT_ID'));
  }

  const authMethod = detectAuthMethod();
  const timestamp = new Date().toISOString().replace('Z', '+07:00');
  const bodyJson = body ? JSON.stringify(body) : '';
  let signature = null;

  if (authMethod === 'signature') {
    if (!privateKey) {
      return Promise.reject(new Error('DANA signature auth requires DANA_PRIVATE_KEY or PEM-formatted DANA_CLIENT_SECRET'));
    }
    try {
      signature = signRequest(privateKey, timestamp, bodyJson);
    } catch (err) {
      if (err.message?.includes?.('DECODER') || err.message?.includes?.('unsupported')) {
        return Promise.reject(new Error('Invalid RSA private key. Set DANA_PRIVATE_KEY with your PEM private key, or set DANA_AUTH_METHOD=basic.'));
      }
      throw err;
    }
  }

  const attemptRequest = (attempt) => {
    return new Promise((resolve, reject) => {
      let url;
      try {
        url = new URL(`${apiBase}${path}`);
      } catch {
        return reject(new Error(`Invalid DANA_API_BASE: ${apiBase}`));
      }

      const isHttps = url.protocol === 'https:';
      const httpModule = isHttps ? https : http;

      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Request-Id': `req_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`,
        ...extraHeaders
      };

      if (authMethod === 'signature') {
        headers['X-TIMESTAMP'] = timestamp;
        headers['X-SIGNATURE'] = signature;
        headers['X-PARTNER-ID'] = partnerId;
        headers['X-EXTERNAL-ID'] = externalId;
        headers['CHANNEL-ID'] = channelId;
        headers['ORIGIN'] = origin;
      } else {
        headers['Authorization'] = `Basic ${Buffer.from(`${partnerId}:${privateKey || ''}`).toString('base64')}`;
        headers['X-DANA-MERCHANT-ID'] = merchantId;
      }

      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname,
        method: method,
        timeout: 30000,
        headers
      };

      const req = httpModule.request(options, (res) => {
        const chunks = [];
        res.on('data', (chunk) => { chunks.push(chunk); });
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf-8');
          let parsed;
          try {
            parsed = raw ? JSON.parse(raw) : null;
          } catch {
            parsed = raw || null;
          }
          resolve({
            status: res.statusCode,
            data: parsed,
            raw,
            headers: res.headers
          });
        });
      });

      req.on('error', (err) => {
        if (attempt < retries && (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND')) {
          setTimeout(() => attemptRequest(attempt + 1), Math.pow(2, attempt) * 1000);
        } else {
          reject(err);
        }
      });

      req.on('timeout', () => {
        req.destroy();
        const err = new Error('DANA request timeout');
        err.code = 'ETIMEDOUT';
        if (attempt < retries) {
          setTimeout(() => attemptRequest(attempt + 1), Math.pow(2, attempt) * 1000);
        } else {
          reject(err);
        }
      });

      if (bodyJson) { req.write(bodyJson); }
      req.end();
    });
  };

  return attemptRequest(0);
}

export async function createPayment(payload) {
  const normalizedPayload = { ...payload };
  if (normalizedPayload.buyerPhone && typeof normalizedPayload.buyerPhone === 'string') {
    const phone = normalizePhone(normalizedPayload.buyerPhone);
    if (phone.valid) {
      normalizedPayload.buyerPhone = phone.normalized;
    }
  }

  const partnerReferenceNo = normalizedPayload.merchantTrxId || `TRX-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const amountValue = Math.round(typeof normalizedPayload.amount === 'string' ? parseFloat(normalizedPayload.amount) : normalizedPayload.amount);

  const requestBody = {
    partnerReferenceNo,
    merchantId: merchantId,
    amount: {
      value: amountValue.toFixed(2),
      currency: 'IDR'
    },
    validUpTo: new Date(Date.now() + 7200 * 1000).toISOString().replace('Z', '+07:00'),
    urlParams: [
      {
        url: process.env.DANA_REDIRECT_URL || `${origin}/api/payment/callback`,
        type: 'PAY_RETURN',
        isDeeplink: 'Y'
      },
      {
        url: `${origin}/api/payment/webhook`,
        type: 'NOTIFICATION',
        isDeeplink: 'N'
      }
    ],
    additionalInfo: {
      order: {
        orderTitle: normalizedPayload.buyerName ? `Payment by ${normalizedPayload.buyerName}` : 'DANA Payment',
        scenario: 'API'
      },
      envInfo: {
        sourcePlatform: 'IPG',
        terminalType: 'SYSTEM'
      },
      phoneNumber: normalizedPayload.buyerPhone || ''
    }
  };

  const response = await makeRequest('POST', '/payment-gateway/v1.0/debit/payment-host-to-host.htm', requestBody);
  return { status: response.status, data: response.data, raw: response.raw, partnerReferenceNo };
}

export async function getPaymentStatus(merchantTrxId) {
  const requestBody = {
    partnerReferenceNo: merchantTrxId,
    merchantId: merchantId
  };

  const response = await makeRequest('POST', '/rest/redirection/v1.0/debit/payment-host-to-host', requestBody);
  return { status: response.status, data: response.data, raw: response.raw };
}

function extractDanaError(response) {
  if (!response) {
    return { code: 'NO_RESPONSE', message: 'No response from DANA' };
  }

  const raw = response.raw || '';
  const data = response.data;

  if (typeof data === 'string') {
    if (raw.includes('<!DOCTYPE') || raw.includes('<html')) {
      return { code: `HTTP_${response.status}`, message: 'DANA returned an HTML page instead of JSON' };
    }
    return { code: `HTTP_${response.status}`, message: data.slice(0, 200) };
  }

  if (data && typeof data === 'object') {
    const code = data.responseCode || data.response_code || data.errorCode || data.error_code || `HTTP_${response.status}`;
    const message = data.responseMessage || data.response_message || data.errorMessage || data.error_message || 'DANA request failed';
    return { code, message };
  }

  return { code: `HTTP_${response.status}`, message: 'Unexpected response format from DANA' };
}

function normalizeDanaResponse(response) {
  if (!response) {
    return {
      ok: false,
      status: 500,
      code: 'NO_RESPONSE',
      message: 'No response from DANA',
      payload: null
    };
  }

  if (response.status === 200) {
    const payload = response.data || null;
    return {
      ok: true,
      status: 200,
      code: response.data?.responseCode || response.data?.response_code || 'SUCCESS',
      message: response.data?.responseMessage || response.data?.response_message || 'Success',
      payload,
      raw: response.data
    };
  }

  const danaError = extractDanaError(response);
  return {
    ok: false,
    status: response.status,
    code: danaError.code,
    message: danaError.message,
    payload: response.data || null,
    raw: response.data
  };
}

export { extractDanaError, normalizeDanaResponse };

export async function verifyAccount() {
  if (!partnerId || !merchantId) {
    return {
      verified: false,
      reason: 'Missing DANA credentials',
      missing: [
        !partnerId ? 'DANA_CLIENT_ID' : null,
        !merchantId ? 'DANA_MERCHANT_ID' : null,
        !process.env.DANA_PRIVATE_KEY && !process.env.DANA_CLIENT_SECRET ? 'DANA_PRIVATE_KEY or DANA_CLIENT_SECRET' : null
      ].filter(Boolean)
    };
  }

  const response = await makeRequest('POST', '/payment-gateway/v1.0/debit/payment-host-to-host.htm', {
    partnerReferenceNo: `VERIFY-${Date.now()}`,
    merchantId: merchantId,
    amount: { value: '0.00', currency: 'IDR' },
    validUpTo: new Date(Date.now() + 300000).toISOString().replace('Z', '+07:00'),
    urlParams: [
      { url: `${origin}/api/payment/callback`, type: 'PAY_RETURN', isDeeplink: 'Y' },
      { url: `${origin}/api/payment/webhook`, type: 'NOTIFICATION', isDeeplink: 'N' }
    ],
    additionalInfo: {
      order: { orderTitle: 'Account Verification', scenario: 'API' },
      envInfo: { sourcePlatform: 'IPG', terminalType: 'SYSTEM' }
    }
  });

  if (response.status === 200) {
    return {
      verified: true,
      code: response.data?.responseCode || 'UNKNOWN',
      message: response.data?.responseMessage || 'Account verification successful',
      payload: response.data || null,
      checkedAt: new Date().toISOString()
    };
  }

  const danaError = extractDanaError(response);
  return {
    verified: false,
    code: danaError.code,
    message: danaError.message,
    payload: response.data || null,
    checkedAt: new Date().toISOString()
  };
}