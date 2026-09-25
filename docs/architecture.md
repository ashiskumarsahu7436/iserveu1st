# Architecture

```text
React + Vite
      |
      | REST requests under /api
      v
Node.js + Express
      |
      | parameterized SQL through pg
      v
PostgreSQL
```

The React frontend owns presentation and form state. The Express API is the source of truth for users, wallets, balances, and transactions. PostgreSQL stores all durable data.

Docker Compose starts the three services on one network. The backend connects to the `postgres` service name, not `localhost`. The frontend container uses Nginx to serve the Vite build and proxy `/api` requests to the backend container.

Podman can use the same `compose.yaml` with `podman compose` where that command is installed. No Docker-only features are required.