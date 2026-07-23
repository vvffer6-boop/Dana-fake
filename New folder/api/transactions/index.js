import { getAllTransactions, getStats } from '../../src/lib/transactions.js';
import { success, error } from '../../src/lib/response.js';
import { withApiHandlers } from '../../src/middleware/route.js';

export default withApiHandlers({
  methods: ['GET'],
  requireAuth: true,
  handler: (req, res, { requestId }) => {
    const { type, status, merchantTrxId, fromDate, toDate, limit, includeStats } = req.query;

    const filters = {};
    if (type) filters.type = type;
    if (status) filters.status = status;
    if (merchantTrxId) filters.merchantTrxId = merchantTrxId;
    if (fromDate) filters.fromDate = fromDate;
    if (toDate) filters.toDate = toDate;

    let transactions = getAllTransactions(filters);

    if (limit && !isNaN(parseInt(limit))) {
      transactions = transactions.slice(0, parseInt(limit));
    }

    const response = {
      data: success(transactions, 200).data,
      meta: { total: transactions.length, filters, requestId }
    };

    if (includeStats === 'true') {
      response.stats = getStats();
    }

    return res.status(200).json(response);
  }
});