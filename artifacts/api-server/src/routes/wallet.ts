import { Router, type IRouter, type Request, type Response } from "express";
import {
  formatTransaction,
  formatWallet,
  parseId,
  parsePositiveAmount,
  pool,
  sendDatabaseError,
  type TransactionRow,
  type WalletRow,
} from "../lib/wallet-db";

const router: IRouter = Router();

const errorResponse = (res: Response, status: number, message: string) =>
  res.status(status).json({ success: false, message });

const userQuery = `
  SELECT u.id, u.name, u.email, u.created_at, w.id AS wallet_id
  FROM users u
  LEFT JOIN wallets w ON w.user_id = u.id
`;

const walletQuery = `
  SELECT w.id, w.user_id, u.name AS user_name, w.balance, w.created_at
  FROM wallets w
  JOIN users u ON u.id = w.user_id
`;

async function getWalletById(id: number, client = pool) {
  const result = await client.query<WalletRow>(
    `${walletQuery} WHERE w.id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

async function getTransactionById(id: number, walletId: number, client = pool) {
  const result = await client.query<TransactionRow>(
    `
      SELECT
        t.*,
        CASE
          WHEN t.type = 'TRANSFER' AND t.sender_wallet_id = $2 THEN receiver_user.name
          WHEN t.type = 'TRANSFER' AND t.receiver_wallet_id = $2 THEN sender_user.name
          ELSE NULL
        END AS counterparty_name
      FROM transactions t
      LEFT JOIN wallets sender_wallet ON sender_wallet.id = t.sender_wallet_id
      LEFT JOIN users sender_user ON sender_user.id = sender_wallet.user_id
      LEFT JOIN wallets receiver_wallet ON receiver_wallet.id = t.receiver_wallet_id
      LEFT JOIN users receiver_user ON receiver_user.id = receiver_wallet.user_id
      WHERE t.id = $1
    `,
    [id, walletId],
  );
  return result.rows[0] ?? null;
}

router.get("/users", async (_req, res) => {
  try {
    const result = await pool.query(userQuery);
    res.json(
      result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        createdAt: new Date(row.created_at).toISOString(),
        walletId: row.wallet_id ?? null,
      })),
    );
  } catch (error) {
    _req.log.error({ err: error }, "Failed to list users");
    errorResponse(res, 500, "Unable to load users");
  }
});

router.post("/users", async (req, res) => {
  const { name, email } = req.body ?? {};
  if (
    typeof name !== "string" ||
    name.trim().length < 1 ||
    typeof email !== "string" ||
    !email.includes("@")
  ) {
    return errorResponse(res, 400, "Name and a valid email are required");
  }
  try {
    const created = await pool.query(
      "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id, name, email, created_at",
      [name.trim(), email.trim().toLowerCase()],
    );
    const row = created.rows[0];
    return res.status(201).json({
      id: row.id,
      name: row.name,
      email: row.email,
      createdAt: new Date(row.created_at).toISOString(),
      walletId: null,
    });
  } catch (error) {
    if (sendDatabaseError(error, res)) return;
    req.log.error({ err: error }, "Failed to create user");
    return errorResponse(res, 500, "Unable to create user");
  }
});

router.get("/users/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return errorResponse(res, 400, "User id must be a positive integer");
  try {
    const result = await pool.query(`${userQuery} WHERE u.id = $1`, [id]);
    const row = result.rows[0];
    if (!row) return errorResponse(res, 404, "User not found");
    return res.json({
      id: row.id,
      name: row.name,
      email: row.email,
      createdAt: new Date(row.created_at).toISOString(),
      walletId: row.wallet_id ?? null,
    });
  } catch (error) {
    req.log.error({ err: error }, "Failed to load user");
    return errorResponse(res, 500, "Unable to load user");
  }
});

router.post("/wallets", async (req, res) => {
  const userId = Number(req.body?.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    return errorResponse(res, 400, "userId must be a positive integer");
  }
  try {
    const created = await pool.query(
      "INSERT INTO wallets (user_id, balance) VALUES ($1, 0) RETURNING id",
      [userId],
    );
    const wallet = await getWalletById(created.rows[0].id);
    if (!wallet) return errorResponse(res, 404, "Wallet was not created");
    return res.status(201).json(formatWallet(wallet));
  } catch (error) {
    if (sendDatabaseError(error, res)) return;
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "";
    if (code === "23503") return errorResponse(res, 404, "User not found");
    req.log.error({ err: error }, "Failed to create wallet");
    return errorResponse(res, 500, "Unable to create wallet");
  }
});

router.get("/wallets/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return errorResponse(res, 400, "Wallet id must be a positive integer");
  try {
    const wallet = await getWalletById(id);
    if (!wallet) return errorResponse(res, 404, "Wallet not found");
    return res.json(formatWallet(wallet));
  } catch (error) {
    req.log.error({ err: error }, "Failed to load wallet");
    return errorResponse(res, 500, "Unable to load wallet");
  }
});

router.get("/wallets/:id/transactions", async (req, res) => {
  const walletId = parseId(req.params.id);
  if (!walletId) {
    return errorResponse(res, 400, "Wallet id must be a positive integer");
  }
  try {
    const wallet = await getWalletById(walletId);
    if (!wallet) return errorResponse(res, 404, "Wallet not found");
    const result = await pool.query<TransactionRow>(
      `
        SELECT
          t.*,
          CASE
            WHEN t.type = 'TRANSFER' AND t.sender_wallet_id = $1 THEN receiver_user.name
            WHEN t.type = 'TRANSFER' AND t.receiver_wallet_id = $1 THEN sender_user.name
            ELSE NULL
          END AS counterparty_name
        FROM transactions t
        LEFT JOIN wallets sender_wallet ON sender_wallet.id = t.sender_wallet_id
        LEFT JOIN users sender_user ON sender_user.id = sender_wallet.user_id
        LEFT JOIN wallets receiver_wallet ON receiver_wallet.id = t.receiver_wallet_id
        LEFT JOIN users receiver_user ON receiver_user.id = receiver_wallet.user_id
        WHERE t.sender_wallet_id = $1 OR t.receiver_wallet_id = $1
        ORDER BY t.created_at DESC, t.id DESC
      `,
      [walletId],
    );
    return res.json(result.rows.map(formatTransaction));
  } catch (error) {
    req.log.error({ err: error }, "Failed to list transactions");
    return errorResponse(res, 500, "Unable to load transactions");
  }
});

router.get("/wallets/:id/dashboard", async (req, res) => {
  const walletId = parseId(req.params.id);
  if (!walletId) {
    return errorResponse(res, 400, "Wallet id must be a positive integer");
  }
  try {
    const wallet = await getWalletById(walletId);
    if (!wallet) return errorResponse(res, 404, "Wallet not found");
    const transactions = await pool.query<TransactionRow>(
      `
        SELECT
          t.*,
          CASE
            WHEN t.type = 'TRANSFER' AND t.sender_wallet_id = $1 THEN receiver_user.name
            WHEN t.type = 'TRANSFER' AND t.receiver_wallet_id = $1 THEN sender_user.name
            ELSE NULL
          END AS counterparty_name
        FROM transactions t
        LEFT JOIN wallets sender_wallet ON sender_wallet.id = t.sender_wallet_id
        LEFT JOIN users sender_user ON sender_user.id = sender_wallet.user_id
        LEFT JOIN wallets receiver_wallet ON receiver_wallet.id = t.receiver_wallet_id
        LEFT JOIN users receiver_user ON receiver_user.id = receiver_wallet.user_id
        WHERE t.sender_wallet_id = $1 OR t.receiver_wallet_id = $1
        ORDER BY t.created_at DESC, t.id DESC
      `,
      [walletId],
    );
    const rows = transactions.rows;
    const totals = rows.reduce(
      (sum, transaction) => {
        const amount = Number(transaction.amount);
        if (transaction.type === "DEPOSIT") sum.totalDeposited += amount;
        if (transaction.type === "WITHDRAWAL") sum.totalWithdrawn += amount;
        if (
          transaction.type === "TRANSFER" &&
          transaction.sender_wallet_id === walletId
        ) {
          sum.totalTransferred += amount;
        }
        return sum;
      },
      { totalDeposited: 0, totalWithdrawn: 0, totalTransferred: 0 },
    );
    return res.json({
      wallet: formatWallet(wallet),
      transactions: rows.map(formatTransaction),
      ...totals,
    });
  } catch (error) {
    req.log.error({ err: error }, "Failed to load wallet dashboard");
    return errorResponse(res, 500, "Unable to load wallet dashboard");
  }
});

async function runWalletAction(
  req: Request,
  res: Response,
  action: "deposit" | "withdraw",
) {
  const rawWalletId = req.params.id;
  const walletId = typeof rawWalletId === "string" ? parseId(rawWalletId) : null;
  const amount = parsePositiveAmount(req.body?.amount);
  if (!walletId) return errorResponse(res, 400, "Wallet id must be a positive integer");
  if (amount === null) return errorResponse(res, 400, "Amount must be greater than zero");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const walletResult = await client.query<WalletRow>(
      `${walletQuery} WHERE w.id = $1 FOR UPDATE`,
      [walletId],
    );
    const wallet = walletResult.rows[0];
    if (!wallet) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Wallet not found");
    }
    const balance = Number(wallet.balance);
    if (action === "withdraw" && balance < amount) {
      await client.query("ROLLBACK");
      return errorResponse(res, 409, "Insufficient balance");
    }
    const nextBalance = action === "deposit" ? balance + amount : balance - amount;
    await client.query("UPDATE wallets SET balance = $1 WHERE id = $2", [
      nextBalance,
      walletId,
    ]);
    const type = action === "deposit" ? "DEPOSIT" : "WITHDRAWAL";
    const transaction = await client.query(
      `
        INSERT INTO transactions (sender_wallet_id, receiver_wallet_id, amount, type, status)
        VALUES ($1, $2, $3, $4, 'SUCCESS')
        RETURNING id
      `,
      [
        action === "withdraw" ? walletId : null,
        action === "deposit" ? walletId : null,
        amount,
        type,
      ],
    );
    await client.query("COMMIT");
    const updatedWallet = await getWalletById(walletId);
    const createdTransaction = await getTransactionById(
      transaction.rows[0].id,
      walletId,
    );
    if (!updatedWallet || !createdTransaction) {
      return errorResponse(res, 500, "Unable to load completed transaction");
    }
    return res.json({
      message: action === "deposit" ? "Deposit successful" : "Withdrawal successful",
      wallet: formatWallet(updatedWallet),
      transaction: formatTransaction(createdTransaction),
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    req.log.error({ err: error, action }, "Wallet action failed");
    return errorResponse(res, 500, "Wallet action failed");
  } finally {
    client.release();
  }
}

router.post("/wallets/:id/deposit", (req, res) =>
  runWalletAction(req, res, "deposit"),
);
router.post("/wallets/:id/withdraw", (req, res) =>
  runWalletAction(req, res, "withdraw"),
);

router.post("/wallets/:id/transfer", async (req, res) => {
  const senderId = parseId(req.params.id);
  const receiverId = Number(req.body?.receiverWalletId);
  const amount = parsePositiveAmount(req.body?.amount);
  if (!senderId) return errorResponse(res, 400, "Wallet id must be a positive integer");
  if (!Number.isInteger(receiverId) || receiverId <= 0) {
    return errorResponse(res, 400, "receiverWalletId must be a positive integer");
  }
  if (senderId === receiverId) {
    return errorResponse(res, 400, "Sender and receiver wallets must be different");
  }
  if (amount === null) return errorResponse(res, 400, "Amount must be greater than zero");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Lock both rows in a stable order so concurrent transfers cannot race balances.
    const wallets = await client.query<WalletRow>(
      `${walletQuery} WHERE w.id IN ($1, $2) ORDER BY w.id FOR UPDATE`,
      [senderId, receiverId],
    );
    if (wallets.rows.length !== 2) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Sender or receiver wallet not found");
    }
    const sender = wallets.rows.find((wallet) => wallet.id === senderId);
    const receiver = wallets.rows.find((wallet) => wallet.id === receiverId);
    if (!sender || !receiver) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Sender or receiver wallet not found");
    }
    if (Number(sender.balance) < amount) {
      await client.query("ROLLBACK");
      return errorResponse(res, 409, "Insufficient balance");
    }
    await client.query("UPDATE wallets SET balance = balance - $1 WHERE id = $2", [
      amount,
      senderId,
    ]);
    await client.query("UPDATE wallets SET balance = balance + $1 WHERE id = $2", [
      amount,
      receiverId,
    ]);
    const transaction = await client.query(
      `
        INSERT INTO transactions (sender_wallet_id, receiver_wallet_id, amount, type, status)
        VALUES ($1, $2, $3, 'TRANSFER', 'SUCCESS')
        RETURNING id
      `,
      [senderId, receiverId, amount],
    );
    await client.query("COMMIT");
    const updatedWallet = await getWalletById(senderId);
    const createdTransaction = await getTransactionById(
      transaction.rows[0].id,
      senderId,
    );
    if (!updatedWallet || !createdTransaction) {
      return errorResponse(res, 500, "Unable to load completed transfer");
    }
    return res.json({
      message: "Transfer successful",
      wallet: formatWallet(updatedWallet),
      transaction: formatTransaction(createdTransaction),
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    req.log.error({ err: error }, "Transfer failed");
    return errorResponse(res, 500, "Transfer failed");
  } finally {
    client.release();
  }
});

export default router;