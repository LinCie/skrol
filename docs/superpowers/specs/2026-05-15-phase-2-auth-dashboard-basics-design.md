# Phase 2 Design: Authentication and Dashboard Basics

Date: 2026-05-15  
Project: skrol  
Phase: 2 (Authentication and Dashboard Basics)  
Status: Revised per final plan-review verdict (implementation-ready)

## 1. Goal and Scope

Phase 2 makes skrol usable by authenticated dashboard users, aligned with `docs/v1/4-master-spec.md` Phase 2 acceptance criteria.

In scope:

- Better Auth `1.6.11` integration for dashboard sessions
- native Better Auth endpoint mounting at `/api/auth/*`
- custom dashboard signup/login/logout forms using Better Auth client APIs
- protected dashboard routes
- `user_profiles` creation/defaulting strategy
- shared links APIs used via session auth:
  - `POST /api/v1/links`
  - `GET /api/v1/links`
  - `GET /api/v1/links/:id`
- dashboard pages:
  - `/dashboard/links`
  - `/dashboard/links/new`
  - `/dashboard/links/:id`
- links-only required empty/error states for Phase 2

Out of scope:

- API key pages and lifecycle UI (`/dashboard/api-keys`)
- account settings page (`/dashboard/settings`)
- API-key auth for `/api/v1/*` (Phase 3)
- analytics UI and analytics API expansion (Phase 4)
- admin abuse-control pages (Phase 5)

## 2. Governing Decisions

Source-of-truth references:

- product scope and non-goals: `docs/v1/1-project-prd.md`
- technical behavior: `docs/v1/2-project-trd.md`
- schema boundaries: `docs/v1/3-project-erd.md`
- phase deliverables and acceptance: `docs/v1/4-master-spec.md`

Required decisions for this phase:

1. Scope stays at Master Spec Phase 2 minimum.
2. `/api/v1/links*` endpoints are shared and accept session auth in Phase 2.
3. Auth UI uses custom frontend forms (not prebuilt Better Auth pages).
4. Required UI state coverage in Phase 2 is links-only.
5. `user_profiles` uses dual-path creation:
   - after signup
   - lazy idempotent backfill on authenticated request
6. Better Auth is mounted natively; no fake `/api/v1/auth/*` placeholder routes.
7. Env naming follows Better Auth conventions:
   - `BETTER_AUTH_URL`
   - `BETTER_AUTH_SECRET`

## 3. Route and Module Boundaries

### 3.1 HTTP Route Split

The phase uses explicit route boundaries:

- `/api/auth/*` -> Better Auth native routes
- `/api/v1/links*` -> skrol product API
- `/dashboard/*` -> frontend dashboard routes

This avoids wrapper brittleness and keeps product API versioning concerns separate from auth engine internals.

### 3.2 Backend Module Boundaries

Keep existing modular backend style and add an auth slice:

- `modules/auth`
  - Better Auth server integration and mounting
  - session resolution utilities
  - route guard/middleware and principal construction
- `modules/users`
  - `user_profiles` persistence and idempotent ensure logic
- `modules/links`
  - create/list/detail use cases
  - ownership-aware repository queries

Design rule:

- handlers remain thin and delegate behavior to use-case/service classes.

### 3.3 Frontend Route Boundaries

TanStack Router route groups:

- public routes: `/login`, `/signup`
- protected routes: `/dashboard/links`, `/dashboard/links/new`, `/dashboard/links/:id`

Auth guard behavior:

- unauthenticated users redirect to `/login`
- destination is preserved and restored after login
- authenticated users visiting `/login` or `/signup` redirect to `/dashboard/links`

## 4. Better Auth 1.6.11 Integration Requirements

Phase 2 must include real Better Auth integration, not scaffold placeholders.

Required implementation requirements:

1. Configure Better Auth `1.6.11` with PostgreSQL adapter.
   - explicitly enable email/password auth:

```ts
emailAndPassword: {
	enabled: true,
}
```

2. Configure and document base URL/path values:
   - `BETTER_AUTH_URL`
   - auth base path `/api/auth`
3. Configure trusted origins for frontend dashboard origin(s).
4. Run Better Auth schema generation/migration workflow and apply schema.
5. Verify generated auth table names before adding any skrol references.
6. Preserve ERD ownership boundaries:
   - Better Auth manages auth/session/account/verification/API-key lifecycle tables
   - skrol manages product tables

Important rule:

- do not hard-code speculative Better Auth table names into skrol migrations.

## 5. Backend Contracts

### 5.1 Principal and Session Guard

Protected product routes use:

```ts
export interface AuthPrincipal {
	userId: string;
	sessionId: string;
	authSource: "session";
}
```

Guard requirements:

1. Resolve session from request cookie via Better Auth.
2. On missing/invalid session, short-circuit request (handler must not run).
3. Return `401` with product API error envelope.
4. On success, attach principal to request context.

Phase 2 error shape for product APIs:

```json
{
	"error": {
		"code": "unauthorized",
		"message": "Authentication is required."
	}
}
```

No nested `unauthorized` object is allowed.

### 5.2 `user_profiles` Creation and Defaulting

Required behavior:

- after successful signup, ensure `user_profiles` row exists with role `user`
- during session resolution, lazily ensure missing `user_profiles` row via idempotent operation
- never overwrite existing non-default roles (for example, `admin`)

