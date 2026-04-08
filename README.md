# Incident Hub API

TypeScript backend project that exposes a small incident-management API over Node's built-in HTTP server. It focuses on service design fundamentals:

- idempotent writes
- predictable JSON responses
- domain isolation from transport
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
- `POST /incidents`
- `PATCH /incidents/:id/ack`

## Why It Matters

This repo reads like a backend engineer built it intentionally: clear domain model, deterministic behavior, and tests that verify business rules instead of snapshots.
