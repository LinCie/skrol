# Phase 2 Auth Dashboard Basics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` and complete tasks in order. Steps use checkbox syntax for tracking.

**Goal:** Implement Phase 2 so authenticated dashboard users can sign up/log in/log out, create links, list only their own links, and view only their own link details.

**Architecture:** Use native Better Auth routing at `/api/auth/*`, keep skrol product APIs at `/api/v1/*`, enforce ownership in backend use cases/repositories, and keep frontend route guards UX-only.

**Tech Stack:** Bun, Elysia, Better Auth `1.6.11`, Kysely, PostgreSQL, TanStack Router, React, Vitest, bun:test

---

## File Structure Plan

### Create

- `apps/backend/src/modules/auth/auth.module.ts` - compose Better Auth instance, session service, and guard plugin wiring.
- `apps/backend/src/modules/auth/application/auth-principal.ts` - auth principal type and context key.
- `apps/backend/src/modules/auth/application/auth-session.service.ts` - `resolveFromRequest` contract.
- `apps/backend/src/modules/auth/infrastructure/better-auth.server.ts` - Better Auth server config and exports.
- `apps/backend/src/modules/auth/infrastructure/auth-session.service.impl.ts` - Better Auth-backed principal/session resolver.
- `apps/backend/src/modules/auth/presentation/session-guard.ts` - short-circuiting session guard plugin/macro.
- `apps/backend/src/modules/auth/presentation/routes/mount-better-auth.ts` - mount native Better Auth handler under `/api/auth/*`.
- `apps/backend/src/modules/users/infrastructure/user-profiles.repository.ts` - profile ensure/find/upsert operations.
- `apps/backend/src/modules/shared/presentation/api-error.ts` - consistent product API error helper.
- `apps/backend/src/modules/links/application/list-links.use-case.ts` - owner-scoped list use case.
- `apps/backend/src/modules/links/application/get-link-detail.use-case.ts` - owner-scoped detail use case.
- `apps/backend/src/modules/links/presentation/routes/links-api.routes.ts` - `POST/GET/GET:id` routes using session principal.
- `apps/backend/src/__tests__/phase2/config-auth-env.test.ts` - auth env naming/requirements tests.
- `apps/backend/src/__tests__/phase2/session-guard.test.ts` - auth short-circuit behavior tests.
- `apps/backend/src/__tests__/phase2/auth-native-routes.test.ts` - Better Auth native route behavior tests.
- `apps/backend/src/__tests__/phase2/links-api-routes.test.ts` - create/list/detail ownership and envelope tests.
- `apps/backend/src/__tests__/phase2/user-profiles-defaulting.test.ts` - signup/backfill/idempotency/role safety tests.
- `apps/frontend/src/lib/api-client.ts` - product API client with credentials included.
- `apps/frontend/src/lib/auth-client.ts` - Better Auth React client setup.
- `apps/frontend/src/lib/query-string.ts` - link list query param helper.
- `apps/frontend/src/routes/login.tsx` - custom login form route.
- `apps/frontend/src/routes/signup.tsx` - custom signup form route.
- `apps/frontend/src/routes/dashboard.tsx` - protected dashboard shell route.
- `apps/frontend/src/routes/dashboard.links.tsx` - list page.
- `apps/frontend/src/routes/dashboard.links.new.tsx` - create page.
- `apps/frontend/src/routes/dashboard.links.$id.tsx` - detail page.
- `apps/frontend/src/__tests__/phase2/route-guard.test.tsx` - redirect and restore tests.
- `apps/frontend/src/__tests__/phase2/auth-pages.test.tsx` - login/signup behavior tests.
- `apps/frontend/src/__tests__/phase2/links-pages.test.tsx` - links empty/error/not-found tests.

### Modify

- `apps/backend/package.json` - Better Auth dependencies/scripts.
- `apps/backend/src/shared/config.ts` - `BETTER_AUTH_URL` and `BETTER_AUTH_SECRET` loading.
- `apps/backend/src/index.ts` - mount Better Auth and register phase routes.
- `apps/backend/src/modules/links/application/links.repository.ts` - owner-scoped contracts.
- `apps/backend/src/modules/links/infrastructure/repositories/links.repository.impl.ts` - owner-scoped DB queries.
- `apps/backend/src/modules/links/links.module.ts` - compose create/list/detail use cases.
- `apps/frontend/src/routes/__root.tsx` - auth/session-aware root behavior.
- `apps/frontend/src/routeTree.gen.ts` - regenerated routes.
- `apps/frontend/vite.config.ts` - test config if needed.

