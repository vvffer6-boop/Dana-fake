import { getBalanceSummary } from '../../src/lib/transactions.js';
import { verifyAccount } from '../../src/lib/dana.js';
import { success } from '../../src/lib/response.js';
import { withApiHandlers } from '../../src/middleware/route.js';

export default withApiHandlers({
  methods: ['GET'],
  requireAuth: true,
  handler: async (req, res, { requestId }) => {
    const summary = getBalanceSummary();
    let danaVerification = null;
    let danaConfigured = false;

    try {
      danaVerification = await verifyAccount();
      danaConfigured = !!(
        process.env.DANA_CLIENT_ID &&
        process.env.DANA_CLIENT_SECRET &&
        process.env.DANA_MERCHANT_ID &&
        process.env.DANA_API_BASE
      );
    } catch (err) {
      danaVerification = {
        verified: false,
        code: 'VERIFICATION_ERROR',
        message: err.message || 'Verification request failed',
        checkedAt: new Date().toISOString()
      };
    }

    return res.status(200).json(
      success(
        {
          ...summary,
          danaConfigured,
          danaVerification,
          requestId
        },
        200
      )
    );
  }
});