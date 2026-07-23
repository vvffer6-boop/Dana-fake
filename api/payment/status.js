import { getPaymentStatus as danaGetPaymentStatus, normalizeDanaResponse } from '../../src/lib/dana.js';
import { success, error } from '../../src/lib/response.js';
import { getTransaction, isTransactionStale, logTransaction } from '../../src/lib/transactions.js';
import { withApiHandlers } from '../../src/middleware/route.js';

const inFlight = new Map();

export default withApiHandlers({
  methods: ['GET'],
  requireAuth: true,
  handler: async (req, res, { requestId }) => {
    try {
      const { merchantTrxId } = req.query;

      if (!merchantTrxId) {
        return res.status(400).json(error('merchantTrxId is required.', 400));
      }

      if (!process.env.DANA_API_BASE) {
        return res.status(500).json(error('Payment provider is not configured.', 500, {
          message: 'DANA_API_BASE is missing. Set it in Vercel project environment variables.'
        }));
      }

      const cached = getTransaction(merchantTrxId);
      if (cached && !isTransactionStale(cached)) {
        return res.status(200).json(success({
          requestId,
          merchantTrxId: cached.merchantTrxId,
          transactionId: cached.transactionId,
          status: cached.status,
          amount: cached.amount,
          currency: cached.currency,
          channelCode: cached.channelCode,
          paymentTime: cached.createdAt,
          updatedAt: cached.updatedAt,
          cached: true,
          source: 'cache'
        }, 200));
      }

      if (inFlight.has(merchantTrxId)) {
        return res.status(200).json(success({
          requestId,
          merchantTrxId,
          status: cached?.status || 'PENDING',
          amount: cached?.amount || 0,
          currency: 'IDR',
          channelCode: cached?.channelCode || null,
          updatedAt: new Date().toISOString(),
          cached: true,
          source: 'cache-inflight'
        }, 200));
      }

      inFlight.set(merchantTrxId, true);

      try {
        const response = await danaGetPaymentStatus(merchantTrxId);
        const normalized = normalizeDanaResponse(response);

        if (normalized.ok) {
          const payload = normalized.payload || {};
          const result = {
            requestId,
            merchantTrxId: payload.merchantTrxId || merchantTrxId,
            transactionId: payload.transactionId,
            status: payload.transactionStatus || 'UNKNOWN',
            amount: payload.transactionAmount || 0,
            currency: 'IDR',
            channelCode: cached?.channelCode || null,
            paymentTime: payload.transactionTime || null,
            updatedAt: new Date().toISOString(),
            source: 'dana'
          };

          logTransaction({
            ...result,
            type: 'PAYMENT',
            metadata: normalized.raw
          });

          return res.status(200).json(success(result, 200));
        }

        return res.status(500).json(error(normalized.message, 500, {
          code: normalized.code,
          danaResponse: normalized.raw
        }));
      } finally {
        inFlight.delete(merchantTrxId);
      }
    } catch (err) {
      return res.status(500).json({
        error: {
          message: err.message || 'Internal server error',
          status: '500',
          code: err.code || 'INTERNAL_ERROR',
          requestId
        }
      });
    }
  }
});