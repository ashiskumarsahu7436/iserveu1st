import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleAlert,
  Copy,
  CreditCard,
  Database,
  History,
  LayoutDashboard,
  LoaderCircle,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  UserRound,
  WalletCards,
  X,
} from 'lucide-react';
import {
  getGetUsersQueryKey,
  getGetWalletDashboardQueryKey,
  getGetWalletTransactionsQueryKey,
  useCreateUser,
  useCreateWallet,
  useDepositToWallet,
  useGetUsers,
  useGetWalletDashboard,
  useGetWalletTransactions,
  useTransferBetweenWallets,
  useWithdrawFromWallet,
  type Transaction,
  type User,
} from '@workspace/api-client-react';
import { Link, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import NotFound from '@/pages/not-found';
import '@/index.css';

const queryClient = new QueryClient();

type ActionKind = 'deposit' | 'withdraw' | 'transfer';
type Feedback = { tone: 'success' | 'error'; message: string } | null;

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
const compactDate = new Intl.DateTimeFormat('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
const timeDate = new Intl.DateTimeFormat('en-IN', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function formatMoney(value: number) {
  return money.format(value);
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : compactDate.format(date);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : timeDate.format(date);
}

function getErrorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return 'The server could not complete that request. Try again.';
}

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function LoadingLines({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-label="Loading">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="h-14 animate-pulse rounded-xl bg-secondary/70" />
      ))}
    </div>
  );
}

