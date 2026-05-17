# Phase 4 Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Phase 4 analytics for link owners with privacy-safe aggregate API and dashboard panels, including prerequisite redirect metadata-capture fixes.

**Architecture:** Keep redirect write path lightweight and non-blocking, enrich stored click metadata without storing raw IP/full user-agent, then expose owner-scoped aggregate reads through `GET /api/v1/links/:id/analytics` and render dashboard link-detail analytics panels. Country breakdown remains optional; omit `countries` when country support is not implemented, return `countries: []` only when country support is implemented but no country rows exist.

**Tech Stack:** Bun, Elysia, Kysely, PostgreSQL, Better Auth guards/session, React, TanStack Router, Vitest, `bun:test`

---

## File Structure

Create these files:

- `apps/backend/src/modules/analytics/application/get-link-analytics.use-case.ts` - owner-scoped analytics orchestration and response mapping.
- `apps/backend/src/modules/analytics/presentation/routes/link-analytics.routes.ts` - `GET /api/v1/links/:id/analytics` route and auth wiring.
- `apps/backend/src/__tests__/phase4/get-link-analytics.use-case.test.ts` - use case and contract policy tests.
- `apps/backend/src/__tests__/phase4/link-analytics-route.test.ts` - endpoint auth/ownership/status tests.
- `apps/backend/src/__tests__/phase4/redirect-analytics-capture.test.ts` - redirect metadata-capture regression tests.
- `apps/frontend/src/__tests__/phase4/link-analytics-panel.test.tsx` - link-detail analytics UI states and country visibility tests.

Modify these files:

- `apps/backend/src/modules/analytics/application/analytics.repository.ts` - add aggregate read repository contract methods.
- `apps/backend/src/modules/analytics/infrastructure/repositories/analytics.repository.impl.ts` - implement aggregate SQL queries and deterministic sorting/null-labeling.
- `apps/backend/src/modules/analytics/analytics.module.ts` - wire repository + use case + route registration.
- `apps/backend/src/modules/redirect/application/resolve-redirect.use-case.ts` - metadata extraction patch for browser/os/device/is_bot with privacy constraints.
- `apps/backend/src/modules/redirect/application/click-event.repository.ts` - ensure click-event write input supports normalized dimensions.
- `apps/backend/src/modules/links/infrastructure/repositories/links.repository.impl.ts` - add read helper for existence/ownership/status if needed by analytics use case.
- `apps/backend/src/modules/links/application/links.repository.ts` - add read helper contract if needed.
- `apps/backend/src/index.ts` - register analytics route module.
- `apps/frontend/src/lib/api-client.ts` - add `getLinkAnalytics` client method and response types (snake_case).
- `apps/frontend/src/routes/dashboard.links.$id.tsx` - fetch and render analytics panels.

---

### Task 1: Lock Phase 4 Contract With Real Failing Use-Case Tests

**Files:**

- Create: `apps/backend/src/__tests__/phase4/get-link-analytics.use-case.test.ts`
- Modify: `apps/backend/src/modules/analytics/application/analytics.repository.ts`

- [x] **Step 1: Write failing use-case tests that call real production symbols**

```ts
import { describe, expect, it } from "bun:test";
import { GetLinkAnalyticsUseCase } from "../../modules/analytics/application/get-link-analytics.use-case";

describe("GetLinkAnalyticsUseCase", () => {
	it("returns snake_case analytics DTO for owned active link", async () => {
		const useCase = new GetLinkAnalyticsUseCase({
			linksRepository: {
				findOwnedLinkForRead: async () => ({
					id: "link_1",
					userId: "user_1",
					deletedAt: null,
				}),
			},
			analyticsRepository: {
				getTotalClicks: async () => 3,
				getClicksOverTime: async () => [
					{ bucket_start: "2026-05-01T00:00:00.000Z", clicks: 1 },
					{ bucket_start: "2026-05-02T00:00:00.000Z", clicks: 0 },
					{ bucket_start: "2026-05-03T00:00:00.000Z", clicks: 2 },
				],
				getTopReferrers: async () => [{ referrer_domain: "direct", clicks: 2 }],
				getTopBrowsers: async () => [{ browser: "unknown", clicks: 2 }],
				getDevices: async () => [{ device: "desktop", clicks: 3 }],
			},
			clock: { now: () => new Date("2026-05-16T12:00:00.000Z") },
			countryAnalyticsEnabled: false,
		});

		const result = await useCase.execute({
			principalUserId: "user_1",
			linkId: "link_1",
		});

		expect(result.kind).toBe("ok");
		if (result.kind !== "ok") return;

		expect(result.data).toEqual({
			link_id: "link_1",
			total_clicks: 3,
			clicks_over_time: [
				{ bucket_start: "2026-05-01T00:00:00.000Z", clicks: 1 },
				{ bucket_start: "2026-05-02T00:00:00.000Z", clicks: 0 },
				{ bucket_start: "2026-05-03T00:00:00.000Z", clicks: 2 },
			],
			referrers: [{ referrer_domain: "direct", clicks: 2 }],
			browsers: [{ browser: "unknown", clicks: 2 }],
			devices: [{ device: "desktop", clicks: 3 }],
		});

		expect("countries" in result.data).toBe(false);
	});
});
```

