# Database

## Tables

- `users` stores a name, unique email, and creation timestamp.
- `wallets` belongs to one user and stores a non-negative numeric balance. The starter keeps one wallet per user.
- `transactions` stores deposits, withdrawals, and transfers. Sender and receiver wallet IDs are nullable because deposits and withdrawals have only one side.

## Important constraints

- Foreign keys keep wallet and transaction references valid.
- A user email is unique.
- A user can have at most one wallet in this starter.
- Amounts must be greater than zero.
- Balances cannot be negative.
- Transaction type determines which wallet references must be present.

## Transfer safety

Transfers use `BEGIN`, row-level `SELECT ... FOR UPDATE` locks, balance updates, transaction insertion, and `COMMIT`. Any error calls `ROLLBACK`. Locking both wallets in ID order keeps concurrent transfers from observing stale balances and reduces deadlock risk.