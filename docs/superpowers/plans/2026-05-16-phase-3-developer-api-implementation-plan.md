# Phase 3 Developer API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Phase 3 developer API support with Better Auth API keys, dashboard API key management, API-key-authenticated link CRUD, ownership checks, audit logging, and session-write origin protection.

**Architecture:** Better Auth owns API key lifecycle and schema; skrol exposes stable wrapper DTOs and never stores API keys in a skrol-owned table. Product API routes use a combined principal guard that checks bearer API keys before session cookies, then link use cases enforce ownership and write audit entries for mu tations.

**Tech Stack:** Bun, turbo, Elysia, Better Auth, `@better-auth/api-key`, Kysely, PostgreSQL, React, TanStack Router, Vitest, `bun:test`

---

## File Structure

Create these files:

- `apps/backend/src/modules/auth/application/api-key.service.ts` - skrol API key service interface, DTO mapping types, verification result types.
- `apps/backend/src/modules/auth/infrastructure/better-auth-api-key.service.ts` - Better Auth API Key plugin adapter and raw plugin shape isolation.
- `apps/backend/src/modules/auth/presentation/api-principal-guard.ts` - bearer-or-session product API guard.
- `apps/backend/src/modules/auth/presentation/session-write-origin-guard.ts` - strict Origin/Referer guard for session-authenticated writes.
- `apps/backend/src/modules/auth/presentation/routes/api-key-routes.ts` - skrol wrapper routes for API key create/list/revoke.
- `apps/backend/src/modules/links/application/update-link.use-case.ts` - link update rules, validation, audit write orchestration.
- `apps/backend/src/modules/links/application/delete-link.use-case.ts` - soft-delete orchestration and audit write.
- `apps/backend/src/__tests__/phase3/better-auth-api-key-schema.test.ts` - plugin/schema coverage.
- `apps/backend/src/__tests__/phase3/better-auth-api-key-adapter-discovery.test.ts` - installed plugin API shape discovery before wrapper wiring.
- `apps/backend/src/__tests__/phase3/api-principal-guard.test.ts` - auth priority and session-write origin tests.
- `apps/backend/src/__tests__/phase3/api-key-routes.test.ts` - wrapper contract and CSRF/origin tests.
- `apps/backend/src/__tests__/phase3/link-management-use-cases.test.ts` - update/delete use case tests.
- `apps/backend/src/__tests__/phase3/links-api-crud-routes.test.ts` - route-level CRUD and auth tests.
- `apps/frontend/src/routes/dashboard.api-keys.tsx` - API key dashboard page.
- `apps/frontend/src/__tests__/phase3/api-client.test.ts` - frontend API client tests.
- `apps/frontend/src/__tests__/phase3/api-keys-page.test.tsx` - API key page tests.
- `apps/frontend/src/__tests__/phase3/link-management-page.test.tsx` - link detail edit/delete tests.

Modify these files:

- `apps/backend/package.json`, `apps/frontend/package.json`, `bun.lock` - dependency changes through Bun only.
- `apps/backend/src/modules/auth/application/auth-principal.ts` - discriminated principal union.
- `apps/backend/src/modules/auth/infrastructure/better-auth.server.ts` - API Key plugin config.
- `apps/backend/src/index.ts` - wire API key service, wrapper routes, combined guards, new link use cases.
- `apps/backend/src/modules/links/application/links.repository.ts` - update/delete/audit contracts.
- `apps/backend/src/modules/links/infrastructure/repositories/links.repository.impl.ts` - Kysely mutation/audit methods.
- `apps/backend/src/modules/links/links.module.ts` - compose update/delete use cases.
- `apps/backend/src/modules/links/presentation/routes/links-api.routes.ts` - combined guard plus `PATCH`/`DELETE`.
- `apps/frontend/src/lib/auth-client.ts` - `apiKeyClient()` plugin.
- `apps/frontend/src/lib/api-client.ts` - API key and link management client methods.
- `apps/frontend/src/routes/dashboard.tsx` - API keys navigation.
- `apps/frontend/src/routes/dashboard.links.$id.tsx` - edit, disable/re-enable, delete controls.
- `apps/frontend/src/routeTree.gen.ts` - regenerate after route file creation.

---

## Task 1: Install API Key Plugin and Prove Schema Registration

**Files:**

- Modify: `apps/backend/package.json`
- Modify: `apps/frontend/package.json`
- Modify: `bun.lock`
- Modify: `apps/backend/src/modules/auth/infrastructure/better-auth.server.ts`
- Test: `apps/backend/src/__tests__/phase3/better-auth-api-key-schema.test.ts`

- [x] **Step 1: Add dependency through Bun**

Run from repo root:

```sh
bun --cwd apps/backend add @better-auth/api-key
bun --cwd apps/frontend add @better-auth/api-key
```

Expected: Bun updates both workspace `package.json` files and `bun.lock`. Do not hand-edit dependency versions.

- [x] **Step 2: Write failing plugin/schema test**

Create `apps/backend/src/__tests__/phase3/better-auth-api-key-schema.test.ts` with these assertions:

```ts
import { describe, expect, it } from "bun:test";
import { Pool } from "pg";
import { createBetterAuthConfig, inspectBetterAuthSchema } from "../../modules/auth/infrastructure/better-auth.server";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
	throw new Error("DATABASE_URL is required for Better Auth schema tests.");
}

describe("Better Auth API Key plugin", () => {
	it("registers API key plugin in auth config", async () => {
		const pool = new Pool({ connectionString: databaseUrl });
		try {
			const config = createBetterAuthConfig({ database: pool });

			expect(config.plugins?.length).toBeGreaterThan(0);
		} finally {
			await pool.end();
		}
	});

	it("includes API key table in generated schema plan", async () => {
		const pool = new Pool({ connectionString: databaseUrl });
		try {
			const schema = await inspectBetterAuthSchema({ database: pool });
			const plannedTables = schema.toBeCreated.map((entry) => entry.table);

			expect(plannedTables.some((table) => table.toLowerCase().includes("api") && table.toLowerCase().includes("key"))).toBe(true);
		} finally {
			await pool.end();
		}
	});
});
```

- [x] **Step 3: Run failing test**

Run from `apps/backend`:

```sh
bun test src/__tests__/phase3/better-auth-api-key-schema.test.ts
```