- [x] **Step 2: Run test to verify failure**

Run from `apps/backend`:

```sh
bun test src/__tests__/phase4/get-link-analytics.use-case.test.ts
```

Expected: FAIL because `GetLinkAnalyticsUseCase` and/or constructor contracts do not exist yet.

- [x] **Step 3: Add analytics repository contract methods**

```ts
export interface AnalyticsRepository {
	getTotalClicks(input: { linkId: string }): Promise<number>;
	getClicksOverTime(input: {
		linkId: string;
		startInclusiveUtc: Date;
		endExclusiveUtc: Date;
	}): Promise<Array<{ bucket_start: string; clicks: number }>>;
	getTopReferrers(input: {
		linkId: string;
		limit: number;
	}): Promise<Array<{ referrer_domain: string; clicks: number }>>;
	getTopBrowsers(input: {
		linkId: string;
		limit: number;
	}): Promise<Array<{ browser: string; clicks: number }>>;
	getDevices(input: {
		linkId: string;
	}): Promise<Array<{ device: string; clicks: number }>>;
	getTopCountries?(input: {
		linkId: string;
		limit: number;
	}): Promise<Array<{ country: string; clicks: number }>>;
}
```

- [x] **Step 4: Re-run test for compilation progress**

Run:

```sh
bun test src/__tests__/phase4/get-link-analytics.use-case.test.ts
```

Expected: still FAIL, now closer (missing use case implementation).

- [x] **Step 5: Commit task**

```sh
git add apps/backend/src/__tests__/phase4/get-link-analytics.use-case.test.ts apps/backend/src/modules/analytics/application/analytics.repository.ts
git commit -m "test: lock phase 4 analytics contract"
```

---

### Task 2: Implement Redirect Metadata-Capture Prerequisite Patch

**Files:**

- Create: `apps/backend/src/__tests__/phase4/redirect-analytics-capture.test.ts`
- Modify: `apps/backend/src/modules/redirect/application/resolve-redirect.use-case.ts`
- Modify: `apps/backend/src/modules/redirect/application/click-event.repository.ts`

- [x] **Step 1: Write failing redirect capture regression tests**

```ts
import { describe, expect, it } from "bun:test";

describe("redirect analytics capture", () => {
	it("captures normalized metadata via real resolve use case call", async () => {
		// arrange resolve use case with fake lookup returning active link and
		// click-event repository spy to inspect persisted payload
		// act: execute resolve with referer + user-agent headers
		// assert: referrerDomain/browser/os/device/isBot normalized, country null
	});

	it("preserves existing successful redirect-decision behavior when analytics write fails", async () => {
		// arrange click-event repository to throw
		// act: execute resolve
		// assert: result still success and status semantics match current Phase 1 implementation
	});
});
```

- [x] **Step 2: Run test to verify failure**

Run:

```sh
bun test src/__tests__/phase4/redirect-analytics-capture.test.ts
```

Expected: FAIL until redirect use case is invoked and assertions inspect real behavior.

- [x] **Step 3: Patch redirect metadata extraction minimally**

```ts
function normalizeNullableLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// inside analytics write input mapping
browser: normalizeNullableLabel(detected.browserFamily),
os: normalizeNullableLabel(detected.osFamily),
device: normalizeNullableLabel(detected.deviceFamily),
country: null,
isBot: detected.isBot,
```

Keep rule: do not store full user-agent or raw IP.

- [x] **Step 4: Re-run redirect route tests and new phase4 test**

Run:

```sh
bun test src/__tests__/phase1/public-redirect-route.test.ts src/__tests__/phase4/redirect-analytics-capture.test.ts
```

Expected: PASS and existing successful redirect-decision behavior preserved.

- [x] **Step 5: Commit task**

