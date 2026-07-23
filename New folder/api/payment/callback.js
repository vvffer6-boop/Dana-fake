import security from '../../src/middleware/security.js';
import { withApiHandlers } from '../../src/middleware/route.js';
import { logTransaction } from '../../src/lib/transactions.js';
import { success, error } from '../../src/lib/response.js';

export default withApiHandlers({
  methods: ['GET'],
  requireAuth: false,
  handler: async (req, res, { requestId }) => {
    try {
      const { resultCode, merchantTrxId, transactionId, description } = req.query;

      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');

      const normalizedCode = (resultCode || '').toString().trim().toUpperCase();

      let httpStatus = 200;
      let title = 'Payment Result';
      let message = description || `Status: ${normalizedCode || 'Unknown'}`;
      let statusColor = '#d97706';

      if (normalizedCode === 'SUCCESS') {
        httpStatus = 200;
        title = 'Payment Successful';
        message = description || 'Your payment has been processed successfully.';
        statusColor = '#15803d';
      } else if (normalizedCode === 'CANCEL' || normalizedCode === 'FAILED' || normalizedCode === 'EXPIRED') {
        httpStatus = 400;
        title = `Payment ${normalizedCode}`;
        message = description || 'Please try again or contact support.';
        statusColor = '#dc2626';
      }

      const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title}</title><style>body{font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:${statusColor === '#15803d' ? '#f0fdf4' : statusColor === '#dc2626' ? '#fef2f2' : '#fffbeb'}}.ox{background:#fff;padding:2rem 3rem;border-radius:1rem;box-shadow:0 10px 25px rgba(0,0,0,.1);text-align:center}.ox h1{color:${statusColor};margin-bottom:.5rem}.ox p{color:#4b5563}.ox .meta{color:#6b7280;font-size:.875rem;margin-top:1rem}</style></head><body><div class="ox"><h1>${title}</h1><p>Transaction ${merchantTrxId || 'N/A'} ${normalizedCode === 'SUCCESS' ? 'completed' : 'could not be completed'}.</p><p>${message}</p><div class="meta">ID: ${transactionId || 'N/A'}</div></div></body></html>`;

      if (merchantTrxId) {
        logTransaction({
          requestId,
          merchantTrxId,
          transactionId,
          type: 'PAYMENT',
          status: normalizedCode === 'SUCCESS' ? 'SUCCESS' : normalizedCode === 'CANCEL' ? 'CANCEL' : 'FAILED',
          errorCode: normalizedCode,
          errorMessage: message,
          metadata: { source: 'callback', resultCode: normalizedCode }
        });
      }

      res.status(httpStatus).send(html);
    } catch (err) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.status(500).send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Error</title><style>body{font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#fef2f2}.ox{background:#fff;padding:2rem 3rem;border-radius:1rem;box-shadow:0 10px 25px rgba(0,0,0,.1);text-align:center}.ox h1{color:#dc2626;margin-bottom:.5rem}</style></head><body><div class="ox"><h1>Error</h1><p>${err.message || 'Failed to render callback page.'}</p></div></body></html>`);
    }
  }
});