Expected: test fails because `createBetterAuthConfig({ database })` has empty `plugins` or `@better-auth/api-key` is not configured.

- [x] **Step 4: Configure Better Auth plugin**

Modify `apps/backend/src/modules/auth/infrastructure/better-auth.server.ts`:

```ts
import { apiKey } from "@better-auth/api-key";

// inside createBetterAuthConfig return object
plugins: [
	apiKey({
		defaultPrefix: "sk_live_",
	}),
],
```

Keep existing `emailAndPassword`, `trustedOrigins`, `database`, and user profile hook behavior unchanged.

- [x] **Step 5: Run schema test**

Run from `apps/backend`:

```sh
bun test src/__tests__/phase3/better-auth-api-key-schema.test.ts
```

Expected: PASS. Do not hard-code a speculative Better Auth table name; if schema output names differ, keep a plugin-backed assertion based on installed schema output.

- [x] **Step 6: Discover installed API Key plugin API before wrapper wiring**

Create `apps/backend/src/__tests__/phase3/better-auth-api-key-adapter-discovery.test.ts` with assertions against installed package types/runtime. This test is allowed to be adjusted to exact installed method names, but it must prove these facts before Task 2 implementation proceeds:

```ts
import { describe, expect, it } from "bun:test";
import { apiKey } from "@better-auth/api-key";

describe("Better Auth API Key plugin adapter discovery", () => {
	it("documents required API key operations before service wiring", () => {
		const plugin = apiKey({ defaultPrefix: "sk_live_" });
		const pluginText = JSON.stringify(plugin);

		expect(pluginText).toContain("api");
	});
});
```

Then inspect installed declarations under `node_modules/@better-auth/api-key` and record exact adapter decisions in this test or adjacent comments:

- create method name and response envelope, including one-time raw key field
- list method name and safe metadata fields
- verify method name and response envelope
- whether verify exposes API key ID; if not, define and test an alternate lookup strategy before using `actorApiKeyId`
- revoke support: disable/update behavior that preserves list metadata and can map to `revoked`; if only hard delete exists, stop and revise the spec before continuing

Run from `apps/backend`:

```sh
bun test src/__tests__/phase3/better-auth-api-key-adapter-discovery.test.ts
```

Expected: PASS only after exact installed API shape is documented. Do not continue to Task 2 with guessed method names or guessed response fields.

- [x] **Step 7: Commit task**

```sh
git add apps/backend/package.json apps/frontend/package.json bun.lock apps/backend/src/modules/auth/infrastructure/better-auth.server.ts apps/backend/src/__tests__/phase3/better-auth-api-key-schema.test.ts apps/backend/src/__tests__/phase3/better-auth-api-key-adapter-discovery.test.ts
git commit -m "feat: configure better auth api key plugin"
```

---

## Task 2: Add API Key Service, Combined Principal Guard, and Origin Guard

**Files:**

- Create: `apps/backend/src/modules/auth/application/api-key.service.ts`
- Create: `apps/backend/src/modules/auth/infrastructure/better-auth-api-key.service.ts`
- Create: `apps/backend/src/modules/auth/presentation/api-principal-guard.ts`
- Create: `apps/backend/src/modules/auth/presentation/session-write-origin-guard.ts`
- Modify: `apps/backend/src/modules/auth/application/auth-principal.ts`
- Test: `apps/backend/src/__tests__/phase3/api-principal-guard.test.ts`

- [x] **Step 1: Write failing guard tests**

Create `apps/backend/src/__tests__/phase3/api-principal-guard.test.ts` with these cases:

```ts
import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { apiError } from "../../shared/presentation/api-error";
import { requireApiPrincipal } from "../../modules/auth/presentation/api-principal-guard";
import { requireSameOriginForSessionWrite } from "../../modules/auth/presentation/session-write-origin-guard";

function appWithGuard(deps: Parameters<typeof requireApiPrincipal>[0]) {
	return new Elysia()
		.use(requireApiPrincipal(deps))
		.get("/protected", ({ authPrincipal }) => authPrincipal);
}

describe("requireApiPrincipal", () => {
	it("uses valid bearer API key before session fallback", async () => {
		const app = appWithGuard({
			apiKeyService: { verify: async () => ({ valid: true, userId: "user_1", apiKeyId: "key_1" }) },
			authSessionService: { resolveFromRequest: async () => ({ authSource: "session", userId: "user_2", sessionId: "session_1" }) },
		});

		const response = await app.handle(new Request("http://test/protected", { headers: { authorization: "Bearer sk_live_secret" } }));
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ authSource: "api-key", userId: "user_1", apiKeyId: "key_1" });
	});

	it("rejects invalid bearer without session fallback", async () => {
		const app = appWithGuard({
			apiKeyService: { verify: async () => ({ valid: false }) },
			authSessionService: { resolveFromRequest: async () => ({ authSource: "session", userId: "user_2", sessionId: "session_1" }) },
		});

		const response = await app.handle(new Request("http://test/protected", { headers: { authorization: "Bearer bad" } }));
		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ error: { code: "unauthorized", message: "Authentication is required." } });
	});

	it("falls back to session when no bearer header exists", async () => {
		const app = appWithGuard({
			apiKeyService: { verify: async () => ({ valid: false }) },
			authSessionService: { resolveFromRequest: async () => ({ authSource: "session", userId: "user_2", sessionId: "session_1" }) },
		});

		const response = await app.handle(new Request("http://test/protected"));
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ authSource: "session", userId: "user_2", sessionId: "session_1" });
	});
});

describe("requireSameOriginForSessionWrite", () => {
	it("rejects cross-origin session-authenticated writes", async () => {
		const app = new Elysia()
			.decorate("authPrincipal", { authSource: "session", userId: "user_1", sessionId: "session_1" } as const)
			.use(requireSameOriginForSessionWrite({ allowedOrigins: ["http://localhost:5173"] }))
			.post("/write", () => ({ ok: true }));

		const response = await app.handle(new Request("http://test/write", { method: "POST", headers: { origin: "https://evil.test" } }));
		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({ error: { code: "validation_error", message: "Invalid request origin." } });
	});

	it("does not require origin checks for bearer-authenticated writes", async () => {
		const app = new Elysia()
			.decorate("authPrincipal", { authSource: "api-key", userId: "user_1", apiKeyId: "key_1" } as const)
			.use(requireSameOriginForSessionWrite({ allowedOrigins: ["http://localhost:5173"] }))
			.post("/write", () => ({ ok: true }));

		const response = await app.handle(new Request("http://test/write", { method: "POST" }));
		expect(response.status).toBe(200);
	});
});
```

