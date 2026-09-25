# iserveu1st

Basic full-stack Wallet System starter for a timed technical assessment.

## Overview

The app demonstrates users, wallets, balances, deposits, withdrawals, transfers, and transaction history. It is intentionally small and easy to modify.

## Stack

- React + Vite + JavaScript-style component structure
- Node.js + Express REST API
- PostgreSQL accessed with the standard `pg` driver
- Docker Compose or Podman Compose

The surrounding workspace uses TypeScript tooling for its managed build pipeline, but the domain code stays direct and assessment-friendly.

## Folder structure

```text
artifacts/iserveu1st/   React dashboard
artifacts/api-server/   Express routes and PostgreSQL queries
database/               schema and seed SQL
backend/                backend container definition
frontend/               frontend container definition and Nginx proxy
docs/                   requirements, architecture, database, API, notes
compose.yaml            PostgreSQL + backend + frontend services
```

## Prerequisites

- Node.js 24 and pnpm for development
- Docker Desktop, Docker Engine, or Podman with Compose support

## Run with Docker

```bash
docker compose up --build
```

Open http://localhost:5173.

Stop the services:

```bash
docker compose down
```

To reset the database and seed data, remove the named volume explicitly:

```bash
docker compose down -v
docker compose up --build
```

The app uses local PostgreSQL inside the Compose network. This project does not depend on Supabase or any external database.

## Run with Podman

```bash
podman compose up --build
```

If your Podman installation uses a separate compose provider, use that provider's equivalent of `compose up --build`. The same service names, environment variables, Dockerfiles, and SQL init scripts are used.

## Run during workspace development

The managed workflows run the frontend and API separately. Set `DATABASE_URL` to a PostgreSQL instance available to the workspace, then start:

```bash
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/iserveu1st run dev
```

For the intended assessment environment, prefer the Docker Compose command above so PostgreSQL is local and containerized.

## API

See [docs/api.md](docs/api.md) for request bodies, responses, and status codes.

## Database

See [docs/database.md](docs/database.md). The canonical schema and sample data are in `database/schema.sql` and `database/seed.sql`.

## Testing checklist

1. Select a seeded user.
2. Create a wallet if needed.
3. Check balance.
4. Deposit.
5. Check balance again.
6. Withdraw.
7. Transfer to another wallet.
8. Check sender and receiver balances.
9. View transaction history.
10. Try zero, negative, invalid, nonexistent, insufficient-balance, and same-wallet requests.

## Adapting for the assessment

Read [docs/assessment-notes.md](docs/assessment-notes.md) before changing the project. Keep the API, schema, and frontend changes small and aligned to the actual statement.