### 5.3 Links API Behavior (Phase 2)

`POST /api/v1/links`

- requires valid session principal
- owner `user_id` is always derived from principal
- returns `201` on success

`GET /api/v1/links`

- requires valid session principal
- returns only links owned by principal
- excludes soft-deleted links
- uses `limit` (default `20`, max `100`) and optional `cursor`
- returns `{ items, nextCursor }`

`GET /api/v1/links/:id`

- requires valid session principal
- returns item only when owned by principal
- non-owned and missing both return `404` (`not_found`)

### 5.4 Error Helper

Add a shared product API error helper (example shape):

```ts
apiError(set, 401, "unauthorized", "Authentication is required.");
```

Use this across `/api/v1/*` product routes for consistency.

Better Auth native endpoint response formats remain Better Auth defaults.

## 6. Frontend Contracts

### 6.1 Auth Client Direction

Frontend auth uses Better Auth client APIs against mounted Better Auth routes:

```ts
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
	baseURL: import.meta.env.VITE_AUTH_BASE_URL,
});
```

`VITE_AUTH_BASE_URL` must be the backend origin (for example, `http://localhost:3000`), not `http://localhost:3000/api/auth`, unless Better Auth client/basePath behavior is intentionally configured differently.

Auth pages call:

- `authClient.signUp.email(...)`
- `authClient.signIn.email(...)`
- `authClient.signOut(...)`
- `authClient.getSession()`

Phase 2 does not use hand-rolled `/api/v1/auth/*` wrappers.

### 6.2 Product API Client Behavior

Dashboard calls to `/api/v1/links*` must include credentials:

```ts
fetch(url, { credentials: "include", ... })
```

Without credentials, session cookies will not be sent reliably in local cross-origin development.

## 7. Security and Privacy Constraints

Required security posture for phase 2:

- session cookies: `httpOnly`, `sameSite=lax`, `secure` in production
- strict credentialed CORS/trusted-origin configuration
- never use `origin: *` with credentials
- no logging of passwords, raw keys, or authorization headers
- ownership checks on create/list/detail flows
- dashboard output remains escaped/safe for user-controlled fields

CSRF/origin decision for phase 2:

- rely on `SameSite=Lax` plus strict trusted origins/CORS for dashboard-originated credentialed requests
- do not allow arbitrary cross-origin credentialed requests

## 8. Testing and Verification Requirements

### 8.1 Backend Tests

- Better Auth signup/login/logout/session behavior is real, not stubbed
- guard returns `401` for unauthenticated requests and protected handler is not executed
- authenticated requests receive principal and reach protected handler
- links create/list/detail happy paths with session auth
- ownership isolation with two real users:
  - list returns only owner links
  - cross-user detail returns `404`
  - unauthenticated access returns `401`
- `user_profiles` tests:
  - signup creates default profile
  - lazy backfill creates missing profile
  - repeated backfill is idempotent
  - existing elevated role is not overwritten

### 8.2 Frontend Tests

- route guard redirect behavior (including destination restore)
- login/signup success and failure flows using Better Auth client
- links list empty/error states
- create-link validation mapping
- link detail not-found behavior

### 8.3 Test Quality Rule

Avoid false-positive tests that only prove route existence or echo fake owner values.

Prefer behavior assertions that verify auth/session/cookie ownership behavior end-to-end for phase boundaries.

### 8.4 Validation Commands

From repository root:

- `bunx turbo run lint --filter=backend --filter=skrol-frontend`
- `bunx turbo run check-types --filter=backend --filter=skrol-frontend`
- `bunx turbo run test --filter=backend --filter=skrol-frontend`

Manual smoke coverage:

1. signup -> login -> dashboard access
2. logged-out access to `/dashboard/*` redirects to `/login`
3. dashboard create link succeeds
4. list returns only current-user links
5. cross-user detail renders not-found

## 9. Data and Type Consistency

- `links.id` remains UUID (PostgreSQL UUID, master spec default `uuidv7()` guidance)
- TypeScript models may represent UUID as `string`, but fixtures should use UUID-like values, not integer-like placeholders

## 10. Acceptance Mapping for Phase 2

This design satisfies Master Spec Phase 2 by ensuring:

1. user can sign up
2. user can log in
3. user can log out
4. logged-out users cannot access dashboard pages
5. logged-in users can create a link from dashboard
6. logged-in users can list only their own links
7. logged-in users can view only their own link details
8. dashboard renders required links-scoped empty/error states

## 11. Risks and Mitigations

Risk: fake auth scaffold passes tests while auth is broken.

- Mitigation: native Better Auth routing and behavior assertions.

Risk: profile drift (`auth user` exists but `user_profiles` missing).

- Mitigation: signup ensure + lazy idempotent backfill.

Risk: cross-user existence leakage.

- Mitigation: ownership misses return `404` on detail.

Risk: cookie-auth failures in local dev.

- Mitigation: `credentials: include` + strict credentialed CORS/trusted-origin configuration.

## 12. Implementation Readiness Sequence

1. configure Better Auth adapter/schema/env/base path/trusted origins
2. mount Better Auth native routes at `/api/auth/*`
3. implement robust session guard and principal context
4. implement full phase links API (`POST`, `GET list`, `GET detail`)
5. add frontend Better Auth client + dashboard guards
6. add dashboard links pages
7. run tests/lint/typecheck/manual smoke