- [x] **Step 2: Run failing guard tests**

Run from `apps/backend`:

```sh
bun test src/__tests__/phase3/api-principal-guard.test.ts
```

Expected: FAIL because files/functions do not exist.

- [x] **Step 3: Define principal union**

Modify `apps/backend/src/modules/auth/application/auth-principal.ts`:

```ts
export type AuthPrincipal =
	| { authSource: "session"; userId: string; sessionId: string }
	| { authSource: "api-key"; userId: string; apiKeyId: string };

export const AUTH_PRINCIPAL_DECORATOR = "authPrincipal" as const;
```

- [x] **Step 4: Define API key service interface**

Create `apps/backend/src/modules/auth/application/api-key.service.ts`:

```ts
export type ApiKeyStatus = "active" | "revoked" | "expired";

export interface ApiKeyMetadataDto {
	id: string;
	name: string;
	prefix: string | null;
	created_at: string;
	last_used_at: string | null;
	expires_at: string | null;
	status: ApiKeyStatus;
}

export interface CreateApiKeyInput {
	userId: string;
	name: string;
	expiresInSeconds?: number;
}

export interface CreateApiKeyResult {
	key: string;
	apiKey: ApiKeyMetadataDto;
}

export type VerifyApiKeyResult =
	| { valid: true; userId: string; apiKeyId: string }
	| { valid: false };

export interface ApiKeyService {
	create(input: CreateApiKeyInput): Promise<CreateApiKeyResult>;
	list(userId: string): Promise<ApiKeyMetadataDto[]>;
	revoke(input: { userId: string; apiKeyId: string }): Promise<boolean>;
	verify(key: string): Promise<VerifyApiKeyResult>;
}
```

- [x] **Step 5: Implement Better Auth adapter skeleton**

Create `apps/backend/src/modules/auth/infrastructure/better-auth-api-key.service.ts`:

```ts
import type { ApiKeyMetadataDto, ApiKeyService, CreateApiKeyInput, CreateApiKeyResult, VerifyApiKeyResult } from "../application/api-key.service";

type BetterAuthApi = {
	createApiKey?: (input: unknown) => Promise<unknown>;
	listApiKeys?: (input: unknown) => Promise<unknown>;
	updateApiKey?: (input: unknown) => Promise<unknown>;
	deleteApiKey?: (input: unknown) => Promise<unknown>;
	verifyApiKey?: (input: unknown) => Promise<unknown>;
};

function toDateString(value: unknown): string | null {
	if (!value) return null;
	const date = value instanceof Date ? value : new Date(String(value));
	return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function mapStatus(record: Record<string, unknown>): ApiKeyMetadataDto["status"] {
	if (record.enabled === false || record.disabled === true) return "revoked";
	const expiresAt = toDateString(record.expiresAt ?? record.expires_at);
	if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) return "expired";
	return "active";
}

function mapMetadata(record: Record<string, unknown>): ApiKeyMetadataDto {
	return {
		id: String(record.id),
		name: String(record.name ?? ""),
		prefix: record.prefix ? String(record.prefix) : null,
		created_at: toDateString(record.createdAt ?? record.created_at) ?? new Date(0).toISOString(),
		last_used_at: toDateString(record.lastUsedAt ?? record.last_used_at),
		expires_at: toDateString(record.expiresAt ?? record.expires_at),
		status: mapStatus(record),
	};
}

export class BetterAuthApiKeyService implements ApiKeyService {
	constructor(private readonly api: BetterAuthApi) {}

	async create(input: CreateApiKeyInput): Promise<CreateApiKeyResult> {
		if (!this.api.createApiKey) throw new Error("Better Auth API key create method is unavailable.");
		const response = (await this.api.createApiKey({ body: { name: input.name, userId: input.userId, expiresIn: input.expiresInSeconds } })) as Record<string, unknown>;
		const result = (response.data ?? response) as Record<string, unknown>;
		const key = String(result.key ?? result.apiKey ?? "");
		const metadataSource = (result.metadata ?? result.record ?? result) as Record<string, unknown>;
		return { key, apiKey: mapMetadata(metadataSource) };
	}

	async list(userId: string): Promise<ApiKeyMetadataDto[]> {
		if (!this.api.listApiKeys) throw new Error("Better Auth API key list method is unavailable.");
		const response = (await this.api.listApiKeys({ query: { userId } })) as unknown;
		const result = (response as { data?: unknown }).data ?? response;
		const records = Array.isArray(result) ? result : Array.isArray((result as { apiKeys?: unknown }).apiKeys) ? (result as { apiKeys: unknown[] }).apiKeys : [];
		return records.map((record) => mapMetadata(record as Record<string, unknown>));
	}

	async revoke(input: { userId: string; apiKeyId: string }): Promise<boolean> {
		if (!this.api.updateApiKey) throw new Error("Better Auth API key disable method is unavailable.");
		await this.api.updateApiKey({ body: { keyId: input.apiKeyId, userId: input.userId, enabled: false } });
		return true;
	}

	async verify(key: string): Promise<VerifyApiKeyResult> {
		if (!this.api.verifyApiKey) return { valid: false };
		const response = (await this.api.verifyApiKey({ body: { key } })) as Record<string, unknown>;
		const result = (response.data ?? response) as Record<string, unknown>;
		if (result.valid !== true || !result.userId) return { valid: false };
		const apiKeyId = result.id ?? result.keyId ?? result.apiKeyId;
		if (!apiKeyId) throw new Error("Better Auth API key verify result does not expose an API key ID; add a tested lookup strategy before wiring audits.");
		return { valid: true, userId: String(result.userId), apiKeyId: String(apiKeyId) };
	}
}
```

During implementation, replace guessed method names with names proven by Task 1 Step 6. If no disable/update method exists, stop and ask for spec revision instead of hard-deleting keys. If verify does not return API key ID, add and test a lookup strategy before wiring audits or `createdViaApiKeyId`.

- [x] **Step 6: Implement combined guard**

Create `apps/backend/src/modules/auth/presentation/api-principal-guard.ts`:

```ts
import { Elysia } from "elysia";
import type { ApiKeyService } from "../application/api-key.service";
import type { AuthPrincipal } from "../application/auth-principal";
import type { AuthSessionService } from "../application/auth-session.service";
import { apiError } from "../../../shared/presentation/api-error";

export function requireApiPrincipal(deps: { apiKeyService: Pick<ApiKeyService, "verify">; authSessionService: AuthSessionService }) {
	return new Elysia({ name: "require-api-principal" })
		.decorate("authPrincipal", null as AuthPrincipal | null)
		.onBeforeHandle({ as: "scoped" }, async (context) => {
			const { request, set } = context;
			const authorization = request.headers.get("authorization") ?? "";
			if (authorization.startsWith("Bearer ")) {
				const key = authorization.slice("Bearer ".length).trim();
				const verified = key ? await deps.apiKeyService.verify(key) : { valid: false as const };
				if (verified.valid) {
					context.authPrincipal = { authSource: "api-key", userId: verified.userId, apiKeyId: verified.apiKeyId };
					return;
				}
				set.status = 401;
				return apiError(401, "unauthorized", "Authentication is required.");
			}

			const sessionPrincipal = await deps.authSessionService.resolveFromRequest(request);
			if (sessionPrincipal) {
				context.authPrincipal = sessionPrincipal;
				return;
			}

			set.status = 401;
			return apiError(401, "unauthorized", "Authentication is required.");
		});
}
```

- [x] **Step 7: Implement origin guard**

Create `apps/backend/src/modules/auth/presentation/session-write-origin-guard.ts`:

```ts
import { Elysia } from "elysia";
import { apiError } from "../../../shared/presentation/api-error";

const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

function originFromReferer(referer: string | null): string | null {
	if (!referer) return null;
	try {
		return new URL(referer).origin;
	} catch {
		return null;
	}
}

export function requireSameOriginForSessionWrite(deps: { allowedOrigins: string[] }) {
	const allowed = new Set(deps.allowedOrigins);
	return new Elysia({ name: "require-session-write-origin" }).onBeforeHandle(({ request, set, authPrincipal }) => {
		if (!WRITE_METHODS.has(request.method)) return;
		if (!authPrincipal || authPrincipal.authSource !== "session") return;

		const origin = request.headers.get("origin") ?? originFromReferer(request.headers.get("referer"));
		if (origin && allowed.has(origin)) return;

		set.status = 403;
		return apiError(403, "validation_error", "Invalid request origin.");
	});
}
```

- [x] **Step 8: Run guard tests**

Run from `apps/backend`:

```sh
bun test src/__tests__/phase3/api-principal-guard.test.ts
```

Expected: PASS.

- [x] **Step 9: Commit task**

```sh
git add apps/backend/src/modules/auth/application/auth-principal.ts apps/backend/src/modules/auth/application/api-key.service.ts apps/backend/src/modules/auth/infrastructure/better-auth-api-key.service.ts apps/backend/src/modules/auth/presentation/api-principal-guard.ts apps/backend/src/modules/auth/presentation/session-write-origin-guard.ts apps/backend/src/__tests__/phase3/api-principal-guard.test.ts
git commit -m "feat: add api principal guards"
```

---

## Task 3: Add Session-Only API Key Wrapper Routes

**Files:**

- Create: `apps/backend/src/modules/auth/presentation/routes/api-key-routes.ts`
- Modify: `apps/backend/src/index.ts`
- Test: `apps/backend/src/__tests__/phase3/api-key-routes.test.ts`

- [x] **Step 1: Write failing route tests**

Create `apps/backend/src/__tests__/phase3/api-key-routes.test.ts` with these assertions:

```ts
import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { apiKeyRoutes } from "../../modules/auth/presentation/routes/api-key-routes";

const sessionPrincipal = { authSource: "session" as const, userId: "user_1", sessionId: "session_1" };

function createApp() {
	const created: unknown[] = [];
	return new Elysia().use(
		apiKeyRoutes({
			allowedOrigins: ["http://localhost:5173"],
			authSessionService: { resolveFromRequest: async () => sessionPrincipal },
			apiKeyService: {
				verify: async () => ({ valid: false }),
				create: async (input) => {
					created.push(input);
					return { key: "sk_live_secret", apiKey: { id: "key_1", name: input.name, prefix: "sk_live_", created_at: "2026-05-16T00:00:00.000Z", last_used_at: null, expires_at: null, status: "active" } };
				},
				list: async () => [{ id: "key_1", name: "CI", prefix: "sk_live_", created_at: "2026-05-16T00:00:00.000Z", last_used_at: null, expires_at: null, status: "active" }],
				revoke: async () => true,
			},
		}),
	);
}

describe("api key wrapper routes", () => {
	it("creates key and returns raw key once with safe metadata", async () => {
		const response = await createApp().handle(new Request("http://test/api/v1/api-keys", { method: "POST", headers: { origin: "http://localhost:5173", "content-type": "application/json" }, body: JSON.stringify({ name: "CI", expires_in_seconds: 3600 }) }));
		expect(response.status).toBe(201);
		expect(await response.json()).toEqual({ key: "sk_live_secret", api_key: { id: "key_1", name: "CI", prefix: "sk_live_", created_at: "2026-05-16T00:00:00.000Z", last_used_at: null, expires_at: null, status: "active" } });
	});

	it("lists safe metadata without raw keys", async () => {
		const response = await createApp().handle(new Request("http://test/api/v1/api-keys"));
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ items: [{ id: "key_1", name: "CI", prefix: "sk_live_", created_at: "2026-05-16T00:00:00.000Z", last_used_at: null, expires_at: null, status: "active" }] });
	});

	it("revokes key through DELETE and returns 204", async () => {
		const response = await createApp().handle(new Request("http://test/api/v1/api-keys/key_1", { method: "DELETE", headers: { origin: "http://localhost:5173" } }));
		expect(response.status).toBe(204);
	});

	it("rejects cross-origin session writes", async () => {
		const response = await createApp().handle(new Request("http://test/api/v1/api-keys", { method: "POST", headers: { origin: "https://evil.test", "content-type": "application/json" }, body: JSON.stringify({ name: "CI" }) }));
		expect(response.status).toBe(403);
	});
});
```

- [x] **Step 2: Run failing route tests**

Run from `apps/backend`:

```sh
bun test src/__tests__/phase3/api-key-routes.test.ts
```

Expected: FAIL because route file does not exist.

- [x] **Step 3: Implement wrapper routes**

Create `apps/backend/src/modules/auth/presentation/routes/api-key-routes.ts`:

```ts
import { Elysia } from "elysia";
import type { ApiKeyService } from "../../application/api-key.service";
import type { AuthSessionService } from "../../application/auth-session.service";
import { requireSession } from "../session-guard";
import { requireSameOriginForSessionWrite } from "../session-write-origin-guard";
import { apiError } from "../../../../shared/presentation/api-error";

type CreateApiKeyRequest = {
	name: string;
	expires_in_seconds?: number;
};

function parseCreateBody(body: unknown): { name: string; expiresInSeconds?: number } | { error: true } {
	if (!body || typeof body !== "object") return { error: true };
	const record = body as Partial<CreateApiKeyRequest> & Record<string, unknown>;
	if (typeof record.name !== "string" || record.name.trim().length === 0) return { error: true };
	if ("expires_in" in record) return { error: true };
	if (record.expires_in_seconds !== undefined && (!Number.isInteger(record.expires_in_seconds) || record.expires_in_seconds <= 0)) return { error: true };
	return { name: record.name.trim(), expiresInSeconds: record.expires_in_seconds as number | undefined };
}

export function apiKeyRoutes(deps: { authSessionService: AuthSessionService; apiKeyService: ApiKeyService; allowedOrigins: string[] }) {
	return new Elysia({ name: "api-key-routes" })
		.group("/api/v1/api-keys", (app) =>
			app
				.use(requireSession({ resolveFromRequest: (request) => deps.authSessionService.resolveFromRequest(request) }))
				.use(requireSameOriginForSessionWrite({ allowedOrigins: deps.allowedOrigins }))
				.post("/", async ({ body, authPrincipal, set }) => {
					const parsed = parseCreateBody(body);
					if ("error" in parsed) return apiError(400, "validation_error", "Invalid API key request.");
					const created = await deps.apiKeyService.create({ userId: authPrincipal.userId, name: parsed.name, expiresInSeconds: parsed.expiresInSeconds });
					set.status = 201;
					return { key: created.key, api_key: created.apiKey };
				})
				.get("/", async ({ authPrincipal }) => ({ items: await deps.apiKeyService.list(authPrincipal.userId) }))
				.delete("/:id", async ({ params, authPrincipal, set }) => {
					const revoked = await deps.apiKeyService.revoke({ userId: authPrincipal.userId, apiKeyId: params.id });
					if (!revoked) return apiError(404, "not_found", "API key was not found.");
					set.status = 204;
				}),
		);
}
```

- [x] **Step 4: Wire route in app**

Modify `apps/backend/src/index.ts` to create `BetterAuthApiKeyService` from `betterAuthInstance.api`, pass `config.frontendOrigins`, and mount `apiKeyRoutes(...)` before link routes.

- [x] **Step 5: Run route tests**

Run from `apps/backend`:

```sh
bun test src/__tests__/phase3/api-key-routes.test.ts
```

Expected: PASS.

- [x] **Step 6: Commit task**

```sh
git add apps/backend/src/modules/auth/presentation/routes/api-key-routes.ts apps/backend/src/index.ts apps/backend/src/__tests__/phase3/api-key-routes.test.ts
git commit -m "feat: add api key wrapper routes"
```

---

## Task 4: Add Link Update/Delete Use Cases and Repository Methods

**Files:**

- Modify: `apps/backend/src/modules/links/application/links.repository.ts`
- Modify: `apps/backend/src/modules/links/infrastructure/repositories/links.repository.impl.ts`
- Create: `apps/backend/src/modules/links/application/update-link.use-case.ts`
- Create: `apps/backend/src/modules/links/application/delete-link.use-case.ts`
- Modify: `apps/backend/src/modules/links/links.module.ts`
- Test: `apps/backend/src/__tests__/phase3/link-management-use-cases.test.ts`

- [x] **Step 1: Write failing use case tests**

Create tests that assert:

- `UpdateLinkUseCase` returns `not_found` when `findByIdForOwner` returns null.
- Empty update body returns `validation_error`.
- Unknown status returns `validation_error`.
- Unsafe destination URL returns `unsafe_url`.
- Successful title/status update calls `updateLinkForOwner` and writes audit entries with `userId` and `actorApiKeyId`.
- `DeleteLinkUseCase` calls `softDeleteLinkForOwner`, writes soft-delete audit entry, returns success.

Use in-memory fake repository methods with arrays for `updates` and `auditLogs`.

- [x] **Step 2: Run failing use case tests**

Run from `apps/backend`:

```sh
bun test src/__tests__/phase3/link-management-use-cases.test.ts
```

Expected: FAIL because use cases and repository methods do not exist.

- [x] **Step 3: Extend repository contract**

Add to `apps/backend/src/modules/links/application/links.repository.ts`:

```ts
export interface UpdateLinkRepositoryInput {
	id: string;
	userId: string;
	title?: string | null;
	destinationUrl?: string;
	expiresAt?: Date | null;
	status?: "active" | "disabled";
	updatedAt: Date;
}

export interface CreateLinkAuditLogInput {
	linkId: string;
	userId: string;
	actorApiKeyId: string | null;
	action: string;
	previousValue: unknown;
	newValue: unknown;
	createdAt: Date;
}

export interface LinksRepository {
	// existing methods remain
	updateLinkForOwner(input: UpdateLinkRepositoryInput): Promise<Link | null>;
	softDeleteLinkForOwner(input: { id: string; userId: string; deletedAt: Date }): Promise<Link | null>;
	createAuditLog(input: CreateLinkAuditLogInput): Promise<void>;
}
```

- [x] **Step 4: Implement repository methods**

Modify `apps/backend/src/modules/links/infrastructure/repositories/links.repository.impl.ts`:

```ts
async updateLinkForOwner(input: UpdateLinkRepositoryInput): Promise<Link | null> {
	const patch: Updateable<Links> = { updatedAt: input.updatedAt };
	if ("title" in input) patch.title = input.title ?? null;
	if ("destinationUrl" in input) patch.destinationUrl = input.destinationUrl;
	if ("expiresAt" in input) patch.expiresAt = input.expiresAt ?? null;
	if ("status" in input) patch.status = input.status;

	const row = await this.db
		.updateTable("links")
		.set(patch)
		.where("id", "=", input.id)
		.where("userId", "=", input.userId)
		.where("deletedAt", "is", null)
		.returningAll()
		.executeTakeFirst();

	return row ? mapLinkRow(row) : null;
}

async softDeleteLinkForOwner(input: { id: string; userId: string; deletedAt: Date }): Promise<Link | null> {
	const row = await this.db
		.updateTable("links")
		.set({ status: "deleted", deletedAt: input.deletedAt, updatedAt: input.deletedAt })
		.where("id", "=", input.id)
		.where("userId", "=", input.userId)
		.where("deletedAt", "is", null)
		.returningAll()
		.executeTakeFirst();

	return row ? mapLinkRow(row) : null;
}

async createAuditLog(input: CreateLinkAuditLogInput): Promise<void> {
	await this.db.insertInto("linkAuditLogs").values({
		linkId: input.linkId,
		userId: input.userId,
		actorApiKeyId: input.actorApiKeyId,
		action: input.action,
		previousValue: JSON.stringify(input.previousValue),
		newValue: JSON.stringify(input.newValue),
		createdAt: input.createdAt,
	}).execute();
}
```

Use existing repository type imports for `Links`, `Updateable`, and row mapping names.
Database columns are `user_id` and `actor_api_key_id`; generated Kysely fields are `userId` and `actorApiKeyId`.

- [x] **Step 5: Implement update use case**

Create `apps/backend/src/modules/links/application/update-link.use-case.ts` with result codes `not_found`, `invalid_url`, `unsafe_url`, `validation_error`. Reuse `validateDestinationUrl`, `domainMatchesBlocklist`, and blocklist repository pattern from `create-link.use-case.ts`. Reject empty patch and status outside `active | disabled`. Audit each changed field with canonical ERD/Master actions: `title_changed`, `destination_url_changed`, `expiration_changed`, `link_disabled`, and `link_reenabled`. For status changes, choose `link_disabled` when new status is `disabled` and `link_reenabled` when new status is `active`.

- [x] **Step 6: Implement delete use case**

Create `apps/backend/src/modules/links/application/delete-link.use-case.ts` with result codes `not_found`. On success, write audit action `link_deleted` with previous status and new status `deleted`.

- [x] **Step 7: Wire links module**

Modify `apps/backend/src/modules/links/links.module.ts` to expose:

```ts
updateLinkUseCase: new UpdateLinkUseCase({ linksRepository, domainBlocklistRepository }),
deleteLinkUseCase: new DeleteLinkUseCase({ linksRepository }),
```

- [x] **Step 8: Run use case tests**

Run from `apps/backend`:

```sh
bun test src/__tests__/phase3/link-management-use-cases.test.ts
```

Expected: PASS.

- [x] **Step 9: Commit task**

```sh
git add apps/backend/src/modules/links/application/links.repository.ts apps/backend/src/modules/links/infrastructure/repositories/links.repository.impl.ts apps/backend/src/modules/links/application/update-link.use-case.ts apps/backend/src/modules/links/application/delete-link.use-case.ts apps/backend/src/modules/links/links.module.ts apps/backend/src/__tests__/phase3/link-management-use-cases.test.ts
git commit -m "feat: add link management use cases"
```

---

## Task 5: Add Product Link CRUD Routes with API Key Auth

**Files:**

- Modify: `apps/backend/src/modules/links/presentation/routes/links-api.routes.ts`
- Modify: `apps/backend/src/index.ts`
- Test: `apps/backend/src/__tests__/phase3/links-api-crud-routes.test.ts`

- [x] **Step 1: Write failing route tests**

Create tests that cover:

- `POST /api/v1/links` with bearer auth sets `actorApiKeyId` to API key ID and does not require Origin.
- Invalid bearer returns `401 unauthorized` and does not call session fallback.
- Session `POST /api/v1/links` with valid same-origin `Origin` succeeds.
- Session `POST /api/v1/links` with missing or cross-origin `Origin`/`Referer` returns `403 validation_error`.
- `PATCH /api/v1/links/:id` accepts `title`, `destination_url`, `expires_at`, `status` and returns link DTO.
- `PATCH` unknown field or empty body returns `400 validation_error`.
- `DELETE /api/v1/links/:id` returns `204`.
- Non-owned/missing update/delete maps to `404 not_found`.
- Existing list contract stays `limit` default 20/max 100, `cursor`, `{ items, nextCursor }`.

- [x] **Step 2: Run failing route tests**

Run from `apps/backend`:

```sh
bun test src/__tests__/phase3/links-api-crud-routes.test.ts
```

Expected: FAIL because routes still use session-only guard and lack `PATCH`/`DELETE`.

- [x] **Step 3: Switch route auth to combined guard**

Modify `apps/backend/src/modules/links/presentation/routes/links-api.routes.ts` route dependencies to include:

```ts
authSessionService: AuthSessionService;
apiKeyService: Pick<ApiKeyService, "verify">;
allowedOrigins: string[];
```

Replace `.use(requireSession(...))` with:

```ts
.use(requireApiPrincipal({ apiKeyService: deps.apiKeyService, authSessionService: deps.authSessionService }))
```

Apply `requireSameOriginForSessionWrite({ allowedOrigins: deps.allowedOrigins })` to write routes.

- [x] **Step 4: Preserve create/list/detail behavior**

Keep existing `POST`, `GET`, `GET/:id`, DTO fields, pagination default `20`, max `100`, `cursor`, and `{ items, nextCursor }`. Change create input to:

```ts
actorApiKeyId: authPrincipal.authSource === "api-key" ? authPrincipal.apiKeyId : null,
```

- [x] **Step 5: Add PATCH parsing and route**

Add parser that accepts only:

```ts
type UpdateLinkRequest = {
	title?: string | null;
	destination_url?: string;
	expires_at?: string | null;
	status?: "active" | "disabled";
};
```

Reject empty body, unknown fields, invalid timestamp, and invalid status with `400 validation_error`. Call `updateLinkUseCase.execute(...)`; map `not_found` to `404`, `invalid_url`/`unsafe_url`/`validation_error` to `400` with same code.

- [x] **Step 6: Add DELETE route**