---

## Task 1: Correct Backend Auth Dependency and Env Surface

**Files:**

- Modify: `apps/backend/package.json`
- Modify: `apps/backend/src/shared/config.ts`
- Create: `apps/backend/src/__tests__/phase2/config-auth-env.test.ts`

- [x] **Step 1: Add failing env tests using Better Auth naming**

```ts
import { describe, expect, it } from "bun:test";
import { loadConfig } from "@/shared/config";

describe("auth config env", () => {
	it("requires BETTER_AUTH_SECRET", () => {
		const prev = process.env.BETTER_AUTH_SECRET;
		delete process.env.BETTER_AUTH_SECRET;
		expect(() => loadConfig()).toThrow();
		if (prev) process.env.BETTER_AUTH_SECRET = prev;
	});

	it("uses BETTER_AUTH_URL (not BETTER_AUTH_BASE_URL)", () => {
		const prev = process.env.BETTER_AUTH_URL;
		process.env.BETTER_AUTH_URL = "http://localhost:3000";
		const config = loadConfig();
		expect(config.betterAuthUrl).toBe("http://localhost:3000");
		if (prev) process.env.BETTER_AUTH_URL = prev;
	});
});
```

- [x] **Step 2: Run test and confirm fail first**

Run: `bun test src/__tests__/phase2/config-auth-env.test.ts`  
Expected: FAIL before config updates.

- [x] **Step 3: Add dependencies and env config fields**

Plan requirements:

- use Better Auth `1.6.11`
- config exposes `betterAuthSecret` and `betterAuthUrl`
- remove `BETTER_AUTH_BASE_URL` usage

- [x] **Step 4: Re-run test**

Run: `bun test src/__tests__/phase2/config-auth-env.test.ts`  
Expected: PASS.

---

## Task 1.5: Configure Better Auth PostgreSQL Adapter and Schema Workflow

**Files:**

- Modify: `apps/backend/package.json`
- Create/Modify: auth integration files and migration/schema tooling files as required by current repo conventions
- Documentation touchpoint: ensure usage instructions are explicit in code comments or local docs if needed

- [x] **Step 1: Add failing integration check (if absent)**

Add a narrow test or runtime check that fails if Better Auth schema tables are missing/unreachable.

- [x] **Step 2: Configure Better Auth for PostgreSQL + base path**

Requirements:

- Better Auth `1.6.11`
- `BETTER_AUTH_URL`
- `BETTER_AUTH_SECRET`
- base path at `/api/auth`
- Better Auth server config must enable email/password auth:

```ts
emailAndPassword: {
	enabled: true,
}
```

- [x] **Step 3: Generate/apply Better Auth schema**

Required outcomes:

- Better Auth-managed tables exist
- no speculative hard-coded table names introduced in skrol-owned migrations

- [x] **Step 4: Verify schema ownership boundary**

Confirm:

- Better Auth owns auth/session/account/verification/API-key lifecycle tables
- skrol-owned tables remain in skrol migrations/domain modules

---

## Task 2: Implement Real Session Resolution and Short-Circuit Guard

**Files:**

- Create: `apps/backend/src/modules/auth/application/auth-principal.ts`
- Create: `apps/backend/src/modules/auth/application/auth-session.service.ts`
- Create: `apps/backend/src/modules/auth/infrastructure/auth-session.service.impl.ts`
- Create: `apps/backend/src/modules/auth/presentation/session-guard.ts`
- Create: `apps/backend/src/modules/auth/auth.module.ts`
- Create: `apps/backend/src/modules/shared/presentation/api-error.ts`
- Test: `apps/backend/src/__tests__/phase2/session-guard.test.ts`

- [x] **Step 1: Add failing guard tests with correct interface contract**

```ts
import { describe, expect, it, mock } from "bun:test";
import { Elysia } from "elysia";
import { requireSession } from "@/modules/auth/presentation/session-guard";

describe("requireSession", () => {
	it("returns 401 and does not execute handler when no session", async () => {
		const handler = mock(() => ({ ok: true }));

		const app = new Elysia()
			.use(requireSession({ resolveFromRequest: async () => null }))
			.get("/private", handler);

		const response = await app.handle(new Request("http://localhost/private"));
		expect(response.status).toBe(401);
		expect(handler).not.toHaveBeenCalled();
	});
});
```

