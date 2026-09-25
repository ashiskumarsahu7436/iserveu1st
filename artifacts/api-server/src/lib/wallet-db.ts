import pg from "pg";

const { Pool } = pg;

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/wallet_db";

export const pool = new Pool({ connectionString });

export type WalletRow = {
  id: number;
  user_id: number;
  user_name: string;
  balance: string | number;
  created_at: Date;
};

export type TransactionRow = {
  id: number;
  sender_wallet_id: number | null;
  receiver_wallet_id: number | null;
  amount: string | number;
  type: "DEPOSIT" | "WITHDRAWAL" | "TRANSFER";
  status: "SUCCESS" | "FAILED";
  created_at: Date;
  counterparty_name: string | null;
};

export function formatWallet(row: WalletRow) {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    balance: Number(row.balance),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export function formatTransaction(row: TransactionRow) {
  return {
    id: row.id,
    senderWalletId: row.sender_wallet_id,
    receiverWalletId: row.receiver_wallet_id,
    amount: Number(row.amount),
    type: row.type,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    counterpartyName: row.counterparty_name ?? null,
  };
}

export function parsePositiveAmount(value: unknown) {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  return Math.round(amount * 100) / 100;
}

export function parseId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function sendDatabaseError(
  error: unknown,
  res: { status: (code: number) => { json: (body: unknown) => void } },
) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";
  if (code === "23505") {
    res.status(409).json({ success: false, message: "Resource already exists" });
    return true;
  }
  return false;
}