# Frontend Redirect Catch-All Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate short links on the frontend origin and resolve public short-code visits through a frontend route that calls a backend redirect-decision API.

**Architecture:** Backend keeps link resolution, lifecycle checks, and analytics insertion in the existing redirect use case. Backend exposes redirect decisions at `/api/v1/redirect/:code` as JSON, while frontend adds a root dynamic route `/$code` that calls the API and navigates with `window.location.replace()`. Link DTOs use a configured frontend public origin instead of the backend request origin.

**Tech Stack:** Bun, Elysia, Kysely, Vite, React, TanStack Router, Vitest, Testing Library.

**Repo Rule:** Do not create git commits during execution unless the user explicitly requests a commit. This overrides the generic frequent-commit habit.

---

## File Map

- Modify `apps/backend/src/shared/config.ts`: add `publicFrontendOrigin` config field and validation.
- Modify `apps/backend/src/__tests__/phase2/config-auth-env.test.ts`: cover `PUBLIC_FRONTEND_ORIGIN` explicit and default behavior.
- Modify `apps/backend/src/modules/links/presentation/routes/links-api.routes.ts`: build `short_url` from `config.publicFrontendOrigin`.
- Modify `apps/backend/src/__tests__/phase2/links-api-routes.test.ts`: update `short_url` expectations to frontend origin.
- Modify `apps/backend/src/modules/redirect/presentation/routes/public-redirect-route.ts`: replace public `/:code` redirect route with `/api/v1/redirect/:code` JSON decision route.
- Modify `apps/backend/src/__tests__/phase1/public-redirect-route.test.ts`: update route tests for decision API and removed public redirect behavior.
- Modify `apps/frontend/src/lib/api-client.ts`: add redirect-decision API helper.
- Create `apps/frontend/src/routes/$code.tsx`: frontend short-code route.
- Modify `apps/frontend/src/routeTree.gen.ts`: regenerate or update generated route tree to include `/$code`.
- Create `apps/frontend/src/__tests__/phase2/public-redirect-route.test.tsx`: test frontend catch-all redirect states.
- Modify `docs/v1/1-project-prd.md`: clarify public short links terminate at frontend origin.
- Modify `docs/v1/2-project-trd.md`: update architecture, API, redirect flow, deployment, and performance wording.
- Modify `docs/v1/4-master-spec.md`: update MVP redirect URL flow and implementation criteria.

---

### Task 1: Backend Public Frontend Origin Config

**Files:**
- Modify: `apps/backend/src/shared/config.ts`
- Modify: `apps/backend/src/__tests__/phase2/config-auth-env.test.ts`

- [x] **Step 1: Write failing config tests**

In `apps/backend/src/__tests__/phase2/config-auth-env.test.ts`, add `PUBLIC_FRONTEND_ORIGIN` to `BASE_ENV`, `snapshotEnv()`, and `restoreEnv()`:

```ts
const BASE_ENV = {
  NODE_ENV: "test",
  PORT: "3000",
  DATABASE_URL: "postgresql://test:test@localhost:5432/skrol_test",
  REDIS_URL: "redis://localhost:6379",
  BETTER_AUTH_URL: "http://localhost:3000",
  BETTER_AUTH_SECRET: "test-secret",
  FRONTEND_ORIGINS: "http://localhost:5173,https://app.skrol.local",
  PUBLIC_FRONTEND_ORIGIN: "http://localhost:3000",
};
```

```ts
function snapshotEnv() {
  return {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    FRONTEND_ORIGINS: process.env.FRONTEND_ORIGINS,
    PUBLIC_FRONTEND_ORIGIN: process.env.PUBLIC_FRONTEND_ORIGIN,
  };
}
```

```ts
function restoreEnv(snapshot: ReturnType<typeof snapshotEnv>) {
  process.env.NODE_ENV = snapshot.NODE_ENV;
  process.env.PORT = snapshot.PORT;
  process.env.DATABASE_URL = snapshot.DATABASE_URL;
  process.env.REDIS_URL = snapshot.REDIS_URL;
  process.env.BETTER_AUTH_URL = snapshot.BETTER_AUTH_URL;
  process.env.BETTER_AUTH_SECRET = snapshot.BETTER_AUTH_SECRET;
  process.env.FRONTEND_ORIGINS = snapshot.FRONTEND_ORIGINS;
  process.env.PUBLIC_FRONTEND_ORIGIN = snapshot.PUBLIC_FRONTEND_ORIGIN;
}
```