Add `DELETE /api/v1/links/:id` that calls `deleteLinkUseCase.execute({ linkId: params.id, ownerUserId: authPrincipal.userId, actorApiKeyId })`. Return `204` on success and `404 not_found` when missing.

- [x] **Step 7: Wire app dependencies**

Modify `apps/backend/src/index.ts` to pass `apiKeyService`, `allowedOrigins: config.frontendOrigins`, and new links module use cases into `linksApiRoutes(...)`. Extend dependency types and lazy links module proxy to include `updateLinkUseCase` and `deleteLinkUseCase`.

- [x] **Step 8: Run route tests**

Run from `apps/backend`:

```sh
bun test src/__tests__/phase3/links-api-crud-routes.test.ts
```

Expected: PASS.

- [x] **Step 9: Run Phase 2 route regression tests**

Run from `apps/backend`:

```sh
bun test src/__tests__/phase2/links-api-routes.test.ts src/__tests__/phase2/session-guard.test.ts
```

Expected: PASS after updating any session write requests in `src/__tests__/phase2/links-api-routes.test.ts` to include a valid configured same-origin `Origin` header. Dashboard session-created link behavior remains intact, but strict session-write origin protection rejects missing `Origin`/`Referer`.

- [x] **Step 10: Commit task**

```sh
git add apps/backend/src/modules/links/presentation/routes/links-api.routes.ts apps/backend/src/index.ts apps/backend/src/__tests__/phase3/links-api-crud-routes.test.ts
git commit -m "feat: add api-authenticated link crud routes"
```

---

## Task 6: Add Frontend API Client and Auth Client Support

**Files:**

- Modify: `apps/frontend/src/lib/auth-client.ts`
- Modify: `apps/frontend/src/lib/api-client.ts`
- Test: `apps/frontend/src/__tests__/phase3/api-client.test.ts`

- [x] **Step 1: Write failing frontend client tests**

Create tests for:

- `createApiKey({ name: "CI", expires_in_seconds: 3600 })` posts to `/api/v1/api-keys` with credentials and returns `{ key, api_key }`.
- `listApiKeys()` gets `/api/v1/api-keys` with credentials.
- `deleteApiKey("key_1")` sends `DELETE /api/v1/api-keys/key_1` with credentials and accepts `204`.
- `updateLink("link_1", { status: "disabled" })` sends `PATCH /api/v1/links/link_1`.
- `deleteLink("link_1")` sends `DELETE /api/v1/links/link_1` and accepts `204`.

- [x] **Step 2: Run failing client tests**

Run from `apps/frontend`:

```sh
bunx vitest run src/__tests__/phase3/api-client.test.ts
```

Expected: FAIL because methods do not exist.

- [x] **Step 3: Add auth client plugin**

Modify `apps/frontend/src/lib/auth-client.ts`:

```ts
import { apiKeyClient } from "@better-auth/api-key/client";

export const authClient = createAuthClient({
	baseURL: import.meta.env.VITE_AUTH_BASE_URL || "http://localhost:8000",
	plugins: [apiKeyClient()],
});
```

- [x] **Step 4: Add API key and link management types/methods**

Modify `apps/frontend/src/lib/api-client.ts` to export:

```ts
export type ApiKeyMetadataDto = {
	id: string;
	name: string;
	prefix: string | null;
	created_at: string;
	last_used_at: string | null;
	expires_at: string | null;
	status: "active" | "revoked" | "expired";
};

export type CreateApiKeyInput = { name: string; expires_in_seconds?: number };
export type CreateApiKeyResponse = { key: string; api_key: ApiKeyMetadataDto };
export type ListApiKeysResponse = { items: ApiKeyMetadataDto[] };
export type UpdateLinkInput = { title?: string | null; destination_url?: string; expires_at?: string | null; status?: "active" | "disabled" };

export function createApiKey(input: CreateApiKeyInput) {
	return productFetch<CreateApiKeyResponse>("/api/v1/api-keys", { method: "POST", body: JSON.stringify(input) });
}

export function listApiKeys() {
	return productFetch<ListApiKeysResponse>("/api/v1/api-keys");
}

export function deleteApiKey(id: string) {
	return productFetch<void>(`/api/v1/api-keys/${id}`, { method: "DELETE" });
}

export function updateLink(id: string, input: UpdateLinkInput) {
	return productFetch<LinkDto>(`/api/v1/links/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteLink(id: string) {
	return productFetch<void>(`/api/v1/links/${id}`, { method: "DELETE" });
}
```

- [x] **Step 5: Run client tests**

Run from `apps/frontend`:

```sh
bunx vitest run src/__tests__/phase3/api-client.test.ts
```

Expected: PASS.

- [x] **Step 6: Commit task**

```sh
git add apps/frontend/src/lib/auth-client.ts apps/frontend/src/lib/api-client.ts apps/frontend/src/__tests__/phase3/api-client.test.ts
git commit -m "feat: add frontend api key client methods"
```

---

## Task 7: Add API Keys Dashboard Page and Navigation

**Files:**

- Create: `apps/frontend/src/routes/dashboard.api-keys.tsx`
- Modify: `apps/frontend/src/routes/dashboard.tsx`
- Modify: `apps/frontend/src/routeTree.gen.ts`
- Test: `apps/frontend/src/__tests__/phase3/api-keys-page.test.tsx`

- [x] **Step 1: Write failing page tests**

Create tests that mock `listApiKeys`, `createApiKey`, and `deleteApiKey`, then assert:

- Page renders table headers `Name`, `Prefix`, `Created`, `Last used`, `Expires`, `Status`, `Actions`.
- Create form calls `createApiKey` with `{ name, expires_in_seconds }` when expiration is supplied.
- Raw key panel appears with text `Copy this key now` and `For security, Skrol will not show the full key again.` after create.
- Revoke button asks confirmation and calls `deleteApiKey`.

- [x] **Step 2: Run failing page tests**

Run from `apps/frontend`:

```sh
bunx vitest run src/__tests__/phase3/api-keys-page.test.tsx
```

Expected: FAIL because route file does not exist.

- [x] **Step 3: Implement API keys page**

Create `apps/frontend/src/routes/dashboard.api-keys.tsx` with `createFileRoute("/dashboard/api-keys")`, `useEffect` loading `listApiKeys()`, form state for `name` and optional `expires_in_seconds`, one-time `createdKey` state, `navigator.clipboard.writeText(createdKey)` copy button, and table rendering safe metadata only.

Required visible copy:

```tsx
<h2>Copy this key now</h2>
<p>For security, Skrol will not show the full key again.</p>
```

- [x] **Step 4: Add dashboard nav**

Modify `apps/frontend/src/routes/dashboard.tsx` to include links to:

```tsx
<Link to="/dashboard/links">Links</Link>
<Link to="/dashboard/api-keys">API keys</Link>
```

Add an API keys card/link on dashboard home.

- [x] **Step 5: Regenerate route tree**

Run from `apps/frontend`:

```sh
bun run build
```

If build updates `src/routeTree.gen.ts`, keep generated changes. If build fails because route tree is stale and generator is separate, inspect existing package scripts and run project route generation command exposed by TanStack tooling.

- [x] **Step 6: Run page tests**

Run from `apps/frontend`:

```sh
bunx vitest run src/__tests__/phase3/api-keys-page.test.tsx
```

Expected: PASS.

- [x] **Step 7: Commit task**

```sh
git add apps/frontend/src/routes/dashboard.api-keys.tsx apps/frontend/src/routes/dashboard.tsx apps/frontend/src/routeTree.gen.ts apps/frontend/src/__tests__/phase3/api-keys-page.test.tsx
git commit -m "feat: add api keys dashboard page"
```

---

## Task 8: Add Link Detail Management Controls

**Files:**

- Modify: `apps/frontend/src/routes/dashboard.links.$id.tsx`
- Test: `apps/frontend/src/__tests__/phase3/link-management-page.test.tsx`

- [x] **Step 1: Write failing link management page tests**

Create tests that mock `getLink`, `updateLink`, and `deleteLink`, then assert:

- Existing link details still render after load.
- Editing title and destination calls `updateLink(id, { title, destination_url })`.
- Disable button calls `updateLink(id, { status: "disabled" })` when current status is active.
- Re-enable button calls `updateLink(id, { status: "active" })` when current status is disabled.
- Delete button asks confirmation and calls `deleteLink(id)`.

- [x] **Step 2: Run failing page tests**

Run from `apps/frontend`:

```sh
bunx vitest run src/__tests__/phase3/link-management-page.test.tsx
```

Expected: FAIL because controls do not exist.

- [x] **Step 3: Implement edit form and actions**

Modify `apps/frontend/src/routes/dashboard.links.$id.tsx`:

- Add controlled fields for `title`, `destination_url`, and `expires_at` seeded from loaded link.
- Add save handler that calls `updateLink(link.id, { title, destination_url, expires_at })`, updates local link state from response, and shows API errors through existing `ProductApiError` pattern.
- Add status toggle handler that sends `{ status: "disabled" }` or `{ status: "active" }`.
- Add delete handler with `window.confirm("Delete this link?")`, calls `deleteLink(link.id)`, then navigates to `/dashboard/links`.

- [x] **Step 4: Run page tests**

Run from `apps/frontend`:

```sh
bunx vitest run src/__tests__/phase3/link-management-page.test.tsx
```

Expected: PASS.

- [x] **Step 5: Commit task**

```sh
git add apps/frontend/src/routes/dashboard.links.\$id.tsx apps/frontend/src/__tests__/phase3/link-management-page.test.tsx
git commit -m "feat: add link management controls"
```

---

## Task 9: Run Schema, Types, and Full Verification

**Files:**

- Modify if generated: `apps/backend/src/shared/infrastructure/database/types.ts`
- Modify if generated: Better Auth migration files produced by `bun run auth:schema:generate`

- [x] **Step 1: Generate/apply Better Auth API key schema**

Run from `apps/backend`:

```sh
bun run auth:schema:generate
bun run auth:schema:migrate
```

Expected: Better Auth API key plugin schema exists in Better Auth-managed tables. No skrol-owned `api_keys` table is created.

- [x] **Step 2: Regenerate database types**

Run from `apps/backend`:

```sh
bun run db:typegen
bun run db:typecheck
```

Expected: generated types compile. Keep generated type changes if schema changed.

- [x] **Step 3: Run backend tests**

Run from `apps/backend`:

```sh
bun run test
```

Expected: PASS.

- [x] **Step 4: Run frontend tests**

Run from `apps/frontend`:

```sh
bun run test
```

Expected: PASS.

- [x] **Step 5: Run root verification**

Run from repo root:

```sh
bun run lint
bun run check-types
bun run build
bunx turbo run test --filter=backend
bunx turbo run test --filter=skrol-frontend
```

Expected: all commands PASS. Frontend package filter is `skrol-frontend`; do not use stale `--filter=frontend` examples unless package names change.

- [x] **Step 6: Inspect final diff for scope**

Run from repo root:

```sh
git status --short
git diff --stat
git diff -- docs/superpowers/specs/2026-05-16-phase-3-developer-api-design.md docs/superpowers/plans/2026-05-16-phase-3-developer-api-implementation-plan.md apps/backend apps/frontend packages
```

Expected: changes are limited to Phase 3 developer API implementation, generated schema/types, tests, spec, and plan.

- [x] **Step 7: Final commit**

```sh
git add docs/superpowers/specs/2026-05-16-phase-3-developer-api-design.md docs/superpowers/plans/2026-05-16-phase-3-developer-api-implementation-plan.md apps/backend apps/frontend bun.lock
git commit -m "feat: add phase 3 developer api"
```

---

## Self-Review Checklist

- Spec coverage: tasks cover Better Auth plugin/schema, API key wrappers, dashboard page, one-time raw key display, bearer verification, session fallback, link CRUD, ownership, audit logs, CSRF/origin protection, preserved pagination, DTO contracts, and verification.
- Error vocabulary: plan uses approved codes only: `unauthorized`, `not_found`, `alias_taken`, `reserved_alias`, `invalid_url`, `unsafe_url`, `validation_error`, `rate_limited`.
- API key deletion: plan uses Better Auth disable/update behavior through `revoke`; if plugin cannot disable keys, implementation must pause for spec revision.
- Better Auth adapter: plan requires installed API-shape discovery before wrapper wiring; guessed method names or missing API key ID in verify output must stop implementation until resolved.
- Dependency safety: plan installs `@better-auth/api-key` only through Bun.
- Verification: plan includes targeted tests, phase regression tests, backend/frontend full tests, lint, type check, build, and turbo tests.
