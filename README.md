# Incident Hub API

TypeScript incident-management API with idempotent writes, filterable reads, lifecycle transitions, and summary metrics.

## Why This Exists

This repo is positioned like an internal reliability service rather than a tutorial CRUD app, with operational behavior that looks familiar to platform teams.

## What This Demonstrates

- idempotent incident creation and predictable JSON responses
- filterable list endpoints plus summary metrics for operations views
- acknowledge and resolve lifecycle transitions with deterministic tests

## Architecture

1. HTTP handlers translate requests into domain operations
1. incident state is modeled explicitly with lifecycle transitions
1. tests validate business behavior rather than snapshots or framework internals

## Run It

```bash
npm test
npm run build
npm start
```

## Verification

Run `npm test` and `npm run build` to validate lifecycle behavior and compile health.