Update the existing config surface test:

```ts
expect(config.publicFrontendOrigin).toBe("http://localhost:3000");
```

Add default behavior assertion to the development default test after `config.frontendOrigins` assertion:

```ts
expect(config.publicFrontendOrigin).toBe("http://localhost:3000");
```

Add invalid origin test inside `describe("auth config env", () => { ... })`:

```ts
it("rejects invalid PUBLIC_FRONTEND_ORIGIN", async () => {
  const snapshot = snapshotEnv();
  const originalExit = process.exit;

  try {
    Object.assign(process.env, BASE_ENV, {
      PUBLIC_FRONTEND_ORIGIN: "not-a-url",
    });
    process.exit = ((code?: number) => {
      throw new Error(`process.exit:${code ?? 0}`);
    }) as typeof process.exit;

    await expect(importConfig("invalid-public-frontend-origin")).rejects.toThrow(
      "process.exit:1",
    );
  } finally {
    process.exit = originalExit;
    restoreEnv(snapshot);
  }
});
```

- [x] **Step 2: Run config tests and confirm failure**

Run from `apps/backend`:

```bash
bun test src/__tests__/phase2/config-auth-env.test.ts
```

Expected: FAIL because `config.publicFrontendOrigin` does not exist and invalid `PUBLIC_FRONTEND_ORIGIN` is not validated.

- [x] **Step 3: Implement config**

In `apps/backend/src/shared/config.ts`, add field:

```ts
interface Config {
  env: string;
  port: number;
  databaseUrl: string;
  redisUrl: string;
  betterAuthUrl: string;
  betterAuthSecret: string;
  frontendOrigins: string[];
  publicFrontendOrigin: string;
  sentryDsn?: string;
}
```

Add helper after `parseFrontendOrigins()`:

```ts
function parseOrigin(value: string, key: string): string {
  try {
    const parsed = new URL(value);
    if (parsed.origin !== value || !["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("invalid origin");
    }
  } catch {
    throw new Error(`Invalid ${key} value: ${value}`);
  }

  return value;
}
```

Replace inline origin validation in `parseFrontendOrigins()` with:

```ts
parseOrigin(origin, "FRONTEND_ORIGINS entry");
```

Inside `loadConfig()`, compute origins first and set public origin:

```ts
const frontendOrigins = parseFrontendOrigins(
  getEnvOptional("FRONTEND_ORIGINS", defaultFrontendOrigins) ?? "",
);
const publicFrontendOrigin = parseOrigin(
  getEnvOptional("PUBLIC_FRONTEND_ORIGIN", frontendOrigins[0]) ?? frontendOrigins[0],
  "PUBLIC_FRONTEND_ORIGIN",
);
const config: Config = {
  env,
  port: parseInt(getEnv("PORT", "3000"), 10),
  databaseUrl: getEnv("DATABASE_URL"),
  redisUrl: getEnv("REDIS_URL"),
  betterAuthUrl: getEnv("BETTER_AUTH_URL"),
  betterAuthSecret: getEnv("BETTER_AUTH_SECRET"),
  frontendOrigins,
  publicFrontendOrigin,
  sentryDsn: getEnvOptional("SENTRY_DSN"),
};
```

- [x] **Step 4: Run config tests and confirm pass**

Run from `apps/backend`:

```bash
bun test src/__tests__/phase2/config-auth-env.test.ts
```

Expected: PASS.

---

### Task 2: Backend Link DTO Uses Frontend Origin

**Files:**
- Modify: `apps/backend/src/modules/links/presentation/routes/links-api.routes.ts`
- Modify: `apps/backend/src/__tests__/phase2/links-api-routes.test.ts`

- [x] **Step 1: Update failing DTO expectations**

In `apps/backend/src/__tests__/phase2/links-api-routes.test.ts`, replace expected `short_url` values:

```ts
short_url: "http://localhost:3000/docs",
```

```ts
short_url: "http://localhost:3000/owner-a",
```

There are three occurrences in create, list, and detail expectations.

- [x] **Step 2: Run links API tests and confirm failure**

Run from `apps/backend`:

```bash
bun test src/__tests__/phase2/links-api-routes.test.ts
```

Expected: FAIL with actual `short_url` using backend request origin.

- [x] **Step 3: Implement frontend-origin DTO**

In `apps/backend/src/modules/links/presentation/routes/links-api.routes.ts`, import config:

```ts
import config from "@/shared/config";
```

Change all `toLinkDto(link, request)` calls to `toLinkDto(link)`.

Replace `toLinkDto` with:

```ts
function toLinkDto(link: Link) {
  return {
    id: link.id,
    short_url: new URL(`/${link.code}`, config.publicFrontendOrigin).toString(),
    code: link.code,
    destination_url: link.destinationUrl,
    title: link.title,
    status: link.status,
    expires_at: link.expiresAt?.toISOString() ?? null,
    created_at: link.createdAt.toISOString(),
  };
}
```

- [x] **Step 4: Run links API tests and confirm pass**

Run from `apps/backend`:

```bash
bun test src/__tests__/phase2/links-api-routes.test.ts
```

Expected: PASS.

---

### Task 3: Backend Redirect Decision API

**Files:**
- Modify: `apps/backend/src/modules/redirect/presentation/routes/public-redirect-route.ts`
- Modify: `apps/backend/src/__tests__/phase1/public-redirect-route.test.ts`

- [x] **Step 1: Update failing redirect route tests**

In `apps/backend/src/__tests__/phase1/public-redirect-route.test.ts`, keep existing `ResolveRedirectUseCase` tests. Replace public route tests with:

```ts
describe("public redirect decision API", () => {
  it("does not treat /health as redirect code", async () => {
    const app = createApp({
      getHealthStatus: async () => healthyStatus,
      resolveRedirectUseCase: buildUseCase(async () => ({
        status: 302 as const,
        location: "https://example.com/docs",
      })),
    });

    const response = await app.handle(new Request("http://localhost/health"));

    expect(response.status).toBe(200);
  });

  it("treats unknown short code as 404", async () => {
    const app = createApp({
      getHealthStatus: async () => healthyStatus,
      resolveRedirectUseCase: buildUseCase(async () => ({
        status: 404 as const,
      })),
    });

    const response = await app.handle(
      new Request("http://localhost/api/v1/redirect/not-a-real-code"),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
  });

  it("returns location JSON and does not set Set-Cookie for active links", async () => {
    const app = createApp({
      getHealthStatus: async () => healthyStatus,
      resolveRedirectUseCase: buildUseCase(async () => ({
        status: 302 as const,
        location: "https://example.com/docs",
      })),
    });

    const response = await app.handle(
      new Request("http://localhost/api/v1/redirect/docs"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("location")).toBeNull();
    expect(await response.json()).toEqual({ location: "https://example.com/docs" });
  });

  it("does not expose active public root redirects from backend", async () => {
    const app = createApp({
      getHealthStatus: async () => healthyStatus,
      resolveRedirectUseCase: buildUseCase(async () => ({
        status: 302 as const,
        location: "https://example.com/docs",
      })),
    });

    const response = await app.handle(new Request("http://localhost/docs"));

    expect(response.status).toBe(404);
    expect(response.headers.get("location")).toBeNull();
  });
});
```

- [x] **Step 2: Run redirect tests and confirm failure**

Run from `apps/backend`:

```bash
bun test src/__tests__/phase1/public-redirect-route.test.ts
```

Expected: FAIL because `/api/v1/redirect/:code` does not exist and backend still redirects `/:code`.

- [x] **Step 3: Implement decision API**

In `apps/backend/src/modules/redirect/presentation/routes/public-redirect-route.ts`, replace route registration with:

```ts
export function registerPublicRedirectRoute(
  app: Elysia,
  deps: PublicRedirectRouteDependencies,
) {
  app.get("/api/v1/redirect/:code", async ({ params, request }) => {
    if (isReservedRouteSegment(params.code)) {
      return notFoundResponse(404);
    }

    const decision = await deps.resolveRedirectUseCase.execute({
      code: params.code,
      request,
    });

    if (decision.status === 302) {
      return Response.json({ location: decision.location ?? "" });
    }

    return notFoundResponse(decision.status);
  });

  return app;
}
```

Do not add any `app.get("/:code", ...)` replacement.

- [x] **Step 4: Run redirect tests and confirm pass**

Run from `apps/backend`:

```bash
bun test src/__tests__/phase1/public-redirect-route.test.ts
```

Expected: PASS.

---

### Task 4: Frontend Redirect API Client

**Files:**
- Modify: `apps/frontend/src/lib/api-client.ts`
- Modify: `apps/frontend/src/__tests__/phase2/api-client.test.ts`

- [x] **Step 1: Write failing API client test**

In `apps/frontend/src/__tests__/phase2/api-client.test.ts`, import `resolveRedirect` from `../../lib/api-client` and add:

```ts
it('resolves redirect decisions through product API base URL', async () => {
  vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8000')
  const fetchMock = vi.mocked(fetch)
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify({ location: 'https://example.com/docs' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  )

  await expect(resolveRedirect('Docs')).resolves.toEqual({
    location: 'https://example.com/docs',
  })

  expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/api/v1/redirect/Docs', {
    credentials: 'include',
  })
})
```

- [x] **Step 2: Run API client test and confirm failure**

Run from `apps/frontend`:

```bash
bun test src/__tests__/phase2/api-client.test.ts
```

Expected: FAIL because `resolveRedirect` is not exported.

- [x] **Step 3: Implement API client helper**

In `apps/frontend/src/lib/api-client.ts`, add type near response types:

```ts
type RedirectDecisionResponse = {
  location: string
}
```

Add exported function after `getLink()`:

```ts
export async function resolveRedirect(code: string) {
  return productFetch<RedirectDecisionResponse>(`/api/v1/redirect/${encodeURIComponent(code)}`)
}
```

- [x] **Step 4: Run API client test and confirm pass**

Run from `apps/frontend`:

```bash
bun test src/__tests__/phase2/api-client.test.ts
```

Expected: PASS.

---

### Task 5: Frontend Short-Code Route

**Files:**
- Create: `apps/frontend/src/routes/$code.tsx`
- Modify: `apps/frontend/src/routeTree.gen.ts`
- Create: `apps/frontend/src/__tests__/phase2/public-redirect-route.test.tsx`

- [x] **Step 1: Write failing frontend route tests**

Create `apps/frontend/src/__tests__/phase2/public-redirect-route.test.tsx`:

```tsx
// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getRouter } from '../../router'

vi.mock('@tanstack/react-devtools', () => ({
  TanStackDevtools: () => null,
}))

vi.mock('@tanstack/react-router-devtools', () => ({
  TanStackRouterDevtoolsPanel: () => null,
}))

const originalLocation = window.location
const replaceMock = vi.fn()

function renderAt(initialEntry: string) {
  const history = createMemoryHistory({ initialEntries: [initialEntry] })
  const router = getRouter({ history })

  render(<RouterProvider router={router} />)

  return router
}

function mockJsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  )
}

describe('public frontend redirect route', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8000')
    vi.stubGlobal('fetch', vi.fn())
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, replace: replaceMock },
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    })
    cleanup()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    vi.clearAllMocks()
    replaceMock.mockReset()
  })

  it('calls backend redirect decision API and navigates for active code', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce(await mockJsonResponse({ location: 'https://example.com/docs' }))

    renderAt('/docs')

    expect(await screen.findByText(/redirecting/i)).not.toBeNull()
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/api/v1/redirect/docs', {
        credentials: 'include',
      })
      expect(replaceMock).toHaveBeenCalledWith('https://example.com/docs')
    })
  })

  it('shows not found for missing code', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce(
      await mockJsonResponse({ error: { code: 'not_found', message: 'Link not found' } }, 404),
    )

    renderAt('/missing')

    expect(await screen.findByRole('heading', { name: /link not found/i })).not.toBeNull()
    expect(replaceMock).not.toHaveBeenCalled()
  })

  it('shows unavailable for gone code', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce(
      await mockJsonResponse({ error: { code: 'gone', message: 'Link unavailable' } }, 410),
    )

    renderAt('/expired')

    expect(await screen.findByRole('heading', { name: /link unavailable/i })).not.toBeNull()
    expect(replaceMock).not.toHaveBeenCalled()
  })
})
```