- [x] **Step 2: Run test and confirm fail first**

Run: `bun test src/__tests__/phase2/session-guard.test.ts`  
Expected: FAIL.

- [x] **Step 3: Implement principal type + guard + shared error helper**

Required behavior:

- principal shape includes `userId`, `sessionId`, `authSource: "session"`
- unauthenticated requests return exact envelope:

```json
{
	"error": {
		"code": "unauthorized",
		"message": "Authentication is required."
	}
}
```

- guard short-circuits protected handlers

- [x] **Step 4: Re-run guard tests**

Run: `bun test src/__tests__/phase2/session-guard.test.ts`  
Expected: PASS.

---

## Task 3: Mount Native Better Auth Routes (No `/api/v1/auth/*` Wrappers)

**Files:**

- Create: `apps/backend/src/modules/auth/infrastructure/better-auth.server.ts`
- Create: `apps/backend/src/modules/auth/presentation/routes/mount-better-auth.ts`
- Modify: `apps/backend/src/modules/auth/auth.module.ts`
- Modify: `apps/backend/src/index.ts`
- Test: `apps/backend/src/__tests__/phase2/auth-native-routes.test.ts`

- [x] **Step 1: Add failing route tests that target native path boundary**

Tests should assert:

- Better Auth endpoints are reachable under `/api/auth/*`
- `/api/v1/auth/*` is not used for phase 2 auth behavior

- [x] **Step 2: Run test and confirm fail first**

Run: `bun test src/__tests__/phase2/auth-native-routes.test.ts`  
Expected: FAIL before mount.

- [x] **Step 3: Implement Better Auth mount and config**

Requirements:

- mount Better Auth handler natively under `/api/auth/*`
- implementation note: do not double-prefix Better Auth routes. If Better Auth `basePath` is `/api/auth`, mount `auth.handler` directly according to the Elysia integration. Do not also wrap it in an Elysia `/api/auth` group unless `basePath` is adjusted accordingly.
- ensure cookies and session behavior are real
- preserve `/api/v1/*` for product routes only

- [x] **Step 4: Re-run auth-native tests**

Run: `bun test src/__tests__/phase2/auth-native-routes.test.ts`  
Expected: PASS.

---

## Task 4: Implement `user_profiles` Defaulting (Signup + Lazy Backfill)

**Files:**

- Create: `apps/backend/src/modules/users/infrastructure/user-profiles.repository.ts`
- Modify: `apps/backend/src/modules/auth/infrastructure/auth-session.service.impl.ts`
- Test: `apps/backend/src/__tests__/phase2/user-profiles-defaulting.test.ts`

- [x] **Step 1: Add failing tests for dual-path behavior and role safety**

Required tests:

- signup ensures row exists with role `user`
- session resolution lazily creates missing profile
- repeated ensure/backfill is idempotent
- existing `admin` role is not overwritten

- [x] **Step 2: Run test and confirm fail first**

Run: `bun test src/__tests__/phase2/user-profiles-defaulting.test.ts`  
Expected: FAIL.

- [x] **Step 3: Implement DI-friendly profile ensure logic**

Use one of:

- `ensureUserProfile(db, userId)`
- repository class with constructor-injected DB

Do not hide DB acquisition in a way that makes tests brittle.

- [x] **Step 4: Hook ensure behavior into signup and session-resolution flow**

Required behavior:

- called after successful signup
- called as lazy backfill during session resolution
- preferred signup profile creation mechanism: Better Auth `databaseHooks.user.create.after`, calling the same idempotent `ensureUserProfile(db, user.id)` used by lazy session backfill

- [x] **Step 4.5: Reconcile existing migration references before adding/adjusting FKs**

Required check:

- inspect existing skrol migrations for placeholder references such as `auth_users`
- if present, reconcile against the actual Better Auth generated user table name, or intentionally avoid DB-level FK until generated schema boundary is stable

- [x] **Step 5: Re-run tests**

Run: `bun test src/__tests__/phase2/user-profiles-defaulting.test.ts`  
Expected: PASS.

---

## Task 5: Add Owner-Scoped Link Use Cases and Repository Contracts

**Files:**

- Modify: `apps/backend/src/modules/links/application/links.repository.ts`
- Modify: `apps/backend/src/modules/links/infrastructure/repositories/links.repository.impl.ts`
- Create: `apps/backend/src/modules/links/application/list-links.use-case.ts`
- Create: `apps/backend/src/modules/links/application/get-link-detail.use-case.ts`
- Modify: `apps/backend/src/modules/links/links.module.ts`
- Test: owner-scoped use-case and repository tests

