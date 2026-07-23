import { createPayment as danaCreatePayment, extractDanaError, normalizeDanaResponse } from '../../src/lib/dana.js';
import { success, error } from '../../src/lib/response.js';
import { logTransaction } from '../../src/lib/transactions.js';
import { withApiHandlers } from '../../src/middleware/route.js';
import { normalizePhone } from '../../src/lib/phone.js';

export default withApiHandlers({
  methods: ['POST'],
  requireAuth: true,
  handler: async (req, res, { requestId }) => {
    try {
      const body = req.body;

      if (!body.amount || body.amount <= 0) {
        return res.status(400).json(error('Invalid amount. Amount must be greater than 0.', 400));
      }

      const amountValue = typeof body.amount === 'string' ? parseFloat(body.amount) : body.amount;
      if (!Number.isInteger(amountValue) || amountValue < 10000) {
        return res.status(400).json(error('Invalid amount. Amount must be an integer and at least 10000 IDR.', 400, {
          provided: body.amount
        }));
      }
      body.amount = amountValue;

      if (!body.merchantTrxId) {
        return res.status(400).json(error('merchantTrxId is required.', 400));
      }

      const validChannelCodes = ['SNAP_DEVICE', 'DIRECT_DEBIT_CREDIT_CARD', 'M2M_TRANSFER'];
      if (body.channelCode && !validChannelCodes.includes(body.channelCode)) {
        return res.status(400).json(error('Invalid channelCode.', 400, { allowed: validChannelCodes }));
      }

      if (body.buyerPhone) {
        const phoneResult = normalizePhone(body.buyerPhone);
        if (!phoneResult.valid) {
          return res.status(400).json(error('Invalid buyer phone number.', 400, {
            reason: phoneResult.reason,
            provided: body.buyerPhone
          }));
        }
        body.buyerPhone = phoneResult.normalized;
      }

      if (body.buyerEmail && typeof body.buyerEmail === 'string') {
        const email = body.buyerEmail.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return res.status(400).json(error('Invalid buyer email.', 400, { provided: email }));
        }
        body.buyerEmail = email;
      }

      if (!process.env.DANA_API_BASE) {
        return res.status(500).json(error('Payment provider is not configured.', 500, {
          message: 'DANA_API_BASE is missing. Set it in Vercel project environment variables.'
        }));
      }

      const response = await danaCreatePayment(body);
      const normalized = normalizeDanaResponse(response);

      const commonResult = {
        requestId,
        merchantTrxId: body.merchantTrxId,
        transactionId: normalized.payload?.transactionId || null,
        amount: body.amount,
        currency: 'IDR',
        channelCode: body.channelCode,
        buyerName: body.buyerName,
        buyerEmail: body.buyerEmail,
        buyerPhone: body.buyerPhone,
        updatedAt: new Date().toISOString()
      };

      if (normalized.ok) {
        const result = {
          ...commonResult,
          requestId: normalized.payload?.requestId || requestId,
          merchantTrxId: normalized.payload?.merchantTrxId || body.merchantTrxId,
          transactionId: normalized.payload?.transactionId || null,
          paymentUrl: normalized.payload?.deeplinkUrl || normalized.payload?.redirectUrl || null,
          qrContent: normalized.payload?.qrContent || null,
          status: 'PENDING',
          additionalInfo: normalized.payload?.additionalInfo || {},
          expiresAt: new Date(Date.now() + 7200 * 1000).toISOString()
        };

        logTransaction({
          ...commonResult,
          requestId: result.requestId,
          transactionId: result.transactionId,
          type: 'PAYMENT',
          status: 'PENDING',
          paymentUrl: result.paymentUrl,
          qrContent: result.qrContent
        });

        return res.status(200).json(success(result, 200));
      }

      logTransaction({
        ...commonResult,
        type: 'PAYMENT',
        status: 'FAILED',
        errorCode: normalized.code,
        errorMessage: normalized.message
      });

      const mappedStatusCode = normalized.code === 'INVALID_CLIENT_CREDENTIAL' ? 401
        : normalized.code === 'INVALID_SIGNATURE' ? 401
        : normalized.code === 'LIMIT_EXCEEDED' ? 429
        : normalized.code === 'DUPLICATE_MERCHANT_TRX_ID' ? 409
        : 500;

      return res.status(mappedStatusCode).json(error(normalized.message, mappedStatusCode, {
        code: normalized.code,
        danaResponse: normalized.raw
      }));
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