- [x] **Step 2: Run frontend route test and confirm failure**

Run from `apps/frontend`:

```bash
bun test src/__tests__/phase2/public-redirect-route.test.tsx
```

Expected: FAIL because `/$code` route does not exist.

- [x] **Step 3: Implement frontend route**

Create `apps/frontend/src/routes/$code.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { ProductApiError, resolveRedirect } from '../lib/api-client'

export const Route = createFileRoute('/$code')({
  component: PublicRedirectPage,
})

type RedirectState = 'loading' | 'not-found' | 'gone' | 'error'

function PublicRedirectPage() {
  const { code } = Route.useParams()
  const [state, setState] = useState<RedirectState>('loading')

  useEffect(() => {
    let isCurrent = true

    async function resolveCode() {
      try {
        const decision = await resolveRedirect(code)

        if (isCurrent) {
          window.location.replace(decision.location)
        }
      } catch (caughtError) {
        if (!isCurrent) {
          return
        }

        if (caughtError instanceof ProductApiError && caughtError.status === 404) {
          setState('not-found')
          return
        }

        if (caughtError instanceof ProductApiError && caughtError.status === 410) {
          setState('gone')
          return
        }

        setState('error')
      }
    }

    void resolveCode()

    return () => {
      isCurrent = false
    }
  }, [code])

  if (state === 'not-found') {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-12">
        <section className="max-w-md rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Link not found</h1>
          <p className="mt-3 text-sm text-slate-600">This short link does not exist.</p>
        </section>
      </main>
    )
  }

  if (state === 'gone') {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-12">
        <section className="max-w-md rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Link unavailable</h1>
          <p className="mt-3 text-sm text-slate-600">This short link has expired or was disabled.</p>
        </section>
      </main>
    )
  }

  if (state === 'error') {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-12">
        <section className="max-w-md rounded-2xl border border-slate-200 p-8 text-center shadow-sm" role="alert">
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Redirect failed</h1>
          <p className="mt-3 text-sm text-slate-600">Could not resolve this short link. Try again.</p>
        </section>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <p className="text-sm font-medium text-slate-600">Redirecting...</p>
    </main>
  )
}
```

- [x] **Step 4: Regenerate route tree**

Run from `apps/frontend`:

```bash
bun run build
```

Expected: build may update `src/routeTree.gen.ts` to include `/$code`. If it does not, update `apps/frontend/src/routeTree.gen.ts` consistently with generated style:

```ts
import { Route as CodeRouteImport } from './routes/$code'
```

Add route update near other root children:

```ts
const CodeRoute = CodeRouteImport.update({
  id: '/$code',
  path: '/$code',
  getParentRoute: () => rootRouteImport,
} as any)
```

Add `CodeRoute` entries to `FileRoutesByFullPath`, `FileRoutesByTo`, `FileRoutesById`, `FileRouteTypes.fullPaths`, `FileRouteTypes.to`, `FileRouteTypes.id`, `RootRouteChildren`, `FileRoutesByPath`, and `rootRouteChildren` following existing generated format.

- [x] **Step 5: Run frontend route test and confirm pass**

Run from `apps/frontend`:

```bash
bun test src/__tests__/phase2/public-redirect-route.test.tsx
```

Expected: PASS.

---

### Task 6: v1 Documentation Updates

**Files:**
- Modify: `docs/v1/1-project-prd.md`
- Modify: `docs/v1/2-project-trd.md`
- Modify: `docs/v1/4-master-spec.md`

- [x] **Step 1: Update PRD public URL wording**

In `docs/v1/1-project-prd.md`, preserve canonical domain examples but clarify implementation ownership near section 2 or 7:

```md
Public short links are presented on the frontend public origin. The frontend owns the browser-facing `/:code` route and asks the backend redirect-decision API to resolve active links.
```

- [x] **Step 2: Update TRD architecture and redirect sections**

In `docs/v1/2-project-trd.md`, update section 4 architecture text and section 13 redirect flow so these statements are true:

```md
The browser-facing public short-link route is served by the frontend catch-all route. The backend owns redirect decision logic through `/api/v1/redirect/:code`, including link lookup, lifecycle checks, analytics insertion, and destination selection.
```

Replace API section redirect endpoint from:

```text
GET /:code
```

to:

```text
GET /api/v1/redirect/:code
```

Document response behavior:

```md
Active links return `200 OK` with `{ "location": "https://destination.example" }` to the frontend. The frontend then performs browser navigation to the destination. Missing or soft-deleted links return `404`; disabled, flagged, and expired links return `410`.
```

- [x] **Step 3: Update Master Spec redirect source of truth**

In `docs/v1/4-master-spec.md`, update MVP definition, system architecture, API endpoint table, and phase criteria so these statements are true:

```md
Visitors open `https://skrol.ink/:code` on the frontend public origin. The frontend catch-all route resolves the code through the backend `/api/v1/redirect/:code` endpoint and then navigates to the destination.
```

```md
The backend redirect decision path must remain small and dependency-light even though the browser-facing route lives in the frontend.
```

- [x] **Step 4: Inspect docs for stale backend public route wording**

Run from repo root:

```bash
bunx prettier --check docs/v1/1-project-prd.md docs/v1/2-project-trd.md docs/v1/4-master-spec.md
```

Expected: PASS or formatting warnings only for touched docs. If formatting fails, run:

```bash
bunx prettier --write docs/v1/1-project-prd.md docs/v1/2-project-trd.md docs/v1/4-master-spec.md
```

Then inspect remaining `GET /:code` references in docs manually and keep only references that describe the frontend public URL, not a backend endpoint.

---

### Task 7: Full Verification

**Files:**
- No edits expected.

- [x] **Step 1: Run targeted backend tests**

Run from `apps/backend`:

```bash
bun test src/__tests__/phase1/public-redirect-route.test.ts src/__tests__/phase2/config-auth-env.test.ts src/__tests__/phase2/links-api-routes.test.ts
```

Expected: PASS.

- [x] **Step 2: Run targeted frontend tests**

Run from `apps/frontend`:

```bash
bun test src/__tests__/phase2/api-client.test.ts src/__tests__/phase2/public-redirect-route.test.tsx src/__tests__/phase2/route-guard.test.tsx src/__tests__/phase2/links-pages.test.tsx
```

Expected: PASS.

- [x] **Step 3: Run type checks**

Run from repo root:

```bash
bun run check-types
```

Expected: PASS.

- [x] **Step 4: Run lint**

Run from repo root:

```bash
bun run lint
```

Expected: PASS.

- [x] **Step 5: Review diff**

Run from repo root:

```bash
git diff -- apps/backend/src/shared/config.ts apps/backend/src/modules/links/presentation/routes/links-api.routes.ts apps/backend/src/modules/redirect/presentation/routes/public-redirect-route.ts apps/frontend/src/lib/api-client.ts apps/frontend/src/routes/$code.tsx docs/v1/1-project-prd.md docs/v1/2-project-trd.md docs/v1/4-master-spec.md
```

Expected: diff only changes redirect-origin behavior, redirect decision API, frontend catch-all route, tests, route generation, and docs.

---

## Self-Review

- Spec coverage: plan covers frontend-origin short URLs, backend decision API, frontend catch-all navigation, 404/410 states, config, tests, and `docs/v1/` updates.
- Placeholder scan: no `TBD`, incomplete tasks, or deferred implementation steps.
- Type consistency: backend config field is `publicFrontendOrigin`; frontend helper is `resolveRedirect(code: string)`; redirect response type is `{ location: string }`; route param is `code`.
- Scope check: single cohesive change across redirect URL ownership; no unrelated refactor or new dependency.
