# API

All endpoints are served under `/api`. Responses are JSON. Errors use `{ "success": false, "message": "..." }`.

## Health

`GET /api/health` or `GET /api/healthz`

```json
{ "status": "ok" }
```

## Users

- `GET /api/users` — list users, including each user's wallet ID when present.
- `POST /api/users` — body `{ "name": "Aarav", "email": "aarav@example.com" }`.
- `GET /api/users/:id` — get one user.

## Wallets

- `POST /api/wallets` — body `{ "userId": 1 }`.
- `GET /api/wallets/:id` — get wallet and balance.
- `GET /api/wallets/:id/dashboard` — get wallet, recent transactions, and aggregate totals.
- `GET /api/wallets/:id/transactions` — list transactions for a wallet.
- `POST /api/wallets/:id/deposit` — body `{ "amount": 1000 }`.
- `POST /api/wallets/:id/withdraw` — body `{ "amount": 250 }`.
- `POST /api/wallets/:id/transfer` — body `{ "receiverWalletId": 2, "amount": 500 }`.

Deposit, withdrawal, and transfer responses include the updated wallet and the created transaction:

```json
{
  "message": "Transfer successful",
  "wallet": { "id": 1, "userId": 1, "userName": "Aarav Sharma", "balance": 4500 },
  "transaction": { "id": 8, "type": "TRANSFER", "amount": 500, "status": "SUCCESS" }
}
```

Validation returns `400`, missing records return `404`, duplicate resources return `409`, insufficient balance returns `409`, and unexpected failures return `500`.