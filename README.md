# Incident Hub API

TypeScript backend project that exposes a small incident-management API over Node's built-in HTTP server. It focuses on service design fundamentals:

- idempotent writes
- predictable JSON responses
- domain isolation from transport
- filterable list and summary views
- multi-step incident lifecycle
- no framework magic
- built-in test coverage

## Scripts

```bash
npm test
npm run build
npm start
```

## Endpoints

- `GET /health`
- `GET /incidents`
- `GET /incidents/summary`
- `POST /incidents`
- `PATCH /incidents/:id/ack`
- `PATCH /incidents/:id/resolve`

## Why It Matters

This repo reads more like an internal platform service than a toy CRUD app: lifecycle state transitions, idempotency, filterable query behavior, operational summary metrics, and tests that verify business rules instead of snapshots.