```sh
git add apps/backend/src/__tests__/phase4/redirect-analytics-capture.test.ts apps/backend/src/modules/redirect/application/resolve-redirect.use-case.ts apps/backend/src/modules/redirect/application/click-event.repository.ts
git commit -m "fix: enrich redirect analytics metadata safely"
```

---

### Task 3: Implement Backend Aggregate Repository + Use Case

**Files:**

- Create: `apps/backend/src/modules/analytics/application/get-link-analytics.use-case.ts`
- Modify: `apps/backend/src/modules/analytics/infrastructure/repositories/analytics.repository.impl.ts`
- Modify: `apps/backend/src/modules/analytics/analytics.module.ts`
- Modify: `apps/backend/src/modules/links/application/links.repository.ts`
- Modify: `apps/backend/src/modules/links/infrastructure/repositories/links.repository.impl.ts`
- Modify: `apps/backend/src/__tests__/phase4/get-link-analytics.use-case.test.ts`

- [x] **Step 1: Expand failing tests for time-series and breakdown policy**

```ts
it("passes deterministic last-30-day UTC window to repository", async () => {
	let capturedInput: {
		linkId: string;
		startInclusiveUtc: Date;
		endExclusiveUtc: Date;
	} | null = null;

	const useCase = new GetLinkAnalyticsUseCase({
		linksRepository: {
			findOwnedLinkForRead: async () => ({ id: "link_1", deletedAt: null }),
		},
		analyticsRepository: {
			getTotalClicks: async () => 0,
			getClicksOverTime: async (input) => {
				capturedInput = input;
				return [];
			},
			getTopReferrers: async () => [],
			getTopBrowsers: async () => [],
			getDevices: async () => [],
		},
		clock: { now: () => new Date("2026-05-16T12:00:00.000Z") },
		countryAnalyticsEnabled: false,
	});

	await useCase.execute({ principalUserId: "user_1", linkId: "link_1" });

	expect(capturedInput).toEqual({
		linkId: "link_1",
		startInclusiveUtc: new Date("2026-04-17T00:00:00.000Z"),
		endExclusiveUtc: new Date("2026-05-17T00:00:00.000Z"),
	});
});

it("maps null dimensions to direct/unknown via real mapper/repository behavior", async () => {
	// call real mapper function or repository row-mapping helper
	// assert null referrer => direct and null browser/device => unknown
});
```

- [x] **Step 2: Run tests to verify failure**

```sh
bun test src/__tests__/phase4/get-link-analytics.use-case.test.ts
```

Expected: FAIL until use case/repository implementation exists.

- [x] **Step 3: Implement use case with injected clock and owner/deleted checks**

```ts
export class GetLinkAnalyticsUseCase {
	constructor(
		private readonly deps: {
			linksRepository: {
				findOwnedLinkForRead(input: {
					userId: string;
					linkId: string;
				}): Promise<{ id: string; deletedAt: Date | null } | null>;
			};
			analyticsRepository: AnalyticsRepository;
			clock: { now(): Date };
			countryAnalyticsEnabled: boolean;
		},
	) {}

	async execute(input: { principalUserId: string; linkId: string }) {
		const link = await this.deps.linksRepository.findOwnedLinkForRead({
			userId: input.principalUserId,
			linkId: input.linkId,
		});

		if (!link || link.deletedAt) {
			return { kind: "not_found" } as const;
		}

		// use deps.clock.now() to build deterministic last-30-day window
		// aggregate load and mapping to snake_case DTO
		return {
			kind: "ok",
			data: {
				/* ... */
			},
		} as const;
	}
}
```

- [x] **Step 4: Implement aggregate SQL queries with deterministic policies**

```ts
// examples inside repository impl
// - top 20 referrers/browsers/countries by count desc then label asc
// - devices grouped across known categories
// - clicks_over_time daily UTC buckets for last 30 days with zero-fill
// - null label mapping: direct/unknown
```

Ensure:

- include bot-classified events (no filtering)
- omit `countries` in DTO when country support is not implemented
- return `countries: []` only when country support is implemented but no country rows exist
- device aggregation behavior explicit: return categories present in stored events (not synthetic zero-count categories)

- [x] **Step 5: Run focused tests**

```sh
bun test src/__tests__/phase4/get-link-analytics.use-case.test.ts
```

Expected: PASS.

- [x] **Step 6: Commit task**

