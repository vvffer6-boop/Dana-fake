import security from '../../src/middleware/security.js';

export default async function handler(req, res) {
  security(req, res);
  res.setHeader('Content-Type', 'application/json');

  const requestId = req.headers['x-request-id'] || `deploy_${Date.now()}_${Math.random().toString(36).slice(2, 12).toUpperCase()}`;
  res.setHeader('X-Request-Id', requestId);

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed', status: '405', requestId });
  }

  try {
    const checks = {
      server: 'ok',
      environment: process.env.NODE_ENV || 'production',
      region: process.env.VERCEL_REGION || 'unknown',
      nodeVersion: process.version,
      uptime: process.uptime ? process.uptime() : 0,
      timestamp: new Date().toISOString(),
      requestId,
      deployment: {
        status: 'live',
        version: '2.2.0',
        platform: 'vercel',
        project: process.env.VERCEL_PROJECT || 'aqvx',
        url: `https://${process.env.VERCEL_URL || 'aqvx.vercel.app'}`
      },
      configuration: {
        apiKey: !!process.env.API_KEY,
        danaApiBase: !!process.env.DANA_API_BASE,
        danaClientId: !!process.env.DANA_CLIENT_ID,
        danaMerchantId: !!process.env.DANA_MERCHANT_ID
      },
      services: {
        paymentCreate: true,
        paymentStatus: true,
        paymentCallback: true,
        paymentWebhook: true,
        balance: true,
        transactions: true,
        monitoring: true
      }
    };

    const configured = Object.values(checks.configuration).every(Boolean);
    checks.deployment.ready = configured;

    if (!configured) {
      checks.deployment.warnings = [
        'Some environment variables are using placeholder values.',
        'Set DANA_CLIENT_ID, DANA_CLIENT_SECRET, and DANA_MERCHANT_ID in Vercel for live payments.'
      ];
    }

    return res.status(200).json(checks);
  } catch (err) {
    return res.status(500).json({
      error: {
        message: 'Deployment check failed',
        status: '500',
        code: 'DEPLOY_CHECK_FAILED',
        requestId
      }
    });
  }
}