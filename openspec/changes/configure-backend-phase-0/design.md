## Context

Phase 0 in the master spec requires a backend baseline that can start locally, connect to PostgreSQL and Redis, expose health state, and participate in CI checks. The current repository has monorepo scaffolding and shared config packages but no backend app implementation. This design must align with Bun-first tooling, Elysia runtime, Kysely-based SQL access, and Redis-backed runtime dependencies defined in the TRD.

## Goals / Non-Goals

**Goals:**
- Deliver a minimal but production-shaped backend app scaffold in `apps/` using Bun + Elysia.
- Establish deterministic backend bootstrap for config, logger, PostgreSQL, and Redis clients.
- Provide a `/health` contract that reports healthy only when required dependencies are reachable.
- Establish Phase 0 migration baseline using Kysely tooling for skrol-owned tables.
- Integrate backend workspace into existing monorepo quality gates and scripts.

**Non-Goals:**
- Implement redirect logic, link CRUD, auth, API key lifecycle, or analytics behavior from later phases.
- Introduce advanced health endpoints (deep diagnostics, metrics, or synthetic transactions).
- Add deployment orchestration beyond local and CI baseline requirements.

## Decisions

### 1) Backend workspace shape
Use a dedicated backend app workspace (for example `apps/backend`) with isolated scripts (`dev`, `build`, `lint`, `check-types`, `test`) and shared root orchestration through turbo.

Rationale:
- Keeps backend concerns isolated from frontend and shared packages.
- Matches Phase 0 requirement for independent backend startup and CI checks.

Alternatives considered:
- Single combined app process for backend/frontend in one workspace: rejected because it blurs ownership and complicates targeted verification.

### 2) Runtime and server bootstrap
Use Elysia running on Bun as the only HTTP runtime. Bootstrap sequence: load/validate environment -> initialize logger -> initialize PostgreSQL and Redis clients -> register routes/plugins -> start server.

Rationale:
- Matches TRD runtime decisions and allows fail-fast startup on misconfiguration.
- Keeps lifecycle ordering explicit and testable.

Alternatives considered:
- Lazy dependency initialization per request: rejected for health/readiness correctness and operational predictability.

### 3) Configuration strategy
Centralize env parsing in a typed config module and require all Phase 0 variables in `.env.example` (database URL, Redis URL, app port, environment, optional observability DSN placeholders).

Rationale:
- Prevents runtime drift and hidden defaults.
- Makes local onboarding and CI environment requirements explicit.

Alternatives considered:
- Reading `process.env` directly across modules: rejected due to duplication and inconsistent validation behavior.

### 4) Database and migration baseline
Use Kysely for SQL access and `kysely-ctl` workflow for migration execution. Create initial migration(s) for Phase 0 skrol-owned schema baseline as defined by project docs.

Rationale:
- Aligns with TRD and master spec requirements.
- Enables deterministic schema evolution before feature work.

Alternatives considered:
- Deferring migrations to later phases: rejected because Phase 0 acceptance includes migration workflow readiness.

### 5) Health endpoint behavior
Expose `/health` returning success only when app process is alive and connectivity checks for PostgreSQL and Redis pass. Return structured JSON with service status and dependency status fields.

Rationale:
- Maps directly to Phase 0 acceptance criteria.
- Provides a stable operational contract for local checks and deployment probes.

Alternatives considered:
- Liveness-only health endpoint: rejected because it can report healthy while dependencies are unusable.

### 6) Logging and error boundaries
Use Pino as base logger and standardize request/error logging hooks in Elysia. Log dependency startup failures and health check failures with structured metadata.

Rationale:
- Meets TRD observability baseline and prepares for later Sentry integration.
- Reduces debugging time in local/CI failures.

Alternatives considered:
- Console logging only: rejected because it is not structured enough for operational use.

## Risks / Trade-offs

- [Startup dependency strictness may block local boot when services are down] -> Mitigation: allow explicit startup mode controls only if documented; default behavior remains fail-fast for required dependencies.
- [Early migration schema choices may need refinement in later phases] -> Mitigation: keep migrations minimal to Phase 0 ownership boundaries and evolve through additive migrations.
- [Health checks can increase dependency load if probed frequently] -> Mitigation: use lightweight ping/query patterns and avoid expensive checks.
- [Monorepo script drift between root and backend workspace] -> Mitigation: define clear script contracts and verify through root turbo tasks.