- [x] **Step 1: Add failing tests that prove real ownership filtering**

Avoid fake stubs like `[{ id: "1", userId: owner }]` that echo input and hide bugs.

Use either:

- seeded integration data, or
- strict fakes with explicit user_a/user_b records and assertions

- [x] **Step 2: Run test and confirm fail first**

Run: relevant backend phase2 tests  
Expected: FAIL before contracts/impl.

- [x] **Step 3: Extend repository contracts and implement queries**

Required methods:

- `listByOwner({ ownerUserId, limit, cursor })`
- `findByIdForOwner(id, ownerUserId)`

ID assumptions:

- `links.id` is UUID; fixtures should use UUID-like values.

- [x] **Step 4: Re-run tests**

Expected: PASS.

---

## Task 6: Implement Full Phase 2 `/api/v1/links*` Routes

**Files:**

- Create: `apps/backend/src/modules/links/presentation/routes/links-api.routes.ts`
- Modify: `apps/backend/src/index.ts`
- Test: `apps/backend/src/__tests__/phase2/links-api-routes.test.ts`

- [ ] **Step 1: Add failing route tests for all required endpoints**

Must cover:

- `POST /api/v1/links`
- `GET /api/v1/links`
- `GET /api/v1/links/:id`

Must assert:

- unauthenticated -> `401 unauthorized`
- authenticated list returns owner-only items
- cross-user detail -> `404 not_found`

- [ ] **Step 2: Run tests and confirm fail first**

Run: `bun test src/__tests__/phase2/links-api-routes.test.ts`  
Expected: FAIL before implementation.

- [ ] **Step 3: Implement routes with principal guard and shared error helper**

Requirements:

- route auth uses session principal
- owner always derived from principal
- standardized error envelope through helper

- [ ] **Step 4: Re-run links route tests**

Run: `bun test src/__tests__/phase2/links-api-routes.test.ts`  
Expected: PASS.

---

## Task 7: Frontend Better Auth Client + Protected Dashboard Guard

**Files:**

- Create: `apps/frontend/src/lib/auth-client.ts`
- Create: `apps/frontend/src/routes/dashboard.tsx`
- Modify: `apps/frontend/src/routes/__root.tsx`
- Test: `apps/frontend/src/__tests__/phase2/route-guard.test.tsx`

- [ ] **Step 1: Add failing route-guard tests**

Must assert:

- unauthenticated access redirects to `/login`
- redirect target is preserved/restored
- authenticated user at `/login` or `/signup` is redirected to dashboard

- [ ] **Step 2: Run tests and confirm fail first**

Run: `bun run test -- --run src/__tests__/phase2/route-guard.test.tsx`  
Expected: FAIL.

- [ ] **Step 3: Implement Better Auth frontend client usage**

Direction:

- use `createAuthClient` and Better Auth client APIs
- do not implement hand-rolled `/api/v1/auth/*` client wrappers for phase 2

- [ ] **Step 4: Implement dashboard guard behavior and rerun tests**

Run: `bun run test -- --run src/__tests__/phase2/route-guard.test.tsx`  
Expected: PASS.

---

## Task 8: Build Custom Login and Signup Pages Against Better Auth Client

**Files:**

- Create: `apps/frontend/src/routes/login.tsx`
- Create: `apps/frontend/src/routes/signup.tsx`
- Create: `apps/frontend/src/__tests__/phase2/auth-pages.test.tsx`
- Modify: `apps/frontend/src/routeTree.gen.ts`

- [ ] **Step 1: Add failing auth page tests**

Must cover:

- renders custom forms
- success paths call Better Auth client and navigate correctly
- failure paths show actionable errors
- dashboard shell exposes logout action
- logout calls `authClient.signOut()`
- successful logout redirects to `/login`
- protected dashboard route becomes inaccessible after logout

- [ ] **Step 2: Run tests and confirm fail first**

Run: `bun run test -- --run src/__tests__/phase2/auth-pages.test.tsx`  
Expected: FAIL.

- [ ] **Step 3: Implement routes and behavior**

Use:

- `authClient.signIn.email(...)`
- `authClient.signUp.email(...)`
- `authClient.getSession()` as needed

- [ ] **Step 4: Re-run tests**

