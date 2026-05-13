## Why

Phase 0 requires a working backend foundation before any redirect, auth, or API features can be built safely. This change defines and delivers that baseline now so later phases can iterate on stable runtime, database, logging, and health-check primitives.

## What Changes

- Create a Bun + Elysia backend workspace scaffold aligned with the monorepo conventions.
- Add environment configuration and `.env.example` entries required for backend runtime, PostgreSQL, Redis, and observability.
- Implement shared backend infrastructure for configuration loading, database connection (Kysely + PostgreSQL), Redis client wiring, and structured logging (Pino).
- Add baseline health endpoint(s) that verify service and dependency readiness.
- Establish migration workflow tooling and initial migration setup for skrol-owned tables as required in Phase 0.
- Add basic backend quality gates in CI scope (lint, typecheck, test/build hooks as applicable).

## Capabilities

### New Capabilities
- `backend-foundation`: Backend service bootstrap, configuration, core infrastructure clients, and baseline HTTP runtime.
- `backend-health-checks`: Health/readiness behavior for runtime, PostgreSQL connectivity, and Redis connectivity.
- `backend-migration-baseline`: Initial migration workflow and schema bootstrap for skrol-owned database tables in Phase 0 scope.

### Modified Capabilities
- None.

## Impact

- Affected code: new backend workspace under `apps/` (or equivalent monorepo target), shared config/bootstrap modules, and migration files.
- APIs: introduces baseline `/health` endpoint contract and internal dependency status behavior.
- Dependencies/systems: Bun runtime, Elysia, Kysely tooling, PostgreSQL 18, Redis 8, and Pino logging setup.
- Delivery pipeline: CI tasks updated to include backend lint/typecheck/test/build readiness for Phase 0.
