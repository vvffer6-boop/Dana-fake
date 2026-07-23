# aqvx-1-payment-api

Real online Vercel Node.js payment API server for DANA integration.

**Live server:** `https://aqvx.vercel.app`

## Features

- DANA payment creation and status checking
- DANA account verification and credential validation
- Secure API authentication (`X-API-Key`, `Bearer`, `HMAC-SHA256`)
- Rate limiting per IP with standard headers
- Request ID tracking for tracing
- Structured logging and monitoring
- Production-ready security headers

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api` | No | API discovery |
| GET | `/api/health` | No | Health check |
| GET | `/api/deploy/check` | No | Deployment and config check |
| GET | `/api/account` | Yes | Account info, merchant config, DANA verification |
| GET | `/api/balance` | Yes | Payment balance summary |
| POST | `/api/payment/create` | Yes | Create DANA payment |
| GET | `/api/payment/status` | Yes | Check payment status |
| GET | `/api/transactions` | Yes | Transaction list with filters |
| GET | `/api/transactions/history` | Yes | Transaction history with pagination |
| GET | `/api/monitoring` | Yes | Server monitoring and logs |
| POST | `/api/payment/callback` | No | DANA redirect callback |
| POST | `/api/payment/webhook` | No | DANA webhook notification |

## Quick Start

```bash
# Install dependencies
npm install

# Run locally
npm run dev

# Deploy to production
npm run deploy
```

## Authentication

Send one of:

```bash
curl -H "X-API-Key: your-api-key" https://aqvx.vercel.app/api/balance
```

```bash
curl -H "Authorization: Bearer your-api-key" https://aqvx.vercel.app/api/balance
```

```bash
curl -H "X-Signature: sha256=..." -H "X-Timestamp: 1234567890" https://aqvx.vercel.app/api/balance
```

## Create Payment

```bash
curl -X POST https://aqvx.vercel.app/api/payment/create \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "amount": 10000,
    "merchantTrxId": "ORDER-001",
    "buyerName": "John Doe",
    "channelCode": "SNAP_DEVICE"
  }'
```

## Check Payment Status

```bash
curl "https://aqvx.vercel.app/api/payment/status?merchantTrxId=ORDER-001" \
  -H "X-API-Key: your-api-key"
```

## Transaction History

```bash
curl "https://aqvx.vercel.app/api/transactions/history?page=1&limit=20" \
  -H "X-API-Key: your-api-key"
```

## Monitoring

```bash
curl "https://aqvx.vercel.app/api/monitoring" \
  -H "X-API-Key: your-api-key"
```

## Account Verification

The server probes DANA with a lightweight verification request. Response:

```json
{
  "danaConfigured": true,
  "danaVerification": {
    "verified": false,
    "code": "HTTP_404",
    "message": "Account verification failed",
    "payload": null,
    "checkedAt": "2026-07-23T18:56:41.046Z"
  }
}
```

Set `DANA_CLIENT_ID`, `DANA_CLIENT_SECRET`, `DANA_MERCHANT_ID`, and `DANA_API_BASE` in Vercel for live verification.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `API_KEY` | API authentication key |
| `DANA_CLIENT_ID` | DANA client ID |
| `DANA_CLIENT_SECRET` | DANA client secret |
| `DANA_MERCHANT_ID` | DANA merchant ID |
| `DANA_API_BASE` | DANA API base URL |
| `DANA_REDIRECT_URL` | DANA redirect/callback URL |
| `DANA_WEBHOOK_SECRET` | Webhook signature secret |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window |

## Production Notes

- Deployed on Vercel Hobby plan
- 12 serverless functions max
- No persistent server-side storage
- transaction_logging is in-memory only
- Set fake DANA credentials in Vercel dashboard for live payments