function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'quiet' | 'outline' | 'coral' }) {
  return (
    <button
      className={`app-button app-button-${variant} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function MetricCard({ label, value, detail, accent }: { label: string; value: string; detail: string; accent: 'cyan' | 'coral' | 'ink' }) {
  return (
    <div className={`metric-card metric-${accent}`} data-testid={`card-metric-${label.toLowerCase().replaceAll(' ', '-')}`}>
      <div className="flex items-start justify-between gap-4">
        <p className="eyebrow">{label}</p>
        <span className="metric-mark" />
      </div>
      <p className="metric-value" data-testid={`text-metric-${label.toLowerCase().replaceAll(' ', '-')}`}>{value}</p>
      <p className="metric-detail">{detail}</p>
    </div>
  );
}

function ActionTile({ icon, title, description, accent, onClick }: { icon: ReactNode; title: string; description: string; accent: string; onClick: () => void }) {
  return (
    <button className={`action-tile ${accent}`} onClick={onClick} data-testid={`button-action-${title.toLowerCase()}`}>
      <span className="action-icon">{icon}</span>
      <span className="text-left">
        <span className="action-title">{title}</span>
        <span className="action-description">{description}</span>
      </span>
      <ArrowUpRight className="action-arrow" />
    </button>
  );
}

function TransactionRow({ transaction, walletId }: { transaction: Transaction; walletId: number }) {
  const incoming = transaction.receiverWalletId === walletId;
  const typeLabel = transaction.type === 'DEPOSIT' ? 'Deposit' : transaction.type === 'WITHDRAWAL' ? 'Withdrawal' : 'Transfer';
  const counterparty = transaction.type === 'DEPOSIT' ? 'External deposit' : transaction.type === 'WITHDRAWAL' ? 'External withdrawal' : transaction.counterpartyName || (incoming ? 'Incoming transfer' : 'Wallet transfer');
  return (
    <div className="transaction-row" data-testid={`row-transaction-${transaction.id}`}>
      <div className={`transaction-icon ${incoming || transaction.type === 'DEPOSIT' ? 'transaction-in' : 'transaction-out'}`}>
        {transaction.type === 'DEPOSIT' ? <ArrowDownLeft size={18} /> : transaction.type === 'WITHDRAWAL' ? <ArrowUpRight size={18} /> : <Send size={16} />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="transaction-name" data-testid={`text-counterparty-${transaction.id}`}>{counterparty}</p>
        <p className="transaction-meta">{typeLabel} · {formatDateTime(transaction.createdAt)}</p>
      </div>
      <div className="text-right">
        <p className={`transaction-amount ${incoming || transaction.type === 'DEPOSIT' ? 'amount-in' : 'amount-out'}`} data-testid={`text-transaction-amount-${transaction.id}`}>
          {incoming || transaction.type === 'DEPOSIT' ? '+' : '−'}{formatMoney(transaction.amount)}
        </p>
        <span className={`status-pill ${transaction.status === 'SUCCESS' ? 'status-success' : 'status-failed'}`}>
          {transaction.status === 'SUCCESS' ? 'Complete' : 'Failed'}
        </span>
      </div>
    </div>
  );
}

function ActionDialog({ kind, walletId, balance, onClose, onFeedback }: { kind: ActionKind; walletId: number; balance: number; onClose: () => void; onFeedback: (feedback: Feedback) => void }) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [receiverWalletId, setReceiverWalletId] = useState('');
  const [localError, setLocalError] = useState('');
  const deposit = useDepositToWallet();
  const withdraw = useWithdrawFromWallet();
  const transfer = useTransferBetweenWallets();
  const mutation = kind === 'deposit' ? deposit : kind === 'withdraw' ? withdraw : transfer;
  const title = kind === 'deposit' ? 'Add funds' : kind === 'withdraw' ? 'Withdraw funds' : 'Send a transfer';
  const description = kind === 'deposit' ? 'Increase this wallet balance for your next test.' : kind === 'withdraw' ? 'Move funds out and confirm the balance updates.' : 'Send funds to another wallet in this environment.';

  const invalidateWallet = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getGetWalletDashboardQueryKey(walletId) });
    queryClient.invalidateQueries({ queryKey: getGetWalletTransactionsQueryKey(walletId) });
  }, [queryClient, walletId]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const numericAmount = Number(amount);
    setLocalError('');
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setLocalError('Enter an amount greater than 0.');
      return;
    }
    if (kind === 'withdraw' && numericAmount > balance) {
      setLocalError('That amount is higher than the current balance.');
      return;
    }
    if (kind === 'transfer' && (!receiverWalletId || Number(receiverWalletId) < 1)) {
      setLocalError('Enter a valid receiver wallet ID.');
      return;
    }
    const onSuccess = (result: { message: string }) => {
      invalidateWallet();
      onFeedback({ tone: 'success', message: result.message || `${title} completed.` });
      onClose();
    };
    const onError = (error: unknown) => setLocalError(getErrorMessage(error));
    if (kind === 'deposit') deposit.mutate({ id: walletId, data: { amount: numericAmount } }, { onSuccess, onError });
    if (kind === 'withdraw') withdraw.mutate({ id: walletId, data: { amount: numericAmount } }, { onSuccess, onError });
    if (kind === 'transfer') transfer.mutate({ id: walletId, data: { amount: numericAmount, receiverWalletId: Number(receiverWalletId) } }, { onSuccess, onError });
  };

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="wallet-action-title">
        <div className="flex items-start justify-between gap-6">
          <div>
            <span className="eyebrow text-primary">{kind === 'transfer' ? 'FLOW 03' : kind === 'withdraw' ? 'FLOW 02' : 'FLOW 01'}</span>
            <h2 id="wallet-action-title" className="dialog-title">{title}</h2>
            <p className="dialog-description">{description}</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close action dialog" data-testid="button-close-dialog"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="mt-7 space-y-5">
          <label className="field-label">
            Amount
            <span className="input-wrap">
              <span className="input-prefix">$</span>
              <input autoFocus required min="0.01" step="0.01" type="number" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" data-testid={`input-${kind}-amount`} />
            </span>
          </label>
          {kind === 'transfer' && (
            <label className="field-label">
              Receiver wallet ID
              <span className="input-wrap">
                <Database className="input-prefix-icon" size={16} />
                <input required min="1" step="1" type="number" inputMode="numeric" value={receiverWalletId} onChange={(event) => setReceiverWalletId(event.target.value)} placeholder="e.g. 1042" data-testid="input-transfer-wallet-id" />
              </span>
            </label>
          )}
          {localError && <div className="feedback feedback-error" role="alert" data-testid="status-action-error"><CircleAlert size={16} />{localError}</div>}
          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="quiet" onClick={onClose} data-testid="button-cancel-action">Cancel</Button>
            <Button type="submit" disabled={mutation.isPending} data-testid={`button-submit-${kind}`}>
              {mutation.isPending ? <LoaderCircle className="animate-spin" size={16} /> : <Check size={16} />}
              {mutation.isPending ? 'Working…' : `Confirm ${kind}`}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreateUserCard({ onCreated }: { onCreated: (user: User) => void }) {
  const createUser = useCreateUser();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    createUser.mutate({ data: { name: name.trim(), email: email.trim() } }, {
      onSuccess: onCreated,
      onError: (requestError) => setError(getErrorMessage(requestError)),
    });
  };
  return (
    <section className="setup-card">
      <div className="setup-number">01</div>
      <div className="setup-copy">
        <span className="eyebrow text-primary">Start here</span>
        <h2>Create a test user</h2>
        <p>Set up one identity to anchor the wallet assessment. No sign-in or banking setup required.</p>
      </div>
      <form onSubmit={submit} className="setup-form">
        <label className="field-label">Name<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Ada Lovelace" data-testid="input-user-name" /></label>
        <label className="field-label">Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ada@example.dev" data-testid="input-user-email" /></label>
        {error && <div className="feedback feedback-error" role="alert" data-testid="status-create-user-error"><CircleAlert size={16} />{error}</div>}
        <Button type="submit" disabled={createUser.isPending} data-testid="button-create-user">
          {createUser.isPending ? <LoaderCircle className="animate-spin" size={16} /> : <Plus size={16} />}
          {createUser.isPending ? 'Creating…' : 'Create user'}
        </Button>
      </form>
    </section>
  );
}

function CreateWalletCard({ user, onCreated }: { user: User; onCreated: () => void }) {
  const createWallet = useCreateWallet();
  const [error, setError] = useState('');
  const submit = () => {
    setError('');
    createWallet.mutate({ data: { userId: user.id } }, {
      onSuccess: onCreated,
      onError: (requestError) => setError(getErrorMessage(requestError)),
    });
  };
  return (
    <section className="setup-card">
      <div className="setup-number">02</div>
      <div className="setup-copy">
        <span className="eyebrow text-primary">One more step</span>
        <h2>Give {user.name.split(' ')[0]} a wallet</h2>
        <p>A clean wallet starts at $0.00. Use the actions below to exercise the full assessment flow.</p>
      </div>
      <div className="setup-action">
        <div className="mini-user"><span className="avatar avatar-small">{initials(user.name)}</span><span><strong>{user.name}</strong><small>{user.email}</small></span></div>
        {error && <div className="feedback feedback-error" role="alert" data-testid="status-create-wallet-error"><CircleAlert size={16} />{error}</div>}
        <Button onClick={submit} disabled={createWallet.isPending} data-testid="button-create-wallet">
          {createWallet.isPending ? <LoaderCircle className="animate-spin" size={16} /> : <WalletCards size={16} />}
          {createWallet.isPending ? 'Opening wallet…' : 'Open wallet'}
        </Button>
      </div>
    </section>
  );
}

function SetupState({ users, onUserCreated }: { users: User[]; onUserCreated: (user: User) => void }) {
  const user = users[0];
  return (
    <div className="setup-view">
      <div className="setup-hero">
        <div className="setup-orbit"><ShieldCheck size={34} /></div>
        <div>
          <span className="eyebrow">Wallet assessment</span>
          <h1>Make the wallet state<br /><em>easy to trust.</em></h1>
          <p>Start with a user, open a wallet, then run each money movement flow against the live API.</p>
        </div>
      </div>
      {!user ? <CreateUserCard onCreated={onUserCreated} /> : <CreateWalletCard user={user} onCreated={() => onUserCreated(user)} />}
      <div className="setup-note"><Sparkles size={15} /><span>Designed for fast, transparent API checks. Every result appears in the ledger below.</span></div>
    </div>
  );
}

function Dashboard({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const [activeAction, setActiveAction] = useState<ActionKind | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [copied, setCopied] = useState(false);
  const walletId = user.walletId as number;
  const dashboardQuery = useGetWalletDashboard(walletId, { query: { queryKey: getGetWalletDashboardQueryKey(walletId) } });
  const transactionsQuery = useGetWalletTransactions(walletId, { query: { queryKey: getGetWalletTransactionsQueryKey(walletId) } });
  const dashboard = dashboardQuery.data;
  const wallet = dashboard?.wallet;
  const transactions = transactionsQuery.data ?? dashboard?.transactions ?? [];

  useEffect(() => {
    if (!feedback) return;
    const timeout = window.setTimeout(() => setFeedback(null), 5200);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  const refresh = () => {
    dashboardQuery.refetch();
    transactionsQuery.refetch();
  };
  const copyWalletId = async () => {
    await navigator.clipboard?.writeText(String(walletId));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };
  if (dashboardQuery.isLoading) return <DashboardSkeleton />;
  if (dashboardQuery.isError || !dashboard || !wallet) {
    return (
      <div className="content-wrap">
        <div className="state-card state-error">
          <CircleAlert size={24} /><div><h2>Wallet state is unavailable</h2><p>{getErrorMessage(dashboardQuery.error)}</p></div>
          <Button variant="outline" onClick={refresh} data-testid="button-retry-dashboard"><RefreshCw size={15} />Retry</Button>
        </div>
      </div>
    );
  }
  return (
    <>
      {feedback && <div className={`toast-feedback ${feedback.tone}`} role="status" data-testid="status-action-feedback"><Check size={16} />{feedback.message}<button onClick={() => setFeedback(null)} aria-label="Dismiss feedback" data-testid="button-dismiss-feedback"><X size={15} /></button></div>}
      <div className="content-wrap">
        <header className="page-header">
          <div>
            <span className="eyebrow">Wallet console / overview</span>
            <h1>Good to see you, {user.name.split(' ')[0]}.</h1>
            <p>Everything important, one clear surface.</p>
          </div>
          <div className="header-actions">
            <Button variant="quiet" onClick={refresh} disabled={dashboardQuery.isFetching} data-testid="button-refresh-dashboard"><RefreshCw className={dashboardQuery.isFetching ? 'animate-spin' : ''} size={16} />Refresh</Button>
            <div className="user-menu">
              <span className="avatar">{initials(user.name)}</span>
              <span className="hidden sm:block"><strong>{user.name}</strong><small>{user.email}</small></span>
              <ChevronDown size={15} className="text-muted-foreground" />
            </div>
          </div>
        </header>

        <section className="balance-layout">
          <div className="balance-card" data-testid="card-wallet-balance">
            <div className="balance-grid-art" />
            <div className="relative z-10">
              <div className="flex items-center justify-between gap-4">
                <span className="eyebrow eyebrow-light">Available balance</span>
                <span className="live-chip"><span />Live API</span>
              </div>
              <p className="balance-amount" data-testid="text-wallet-balance">{formatMoney(wallet.balance)}</p>
              <div className="balance-footer">
                <span>Wallet ID <strong className="mono">{wallet.id}</strong></span>
                <button className="copy-button" onClick={copyWalletId} data-testid="button-copy-wallet-id">{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Copied' : 'Copy ID'}</button>
              </div>
            </div>
          </div>
          <div className="metrics-grid">
            <MetricCard label="Deposited" value={formatMoney(dashboard.totalDeposited)} detail="Total moved in" accent="cyan" />
            <MetricCard label="Withdrawn" value={formatMoney(dashboard.totalWithdrawn)} detail="Total moved out" accent="coral" />
            <MetricCard label="Transferred" value={formatMoney(dashboard.totalTransferred)} detail="Wallet-to-wallet" accent="ink" />
          </div>
        </section>

        <section className="section-block">
          <div className="section-heading">
            <div><span className="eyebrow">Assessment workflow</span><h2>Move money, inspect the result.</h2></div>
            <span className="step-count">3 actions · live</span>
          </div>
          <div className="action-grid">
            <ActionTile icon={<ArrowDownLeft size={21} />} title="Deposit" description="Add funds to the wallet" accent="action-cyan" onClick={() => setActiveAction('deposit')} />
            <ActionTile icon={<ArrowUpRight size={21} />} title="Withdraw" description="Remove funds from the wallet" accent="action-coral" onClick={() => setActiveAction('withdraw')} />
            <ActionTile icon={<Send size={20} />} title="Transfer" description="Send to another wallet" accent="action-ink" onClick={() => setActiveAction('transfer')} />
          </div>
        </section>

        <section className="ledger-layout section-block" id="ledger">
          <div className="ledger-card">
            <div className="section-heading compact">
              <div><span className="eyebrow">Money trail</span><h2>Recent transactions</h2></div>
              <span className="ledger-count" data-testid="text-transaction-count">{transactions.length} {transactions.length === 1 ? 'entry' : 'entries'}</span>
            </div>
            {transactionsQuery.isLoading ? <LoadingLines count={4} /> : transactions.length === 0 ? (
              <div className="empty-ledger"><div className="empty-icon"><History size={21} /></div><h3>No transactions yet</h3><p>Run a deposit, withdrawal, or transfer to create the first entry.</p><Button variant="outline" onClick={() => setActiveAction('deposit')} data-testid="button-empty-deposit"><Plus size={15} />Make a deposit</Button></div>
            ) : (
              <div className="transaction-list">{transactions.map((transaction) => <TransactionRow key={transaction.id} transaction={transaction} walletId={wallet.id} />)}</div>
            )}
          </div>
          <aside className="detail-card">
            <div className="detail-card-top"><span className="eyebrow">Wallet details</span><CreditCard size={20} /></div>
            <div className="detail-user"><span className="avatar avatar-large">{initials(wallet.userName)}</span><div><h3>{wallet.userName}</h3><p>Personal test wallet</p></div></div>
            <div className="detail-list">
              <div><span>Wallet ID</span><strong className="mono">{wallet.id}</strong></div>
              <div><span>Owner ID</span><strong className="mono">{wallet.userId}</strong></div>
              <div><span>Opened</span><strong>{formatDate(wallet.createdAt)}</strong></div>
            </div>
            <div className="verified-line"><ShieldCheck size={15} /> API response verified</div>
          </aside>
        </section>
        <footer className="page-footer"><span>iserveu1st / wallet assessment starter</span><span className="footer-status"><span />All systems ready</span></footer>
      </div>
      {activeAction && <ActionDialog kind={activeAction} walletId={wallet.id} balance={wallet.balance} onClose={() => setActiveAction(null)} onFeedback={setFeedback} />}
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="content-wrap">
      <div className="skeleton-header"><div className="skeleton-line wide" /><div className="skeleton-line short" /></div>
      <div className="balance-layout"><div className="skeleton-balance animate-pulse" /><div className="metrics-grid"><div className="skeleton-metric animate-pulse" /><div className="skeleton-metric animate-pulse" /><div className="skeleton-metric animate-pulse" /></div></div>
      <div className="skeleton-line medium" /><LoadingLines count={4} />
    </div>
  );
}

function Home() {
  const queryClient = useQueryClient();
  const usersQuery = useGetUsers();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const users = usersQuery.data ?? [];
  const selectedUser = useMemo(() => users.find((user) => user.id === selectedUserId) ?? users[0], [selectedUserId, users]);

  useEffect(() => {
    if (selectedUserId === null && users[0]) setSelectedUserId(users[0].id);
  }, [selectedUserId, users]);

  const onUserCreated = (user: User) => {
    queryClient.invalidateQueries({ queryKey: getGetUsersQueryKey() });
    setSelectedUserId(user.id);
  };

  if (usersQuery.isLoading) {
    return <AppShell><div className="content-wrap"><div className="skeleton-header"><div className="skeleton-line wide" /><div className="skeleton-line short" /></div><div className="setup-loading"><div className="skeleton-balance animate-pulse" /><LoadingLines count={2} /></div></div></AppShell>;
  }
  if (usersQuery.isError) {
    return <AppShell><div className="content-wrap"><div className="state-card state-error"><CircleAlert size={24} /><div><h2>Could not load users</h2><p>{getErrorMessage(usersQuery.error)}</p></div><Button variant="outline" onClick={() => usersQuery.refetch()} data-testid="button-retry-users"><RefreshCw size={15} />Retry</Button></div></div></AppShell>;
  }
  return (
    <AppShell users={users} selectedUser={selectedUser} onSelectUser={setSelectedUserId}>
      {!selectedUser || selectedUser.walletId === null ? <SetupState users={selectedUser ? [selectedUser] : users} onUserCreated={onUserCreated} /> : <Dashboard user={selectedUser} />}
    </AppShell>
  );
}

function AppShell({ children, users = [], selectedUser, onSelectUser }: { children: ReactNode; users?: User[]; selectedUser?: User; onSelectUser?: (id: number) => void }) {
  const [location] = useLocation();
  const [mobileNav, setMobileNav] = useState(false);
  return (
    <div className="app-shell">
      <aside className={`app-sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
        <div className="brand-lockup"><span className="brand-symbol"><span /></span><span>iserveu<span className="brand-accent">1st</span></span></div>
        <div className="sidebar-rule" />
        <div className="sidebar-label">Workspace</div>
        <nav className="sidebar-nav">
          <Link href="/" className={`sidebar-link ${location === '/' ? 'sidebar-link-active' : ''}`} data-testid="link-dashboard"><LayoutDashboard size={17} /><span>Overview</span><span className="nav-key">01</span></Link>
          <button className="sidebar-link" onClick={() => document.getElementById('ledger')?.scrollIntoView({ behavior: 'smooth' })} data-testid="button-nav-history"><History size={17} /><span>History</span><span className="nav-key">02</span></button>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-label">Environment</div>
          <div className="env-card"><span className="env-dot" /><div><strong>Assessment API</strong><small>Connected</small></div></div>
          <div className="sidebar-caption"><ShieldCheck size={14} /> Built for inspection, not production banking.</div>
        </div>
      </aside>
      <button className={`mobile-nav-scrim ${mobileNav ? 'visible' : ''}`} onClick={() => setMobileNav(false)} aria-label="Close navigation" data-testid="button-close-navigation" />
      <main className="app-main">
        <div className="mobile-topbar"><button className="mobile-menu" onClick={() => setMobileNav(true)} aria-label="Open navigation" data-testid="button-open-navigation"><span /><span /></button><div className="brand-lockup"><span className="brand-symbol"><span /></span><span>iserveu<span className="brand-accent">1st</span></span></div><span className="mobile-status"><span /></span></div>
        {users.length > 0 && selectedUser && onSelectUser && (
          <div className="user-switcher">
            <UserRound size={15} /><span>Inspecting</span><select value={selectedUser.id} onChange={(event) => onSelectUser(Number(event.target.value))} aria-label="Choose user" data-testid="select-user">
              {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
            </select><ChevronDown size={14} />
          </div>
        )}
        {children}
      </main>
    </div>
  );
}

function Router() {
  return (
    <ErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter>
    </QueryClientProvider>
  );
}

export default App;