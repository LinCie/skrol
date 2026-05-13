## 1. Backend Workspace and Runtime Scaffold

- [ ] 1.1 Create `apps/backend` workspace with Bun/Elysia entrypoint and workspace scripts (`dev`, `build`, `lint`, `check-types`, `test`).
- [ ] 1.2 Wire backend workspace into root turbo pipeline and root scripts so backend tasks run from monorepo commands.
- [ ] 1.3 Add typed backend config module with required env validation and clear startup errors for missing/invalid values.
- [ ] 1.4 Add `.env.example` entries for backend runtime, PostgreSQL, Redis, and baseline observability placeholders.

## 2. Core Infrastructure Initialization

- [ ] 2.1 Implement structured logger setup using Pino and register request/error logging hooks in backend runtime.
- [ ] 2.2 Implement Kysely PostgreSQL client initialization module and lifecycle integration in app bootstrap.
- [ ] 2.3 Implement Redis client initialization module and lifecycle integration in app bootstrap.
- [ ] 2.4 Ensure startup sequence is deterministic (config -> logger -> dependencies -> routes -> server) and fails fast on required dependency initialization errors.

## 3. Health Endpoint and Contract

- [ ] 3.1 Implement `GET /health` endpoint in backend router.
- [ ] 3.2 Add PostgreSQL and Redis connectivity checks used by health evaluation.
- [ ] 3.3 Return machine-readable health payload with overall status plus explicit PostgreSQL and Redis dependency states.
- [ ] 3.4 Return unhealthy health state when required dependency checks fail and verify behavior for both available and unavailable dependency scenarios.

## 4. Migration Baseline and Developer Workflow

- [ ] 4.1 Add `kysely-ctl` migration configuration and commands for applying/skipping/listing migrations.
- [ ] 4.2 Create initial Phase 0 migration files for skrol-owned schema baseline aligned with project ownership boundaries.
- [ ] 4.3 Ensure migration command exits non-zero with clear diagnostics when a migration step fails.
- [ ] 4.4 Document backend setup and migration run flow in backend README or workspace documentation.

## 5. Verification and CI Baseline

- [ ] 5.1 Add backend lint and type-check coverage to CI pipeline tasks.
- [ ] 5.2 Add backend test or smoke-check coverage validating startup and `/health` route availability.
- [ ] 5.3 Verify local acceptance criteria: backend starts, connects to PostgreSQL, connects to Redis, and reports healthy via `/health` when dependencies are available.
- [ ] 5.4 Run root monorepo quality commands and resolve any backend-related failures before merge.
