import security from '../../src/middleware/security.js';
import crypto from 'crypto';
import { withApiHandlers } from '../../src/middleware/route.js';
import { logTransaction } from '../../src/lib/transactions.js';

export default withApiHandlers({
  methods: ['POST'],
  requireAuth: false,
  handler: async (req, res, { requestId }) => {
    try {
      const signature = req.headers['x-dana-signature'] || req.headers['x-callback-signature'] || '';
      const payload = req.body;

      const webhookSecret = process.env.DANA_WEBHOOK_SECRET;

      if (!webhookSecret) {
        logTransaction({
          requestId,
          type: 'WEBHOOK',
          status: 'FAILED',
          errorCode: 'MISSING_SECRET',
          errorMessage: 'Webhook secret not configured'
        });

        return res.status(400).json({
          error: {
            message: 'Webhook secret not configured',
            status: '400',
            code: 'MISSING_SECRET',
            requestId
          }
        });
      }

      const rawBody = JSON.stringify(payload || {});
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');

      if (!signature) {
        logTransaction({
          requestId,
          type: 'WEBHOOK',
          status: 'FAILED',
          errorCode: 'MISSING_SIGNATURE',
          errorMessage: 'Missing signature header'
        });

        return res.status(401).json({
          error: {
            message: 'Missing signature header',
            status: '401',
            code: 'MISSING_SIGNATURE',
            requestId
          }
        });
      }

      const receivedSig = signature.startsWith('sha256=') ? signature.slice(7) : signature;

      if (receivedSig !== expectedSignature) {
        logTransaction({
          requestId,
          merchantTrxId: payload?.merchantTrxId,
          type: 'WEBHOOK',
          status: 'FAILED',
          errorCode: 'INVALID_SIGNATURE',
          errorMessage: 'Invalid signature'
        });

        return res.status(401).json({
          error: {
            message: 'Invalid signature',
            status: '401',
            code: 'INVALID_SIGNATURE',
            requestId
          }
        });
      }

      const acceptedEvents = ['PAYMENT_SUCCESS', 'PAYMENT_FAILED', 'PAYMENT_CANCEL', 'SETTLEMENT_COMPLETED'];
      const eventType = payload?.transactionStatus || payload?.eventType || 'UNKNOWN';

      if (merchantTrxId) {
        logTransaction({
          requestId,
          merchantTrxId: payload?.merchantTrxId,
          transactionId: payload?.transactionId,
          type: 'WEBHOOK',
          status: eventType === 'PAYMENT_SUCCESS' ? 'SUCCESS' : eventType === 'PAYMENT_CANCEL' ? 'CANCEL' : 'FAILED',
          amount: payload?.transactionAmount || payload?.amount || 0,
          currency: 'IDR',
          errorCode: eventType,
          errorMessage: `Webhook received: ${eventType}`,
          metadata: { source: 'webhook', eventType, raw: payload }
        });
      }

      return res.status(200).json({
        status: 'RECEIVED',
        event: eventType,
        accepted: acceptedEvents.includes(eventType.toUpperCase()),
        merchantTrxId: payload?.merchantTrxId || null,
        transactionId: payload?.transactionId || null,
        amount: payload?.transactionAmount || payload?.amount || 0,
        currency: 'IDR',
        timestamp: new Date().toISOString(),
        acknowledged: true
      });
    } catch (err) {
      logTransaction({
        requestId,
        type: 'WEBHOOK',
        status: 'FAILED',
        errorCode: 'WEBHOOK_ERROR',
        errorMessage: err.message || 'Webhook processing failed'
      });

      return res.status(500).json({
        error: {
          message: 'Webhook processing failed',
          status: '500',
          code: 'WEBHOOK_ERROR',
          requestId
        }
      });
    }
  }
});