```sh
git add apps/backend/src/modules/analytics/application/get-link-analytics.use-case.ts apps/backend/src/modules/analytics/infrastructure/repositories/analytics.repository.impl.ts apps/backend/src/modules/analytics/analytics.module.ts apps/backend/src/modules/links/application/links.repository.ts apps/backend/src/modules/links/infrastructure/repositories/links.repository.impl.ts apps/backend/src/__tests__/phase4/get-link-analytics.use-case.test.ts
git commit -m "feat: add link analytics aggregate use case"
```

---

### Task 4: Add Analytics API Route and Endpoint Tests

**Files:**

- Create: `apps/backend/src/modules/analytics/presentation/routes/link-analytics.routes.ts`
- Create: `apps/backend/src/__tests__/phase4/link-analytics-route.test.ts`
- Modify: `apps/backend/src/index.ts`

- [x] **Step 1: Write failing route tests using actual analytics route module**

```ts
import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";

describe("GET /api/v1/links/:id/analytics", () => {
	it("returns 401 without valid auth", async () => {
		const app = buildTestAppWithAnalyticsRoute({
			authPrincipal: null,
			getLinkAnalyticsResult: { kind: "not_found" },
		});
		const response = await app.handle(
			new Request("http://localhost/api/v1/links/link_1/analytics"),
		);
		expect(response.status).toBe(401);
	});

	it("returns 404 for unknown link", async () => {
		// build test app with injected use-case result { kind: "not_found" }
		// assert response.status === 404
	});

	it("returns 404 for non-owner link", async () => {
		// arrange principal + repo fixture for cross-user link
		// assert response.status === 404
	});

	it("returns 404 for soft-deleted owned link", async () => {
		// arrange owned link with deletedAt != null
		// assert response.status === 404
	});

	it("returns aggregate payload for owned active link", async () => {
		// assert response.status === 200 and envelope { data: ... }
	});
});
```

`buildTestAppWithAnalyticsRoute(...)` must mount real `link-analytics.routes.ts` handlers with fake injectable dependencies. Do not test an empty app.

- [x] **Step 2: Run tests to verify failure**

```sh
bun test src/__tests__/phase4/link-analytics-route.test.ts
```

Expected: FAIL until route is added and wired.

- [x] **Step 3: Implement route and wire module**

```ts
app.get("/api/v1/links/:id/analytics", async ({ params, authPrincipal }) => {
	const result = await getLinkAnalyticsUseCase.execute({
		principalUserId: authPrincipal.userId,
		linkId: params.id,
	});

	if (result.kind === "not_found")
		return apiError("not_found", "Link not found.", 404);

	return { data: result.data };
});
```

Keep existing error envelope conventions.
The route must use same principal-resolution path as existing link routes and support both dashboard session auth and API-key auth where existing link routes do.

- [x] **Step 4: Run route and nearby integration tests**

```sh
bun test src/__tests__/phase4/link-analytics-route.test.ts src/__tests__/phase3/links-api-crud-routes.test.ts
```

Expected: PASS and no Phase 3 route regressions.

- [x] **Step 5: Commit task**

```sh
git add apps/backend/src/modules/analytics/presentation/routes/link-analytics.routes.ts apps/backend/src/index.ts apps/backend/src/__tests__/phase4/link-analytics-route.test.ts
git commit -m "feat: expose link analytics api endpoint"
```

---

### Task 5: Add Frontend API Client + Link Detail Analytics Panels

**Files:**

- Modify: `apps/frontend/src/lib/api-client.ts`
- Modify: `apps/frontend/src/routes/dashboard.links.$id.tsx`
- Create: `apps/frontend/src/__tests__/phase4/link-analytics-panel.test.tsx`

- [x] **Step 1: Write failing frontend tests by rendering real link-detail analytics UI**

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LinkAnalyticsPanels } from "../../routes/dashboard.links.$id";

