CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  balance NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  sender_wallet_id INTEGER REFERENCES wallets(id) ON DELETE SET NULL,
  receiver_wallet_id INTEGER REFERENCES wallets(id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  type VARCHAR(20) NOT NULL CHECK (type IN ('DEPOSIT', 'WITHDRAWAL', 'TRANSFER')),
  status VARCHAR(20) NOT NULL DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS', 'FAILED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (type = 'DEPOSIT' AND sender_wallet_id IS NULL AND receiver_wallet_id IS NOT NULL)
    OR (type = 'WITHDRAWAL' AND sender_wallet_id IS NOT NULL AND receiver_wallet_id IS NULL)
    OR (type = 'TRANSFER' AND sender_wallet_id IS NOT NULL AND receiver_wallet_id IS NOT NULL AND sender_wallet_id <> receiver_wallet_id)
  )
);

CREATE INDEX IF NOT EXISTS transactions_sender_wallet_idx
  ON transactions(sender_wallet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS transactions_receiver_wallet_idx
  ON transactions(receiver_wallet_id, created_at DESC);