Run: `bun run test -- --run src/__tests__/phase2/auth-pages.test.tsx`  
Expected: PASS.

---

## Task 9: Build Dashboard Links Pages (List/Create/Detail)

**Files:**

- Create: `apps/frontend/src/lib/api-client.ts`
- Create: `apps/frontend/src/lib/query-string.ts`
- Create: `apps/frontend/src/routes/dashboard.links.tsx`
- Create: `apps/frontend/src/routes/dashboard.links.new.tsx`
- Create: `apps/frontend/src/routes/dashboard.links.$id.tsx`
- Create: `apps/frontend/src/__tests__/phase2/links-pages.test.tsx`
- Modify: `apps/frontend/src/routeTree.gen.ts`

- [ ] **Step 1: Add failing links page tests for empty/error/not-found states**

Must cover:

- list empty state
- list generic error state
- create validation error mapping
- detail not-found state

- [ ] **Step 2: Run tests and confirm fail first**

Run: `bun run test -- --run src/__tests__/phase2/links-pages.test.tsx`  
Expected: FAIL.

- [ ] **Step 3: Implement API client with credentials included**

Requirement:

```ts
credentials: "include";
```

Apply to product API fetch calls.

- [ ] **Step 4: Implement list/create/detail pages against `/api/v1/links*`**

Expected backend dependencies already complete from Task 6.

- [ ] **Step 5: Re-run tests**

Run: `bun run test -- --run src/__tests__/phase2/links-pages.test.tsx`  
Expected: PASS.

---

## Task 10: CORS/Origin/CSRF Posture for Credentialed Session Flows

**Files:**

- Modify: backend app bootstrap/config files responsible for CORS/origin policy
- Add/modify focused tests if CORS behavior is testable in repo harness

- [ ] **Step 1: Add failing config/assertion tests where feasible**

At minimum, validate app config does not allow wildcard origin with credentials.

- [ ] **Step 2: Implement strict credentialed CORS/trusted-origin configuration**

Requirements:

- allow frontend dev/prod origins explicitly
- `credentials: true`
- no `origin: *` when credentials are enabled

- [ ] **Step 3: Verify security posture**

Documented phase decision:

- SameSite Lax + strict trusted origins/CORS for dashboard-originated requests

---

## Task 11: End-to-End Phase Verification and Cleanup

**Files:**

- Modify: any test files needed for missing regressions
- Modify: design doc only if implementation revealed required clarification

- [ ] **Step 1: Add missing high-signal regression tests**

Checklist:

- handler-not-called on unauthenticated protected route
- cross-user detail returns `404`
- unauthenticated list returns `401`
- signup + lazy profile backfill behaviors remain correct

- [ ] **Step 2: Run backend phase2 test suite**

Run: `bun run test:phase2`  
Expected: PASS.

- [ ] **Step 3: Run app-level tests, lint, and typecheck**

Run: `bunx turbo run test --filter=backend --filter=skrol-frontend`  
Expected: PASS.

Run: `bunx turbo run lint --filter=backend --filter=skrol-frontend`  
Expected: PASS.

Run: `bunx turbo run check-types --filter=backend --filter=skrol-frontend`  
Expected: PASS.

- [ ] **Step 4: Manual smoke verification**

Run: `bun run dev`  
Expected outcomes:

1. signup -> login -> `/dashboard/links`
2. logged-out access to `/dashboard/links` redirects to `/login`
3. create-link from dashboard succeeds
4. links list shows only current user links
5. non-owned link detail shows not-found state

---

## Spec Coverage Check

- Better Auth integration and real schema workflow: Tasks 1, 1.5, 3
- native auth route boundary (`/api/auth/*`): Task 3
- secure session guard with strict short-circuiting: Task 2
- `user_profiles` dual-path behavior: Task 4
- session-authenticated create/list/detail product APIs: Tasks 5-6
- frontend Better Auth client + guarded dashboard routes: Tasks 7-8
- links list/create/detail pages + required states: Task 9
- credentialed CORS/origin posture and CSRF-adjacent decision: Task 10
- full verification gate: Task 11

## Placeholder Scan

- No fake auth route stubs (`{ ok: true }`) are allowed in this plan.
- No route-existence-only tests are accepted as completion evidence.

## Type and Contract Consistency Check

- Session resolver contract is `resolveFromRequest(request)` consistently.
- Product API error envelope remains `{ error: { code, message } }`.
- Link IDs in tests/fixtures should be UUID-like values.