describe("link detail analytics panels", () => {
	it("shows loading then aggregate panels", async () => {
		render(<LinkAnalyticsPanels status="loading" analytics={null} />);
		expect(screen.getByText("Loading analytics...")).toBeTruthy();
	});

	it("shows empty analytics state when totals are zero", async () => {
		render(
			<LinkAnalyticsPanels
				status="ready"
				analytics={{
					link_id: "link_1",
					total_clicks: 0,
					clicks_over_time: [],
					referrers: [],
					browsers: [],
					devices: [],
				}}
			/>,
		);
		expect(screen.getByText("No clicks recorded yet")).toBeTruthy();
	});

	it("hides country panel when countries field omitted", async () => {
		render(
			<LinkAnalyticsPanels
				status="ready"
				analytics={{
					link_id: "link_1",
					total_clicks: 0,
					clicks_over_time: [],
					referrers: [],
					browsers: [],
					devices: [],
				}}
			/>,
		);
		expect(screen.getByText("Total clicks")).toBeTruthy();
		expect(screen.queryByText("Countries")).toBeNull();
	});

	it("shows country panel when countries is present", async () => {
		render(
			<LinkAnalyticsPanels
				status="ready"
				analytics={{
					link_id: "link_1",
					total_clicks: 1,
					clicks_over_time: [],
					referrers: [],
					browsers: [],
					devices: [],
					countries: [],
				}}
			/>,
		);
		expect(screen.getByText("Countries")).toBeTruthy();
	});
});
```

Do not render static placeholder `<div>` nodes for behavior assertions. Tests must render real route component or extracted real analytics panel component and assert UI output from mocked API data.

- [x] **Step 2: Run tests to verify failure**

Run from `apps/frontend`:

```sh
bun test src/__tests__/phase4/link-analytics-panel.test.tsx
```

Expected: FAIL until UI/client integration is added.

- [x] **Step 3: Implement client and route integration**

```ts
export type LinkAnalyticsResponse = {
	data: {
		link_id: string;
		total_clicks: number;
		clicks_over_time: Array<{ bucket_start: string; clicks: number }>;
		referrers: Array<{ referrer_domain: string; clicks: number }>;
		browsers: Array<{ browser: string; clicks: number }>;
		devices: Array<{ device: string; clicks: number }>;
		countries?: Array<{ country: string; clicks: number }>;
	};
};
```

Route behavior:

- request analytics for current link id
- render total/time/referrer/browser/device panels
- render country panel only when `countries` exists

- [x] **Step 4: Run frontend tests**

```sh
bun test src/__tests__/phase4/link-analytics-panel.test.tsx src/__tests__/phase3/link-management-page.test.tsx
```

Expected: PASS and no Phase 3 link-detail regression.

- [x] **Step 5: Commit task**

```sh
git add apps/frontend/src/lib/api-client.ts 'apps/frontend/src/routes/dashboard.links.$id.tsx' apps/frontend/src/__tests__/phase4/link-analytics-panel.test.tsx
git commit -m "feat: add dashboard link analytics panels"
```

---

### Task 6: Full Verification and Acceptance Mapping

**Files:**

- Modify: `apps/backend/src/__tests__/phase4/get-link-analytics.use-case.test.ts`
- Modify: `apps/backend/src/__tests__/phase4/link-analytics-route.test.ts`
- Modify: `apps/backend/src/__tests__/phase4/redirect-analytics-capture.test.ts`
- Modify: `apps/frontend/src/__tests__/phase4/link-analytics-panel.test.tsx`

- [x] **Step 1: Add explicit assertions for every Phase 4 acceptance criterion**

```ts
// backend + frontend assertions must explicitly prove:
// - total clicks
// - clicks over time
// - referrer breakdown
// - browser/device breakdown
// - country appears only when implemented
// - no raw IP/full UA persisted
```

- [x] **Step 2: Run backend Phase 4 suite**

Run from `apps/backend`:

```sh
bun test src/__tests__/phase4/*.test.ts
```

Expected: PASS.

- [x] **Step 3: Run frontend Phase 4 suite**

Run from `apps/frontend`:

```sh
bun test src/__tests__/phase4/*.test.tsx
```

Expected: PASS.

- [x] **Step 4: Run targeted cross-phase regression checks**

Run from repo root:

```sh
bunx turbo run test --filter=backend --filter=frontend
```

Expected: PASS in both workspaces.

- [ ] **Step 5: Commit task**

```sh
git add apps/backend/src/__tests__/phase4/get-link-analytics.use-case.test.ts apps/backend/src/__tests__/phase4/link-analytics-route.test.ts apps/backend/src/__tests__/phase4/redirect-analytics-capture.test.ts apps/frontend/src/__tests__/phase4/link-analytics-panel.test.tsx
git commit -m "test: finalize phase 4 analytics acceptance coverage"
```

---

## Plan Self-Review

- Spec coverage: includes endpoint, dashboard panels, optional country behavior, bot-policy handling, ownership, deleted-link `404`, redirect non-blocking write invariants, privacy constraints.
- Placeholder scan: remaining pseudocode exists only in test-arrangement examples; implementation agent must replace them with real route/use-case/component calls before marking each task complete.
- Type consistency: snake_case contract used consistently in API and frontend DTOs; country optionality explicitly defined.
