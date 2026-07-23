export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({
    service: 'aqvx-1-payment-api',
    status: 'online',
    version: '2.2.0',
    runtime: 'vercel-node',
    timestamp: new Date().toISOString(),
    security: {
      authMethods: ['X-API-Key', 'Bearer', 'HMAC-SHA256'],
      requestIdTracking: true,
      rateLimit: `${process.env.RATE_LIMIT_MAX_REQUESTS || 100} req/${(parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000) / 1000}s`
    },
    endpoints: [
      { method: 'GET', path: '/api/health', desc: 'Health check', auth: false },
      { method: 'GET', path: '/api/deploy/check', desc: 'Deployment status and config check', auth: false },
      { method: 'GET', path: '/api/account', desc: 'Account info, merchant config, DANA verification', auth: true },
      { method: 'POST', path: '/api/account', desc: 'Register new account/business', auth: true },
      { method: 'GET', path: '/api/balance', desc: 'Payment balance summary', auth: true },
      { method: 'POST', path: '/api/payment/create', desc: 'Create DANA payment', auth: true },
      { method: 'GET', path: '/api/payment/status', desc: 'Check payment status', auth: true },
      { method: 'GET', path: '/api/transactions', desc: 'Transaction list with filters', auth: true },
      { method: 'GET', path: '/api/transactions/history', desc: 'Transaction history with pagination', auth: true },
      { method: 'GET', path: '/api/monitoring', desc: 'Server monitoring and logs', auth: true },
      { method: 'POST', path: '/api/payment/callback', desc: 'DANA redirect callback', auth: false },
      { method: 'POST', path: '/api/payment/webhook', desc: 'DANA webhook notification', auth: false }
    ]
  });
}