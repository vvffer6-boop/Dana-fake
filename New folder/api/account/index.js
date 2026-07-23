import { withApiHandlers } from '../../src/middleware/route.js';
import { getStats } from '../../src/lib/transactions.js';
import { verifyAccount } from '../../src/lib/dana.js';
import { validateRegistration, registerAccount, getAllRegistrations, updateRegistrationStatus } from '../../src/lib/registrations.js';

export default withApiHandlers({
  methods: ['GET', 'POST'],
  requireAuth: true,
  handler: async (req, res, { requestId }) => {
    if (req.method === 'POST') {
      try {
        const body = req.body || {};

        const requiredFields = ['businessName', 'email', 'phone', 'businessType'];
        const missing = requiredFields.filter(field => !body[field] || typeof body[field] !== 'string' || !body[field].trim());
        if (missing.length > 0) {
          return res.status(400).json({
            error: {
              message: `Invalid registration request. Required fields missing: ${missing.join(', ')}`,
              status: '400',
              code: 'VALIDATION_ERROR',
              details: { missingFields: missing },
              requestId
            }
          });
        }

        const validation = validateRegistration(body);

        if (!validation.valid) {
          return res.status(400).json({
            error: {
              message: 'Validation failed',
              status: '400',
              code: 'VALIDATION_ERROR',
              details: validation.errors,
              requestId
            }
          });
        }

        const existing = getAllRegistrations({ email: validation.cleaned.email });
        if (existing.length > 0) {
          return res.status(409).json({
            error: {
              message: 'Registration already exists for this email',
              status: '409',
              code: 'DUPLICATE_REGISTRATION',
              requestId,
              existingRegistrationId: existing[0].id
            }
          });
        }

        const registration = registerAccount({
          ...validation.cleaned,
          status: 'PENDING',
          metadata: {
            source: 'api',
            userAgent: req.headers['user-agent'] || null,
            ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null
          }
        });

        return res.status(201).json({
          status: 201,
          data: {
            ...registration,
            requestId
          }
        });
      } catch (err) {
        return res.status(500).json({
          error: {
            message: err.message || 'Registration failed',
            status: '500',
            code: err.code || 'REGISTRATION_ERROR',
            requestId
          }
        });
      }
    }

    const account = {
      service: 'aqvx-1-payment-api',
      merchantId: process.env.DANA_MERCHANT_ID || null,
      clientId: process.env.DANA_CLIENT_ID || null,
      apiBase: process.env.DANA_API_BASE || 'https://api.saas.dana.id',
      redirectUrl: process.env.DANA_REDIRECT_URL || null,
      environment: process.env.NODE_ENV || 'production',
      features: {
        paymentCreate: true,
        paymentStatus: true,
        paymentCallback: true,
        paymentWebhook: true,
        balance: true,
        transactions: true,
        monitoring: true,
        account: true,
        registration: true
      },
      limits: {
        rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
        rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
      },
      system: {
        uptime: process.uptime ? process.uptime() : 0,
        memory: process.memoryUsage ? {
          rss: process.memoryUsage().rss,
          heapUsed: process.memoryUsage().heapUsed,
          heapTotal: process.memoryUsage().heapTotal
        } : null,
        region: process.env.VERCEL_REGION || 'unknown',
        nodeVersion: process.version
      },
      stats: getStats(),
      timestamp: new Date().toISOString(),
      requestId
    };

    try {
      const verification = await verifyAccount();
      account.danaVerification = verification;
      account.danaConfigured = !!(
        process.env.DANA_CLIENT_ID &&
        process.env.DANA_CLIENT_SECRET &&
        process.env.DANA_MERCHANT_ID &&
        process.env.DANA_API_BASE
      );
    } catch (err) {
      account.danaVerification = {
        verified: false,
        code: 'VERIFICATION_ERROR',
        message: err.message || 'Verification request failed',
        checkedAt: new Date().toISOString()
      };
      account.danaConfigured = false;
    }

    return res.status(200).json(account);
  }
});