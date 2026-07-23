import { getAllTransactions, getTransaction } from '../../src/lib/transactions.js';
import { success, error } from '../../src/lib/response.js';
import { withApiHandlers } from '../../src/middleware/route.js';

export default withApiHandlers({
  methods: ['GET'],
  requireAuth: true,
  handler: (req, res, { requestId }) => {
    const { type, status, merchantTrxId, fromDate, toDate, limit = '20', page = '1', id } = req.query;

    if (id) {
      const tx = getTransaction(id);
      if (!tx) {
        return res.status(404).json(error('Transaction not found', 404, { requestId }));
      }
      return res.status(200).json(success({ ...tx, requestId }, 200));
    }

    const filters = {};
    if (type) filters.type = type;
    if (status) filters.status = status;
    if (merchantTrxId) filters.merchantTrxId = merchantTrxId;
    if (fromDate) filters.fromDate = fromDate;
    if (toDate) filters.toDate = toDate;

    let all = getAllTransactions(filters);

    const total = all.length;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const start = (pageNum - 1) * pageSize;
    const paged = all.slice(start, start + pageSize);

    return res.status(200).json(success({
      data: paged,
      meta: {
        total,
        page: pageNum,
        pageSize,
        totalPages: Math.ceil(total / pageSize) || 1,
        filters,
        requestId
      }
    }, 200));
  }
});