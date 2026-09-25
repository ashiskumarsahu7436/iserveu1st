# iserveu1st

Basic full-stack wallet system starter for a timed technical assessment.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/iserveu1st run dev` — run the React dashboard
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9 build tooling
- API: Express 5
- DB: PostgreSQL + `pg`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/iserveu1st` — React wallet dashboard
- `artifacts/api-server` — Express API and PostgreSQL-backed wallet operations
- `database/schema.sql` and `database/seed.sql` — local database source of truth
- `lib/api-spec/openapi.yaml` — API contract source of truth
- `docs/` — assessment-oriented documentation

## Architecture decisions

- The API uses the standard `pg` driver and parameterized SQL so the assessment logic is visible.
- Transfers use a PostgreSQL transaction and row-level locks to keep debit, credit, and transaction history atomic.
- Docker Compose is the canonical local runtime; the managed workspace workflows are for development preview.

## Product

Users can select or create users, create wallets, view balances, deposit, withdraw, transfer, and inspect transaction history.

## User preferences

Keep the project basic, readable, and easy to adapt during a timed technical assessment.

## Gotchas

- Reset the Docker database with `docker compose down -v`; init SQL runs only for a fresh Postgres volume.
- The workspace API preview needs `DATABASE_URL`; Docker Compose supplies it automatically.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
