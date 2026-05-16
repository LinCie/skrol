# Phase 3 Design: Developer API

Date: 2026-05-16  
Project: skrol  
Phase: 3 (Developer API)  
Status: Revised after spec review; ready for implementation planning

## 1. Goal and Scope

Phase 3 makes the REST API fully usable by developers while preserving dashboard behavior built in Phase 2.

In scope:

- Better Auth API Key plugin installation
- Better Auth API Key plugin schema generation/application
- API key creation, listing, and revocation through Better Auth
- skrol wrapper routes for API key management:
  - `POST /api/v1/api-keys`
  - `GET /api/v1/api-keys`
  - `DELETE /api/v1/api-keys/:id`
- `/dashboard/api-keys` UI
- one-time raw API key display after creation
- API key verification middleware for skrol product API routes
- session fallback for dashboard-originated product API calls
- link management endpoints:
  - `POST /api/v1/links`
  - `GET /api/v1/links`
  - `GET /api/v1/links/:id`
  - `PATCH /api/v1/links/:id`
  - `DELETE /api/v1/links/:id`
- ownership checks on all link endpoints
- consistent product API error envelope
- link update/delete audit logging

Out of scope:

- skrol-owned API key storage table
- API key self-management using API key auth
- alias/code editing after link creation
- audit log read API
- analytics expansion
- admin abuse-control UI

## 2. Governing Decisions

Source-of-truth references:

- product scope and non-goals: `docs/v1/1-project-prd.md`
- technical behavior: `docs/v1/2-project-trd.md`
- schema boundaries: `docs/v1/3-project-erd.md`
- phase deliverables and acceptance: `docs/v1/4-master-spec.md`
- API key UI copy and layout guidance: `docs/v1/5-design-system.md`

Required decisions for this phase:

1. Better Auth API Key plugin owns API key lifecycle and schema.
2. skrol does not create a separate `api_keys` table.
3. Dashboard session auth remains valid for `/api/v1/links*` so existing frontend calls keep working.
4. `/api/v1/links*` accepts either `Authorization: Bearer <api-key>` or dashboard session cookie.
5. If a bearer header is present, bearer verification takes priority over session fallback.
6. An invalid bearer header returns `401` immediately, even if session cookies are also present.
7. API key wrapper routes require dashboard session auth only.
8. Link list pagination preserves current Phase 2 API contract: `limit` default `20`, max `100`, optional `cursor`, response `{ items, nextCursor }`.
9. `DELETE /api/v1/links/:id` soft-deletes links and returns `204`.
10. Session-authenticated product API writes require CSRF protection or strict same-origin validation.
11. API key wrapper `DELETE` means revoke by disabling the Better Auth API key, not hard-delete.
12. Wrapper routes expose skrol DTOs only; Better Auth raw objects do not leak through wrapper responses.

Pagination note:

- This Phase 3 spec intentionally preserves the implemented Phase 2 pagination contract even if older planning documents mention `after` or default `25`.

## 3. Recommended Approach

Use thin Better Auth plugin integration plus skrol wrappers.

Implementation direction:

- install `@better-auth/api-key` in backend and frontend with Bun
- configure Better Auth server with `apiKey(...)`
- configure frontend `authClient` with `apiKeyClient()` only where useful for typed plugin access
- expose skrol product wrapper routes for API key management
- add a combined product API auth guard for session or API key principals
- extend existing links module with update/delete use cases and repository operations

This approach matches PRD/TRD/ERD requirements, preserves current dashboard session behavior, and avoids unnecessary skrol-owned API key persistence.

Rejected alternatives:

- Native Better Auth API key routes only: less backend code, but fails wrapper-route scope and couples UI to Better Auth response shapes.
- skrol-owned API key abstraction/table: more control, but conflicts with ERD unless plugin cannot satisfy MVP.

## 4. Backend Auth Design

### 4.1 Better Auth API Key Plugin

Backend adds API Key plugin to existing Better Auth config in `apps/backend/src/modules/auth/infrastructure/better-auth.server.ts`.

Target behavior:

- API keys use the closest plugin-supported form of `sk_live_<secret>`.
- Raw keys are never stored by skrol.
- API key hash, expiration, disabled/revoked state, metadata, and verification are handled by Better Auth.
- Plugin schema is generated/applied through existing auth schema workflow.

The exact plugin return shapes must be verified during implementation against installed `@better-auth/api-key` types and tests.

Discovery requirements before wrapper wiring:

- verify create/list/verify/revoke method names from installed package declarations
- verify whether plugin methods return a `{ data: ... }` envelope or direct records
- verify whether API key verification exposes an API key ID; if not, add a tested lookup strategy before storing `created_via_api_key_id` or `actor_api_key_id`
- verify revocation can disable a key while preserving metadata for list status; if only hard delete is available, stop and revise this spec before continuing

### 4.2 Auth Principal

`AuthPrincipal` becomes a discriminated union:

```ts
type AuthPrincipal =
	| { authSource: "session"; userId: string; sessionId: string }
	| { authSource: "api-key"; userId: string; apiKeyId: string };
```

Session-only code keeps using `authSource: "session"`. Product API code checks `authSource` when it needs `apiKeyId` for audit or `created_via_api_key_id`.

### 4.3 Guards

Keep existing `requireSession` for dashboard-only or session-only routes.

Add a product API guard, likely `requireApiPrincipal`, with this order:

1. Read `Authorization` header.
2. If header starts with `Bearer `, verify that key with Better Auth plugin.
3. If key is valid, attach `{ authSource: "api-key", userId, apiKeyId }`.
4. If bearer header exists but key is missing, invalid, expired, disabled, or revoked/deleted, return `401` with product error envelope.
5. If no bearer header exists, fall back to session resolution.
6. If session is valid, attach `{ authSource: "session", userId, sessionId }`.
7. If neither credential type is valid, return `401` with product error envelope.

Bearer priority prevents an accidental browser session from masking broken developer API credentials.

Implementation should follow the current Elysia guard pattern used by `session-guard.ts`: declare `authPrincipal` with `decorate(...)`, then assign or return errors from `onBeforeHandle({ as: "scoped" })`. Do not rely on returning an error object from `derive(...)` to block protected handlers.

## 5. API Key Management Design

### 5.1 Wrapper Routes

Add skrol wrapper routes:

```txt
POST   /api/v1/api-keys
GET    /api/v1/api-keys
DELETE /api/v1/api-keys/:id
```

Wrapper routes require dashboard session auth. They do not accept API key auth.

`POST /api/v1/api-keys`:

- accepts `CreateApiKeyRequest`
- delegates creation to Better Auth plugin
- returns raw key exactly once
- returns safe metadata with the raw key response
- validates name and optional expiration input before delegating where practical

Request DTO:

```ts
type CreateApiKeyRequest = {
	name: string;
	expires_in_seconds?: number;
};
```

Wrapper maps `expires_in_seconds` to Better Auth `expiresIn`. Units are seconds. Do not expose or accept ambiguous `expires_in`.

`GET /api/v1/api-keys`:

- delegates list to Better Auth plugin scoped to current session user
- returns safe metadata only
- never returns raw key or hash

Safe metadata shape:

```ts
type ApiKeyMetadataDto = {
	id: string;
	name: string;
	prefix: string | null;
	created_at: string;
	last_used_at: string | null;
	expires_at: string | null;
	status: "active" | "revoked" | "expired";
};

type CreateApiKeyResponse = {
	key: string;
	api_key: ApiKeyMetadataDto;
};

type ListApiKeysResponse = {
	items: ApiKeyMetadataDto[];
};
```

`POST /api/v1/api-keys` returns `CreateApiKeyResponse`. `GET /api/v1/api-keys` returns `ListApiKeysResponse`.

`DELETE /api/v1/api-keys/:id`:

- revokes by delegating to Better Auth update/disable behavior, not hard-delete
- scopes operation to current user
- returns `204` on success
- returns `404` when key is missing or not owned, if plugin exposes that distinction safely

If the installed Better Auth API Key plugin cannot disable keys, stop and revisit this spec before substituting hard delete. Product UX expects revocation semantics and `revoked` list status.

### 5.2 Dashboard UI

Add `/dashboard/api-keys` frontend route.

Dashboard changes:

- add "API keys" nav beside "Links"
- render table columns: Name, Prefix, Created, Last used, Expires, Status, Actions
- add create-key form with name and optional expiration if wrapper supports it cleanly
- show one-time raw key panel after create response
- add revoke action with confirmation and list refresh

One-time panel must use design-system copy:

```txt
Copy this key now
For security, Skrol will not show the full key again.
```

Full key handling:

- raw key exists only in component state from create response
- key is not persisted in local storage, URL state, or logs
- closing/dismissing panel loses full key
- list/reload never shows full key again

Frontend API direction:

- prefer wrapper functions in `apps/frontend/src/lib/api-client.ts`
- use `authClient.apiKey` only if it materially improves type-safety or plugin compatibility
- keep product API response shapes stable for frontend routes

## 6. Link API Design

### 6.1 Existing Endpoints

Existing Phase 2 endpoints stay and move to combined product API auth:

```txt
POST /api/v1/links
GET  /api/v1/links
GET  /api/v1/links/:id
```

`POST /api/v1/links` keeps request fields:

```ts
{
	url: string;
	alias?: string;
	title?: string;
	expires_at?: string | null;
}
```

Create behavior:

- owner user ID is always derived from authenticated principal
- API key principal stores `created_via_api_key_id`
- session principal stores `created_via_api_key_id = null`
- generated-code and custom-alias links are supported
- duplicate aliases return `409`
- unsafe URLs/domains return `400`

`GET /api/v1/links`:

- returns only links owned by principal
- excludes soft-deleted links
- preserves current pagination contract: `limit`, `cursor`, `{ items, nextCursor }`
- keeps `limit` default `20`, max `100`

`GET /api/v1/links/:id`:

- returns only owned and non-deleted links
- missing, non-owned, and deleted links return `404`

### 6.2 New Update Endpoint

Add:

```txt
PATCH /api/v1/links/:id
```

Accepted body:

```ts
{
	title?: string | null;
	destination_url?: string;
	expires_at?: string | null;
	status?: "active" | "disabled";
}
```

Rules:

- require combined product API auth
- locate link by ID and owner
- missing, non-owned, or deleted link returns `404`
- reject empty patch body with `400`
- reject unknown fields with `400`
- validate `destination_url` with same URL/domain rules as create
- allow only `active` and `disabled` status transitions
- reject alias/code/system-field updates
- return updated safe link DTO

### 6.3 New Delete Endpoint

Add:

```txt
DELETE /api/v1/links/:id
```

Delete behavior:

- require combined product API auth
- locate link by ID and owner
- missing, non-owned, or already deleted link returns `404`
- set `status = "deleted"`
- set `deleted_at = now`
- update `updated_at`
- write audit log
- return `204`

Soft-deleted links remain in database for history and abuse investigation, but disappear from default lists and cannot be updated by normal users.

## 7. Repository and Use Case Design

Extend links repository interface with ownership-aware mutations:

```ts
updateLinkForOwner(...)
softDeleteLinkForOwner(...)
createAuditLog(...)
```

Use cases:

- `UpdateLinkUseCase`
- `DeleteLinkUseCase`

Design rules:

- route handlers stay thin
- validation that belongs to product rules lives in use cases
- ownership checks are enforced through repository query predicates and use-case behavior
- non-owned resources are reported as not found
- repository methods exclude `deleted_at is not null` from mutable paths

Audit entries are written for:

- title changes as `title_changed`
- destination URL changes as `destination_url_changed`
- expiration changes as `expiration_changed`
- disabling links as `link_disabled`
- re-enabling links as `link_reenabled`
- soft-delete as `link_deleted`

Audit actor fields:

- `user_id` is always current principal user ID
- `actor_api_key_id` is API key ID for API-key principals
- `actor_api_key_id` is `null` for session principals

No audit read endpoint is added in Phase 3.

## 8. Error and Security Design

All skrol product API routes use this envelope:

```json
{ "error": { "code": "string", "message": "string" } }
```

Required errors:

- missing/invalid/revoked API key: `401 unauthorized`
- missing/invalid session when no bearer exists: `401 unauthorized`
- non-owned link access: `404 not_found`
- missing/deleted link: `404 not_found`
- duplicate alias: `409 alias_taken`
- reserved alias: `400 reserved_alias`
- malformed URL: `400 invalid_url`
- unsafe URL/domain: `400 unsafe_url`
- invalid patch body: `400 validation_error`
- rate limited: `429 rate_limited`

Security requirements:

- no raw API key in logs
- no API key hash exposed to frontend or product API clients
- no skrol-owned API key table
- wrapper list never returns raw key
- raw key shown only once after create
- invalid bearer never falls back to session
- API key wrapper routes require session auth only
- ownership is enforced below route layer, not only in route handlers

### 8.1 CSRF and Origin Protection

Session-authenticated product API writes require CSRF protection or strict same-origin validation.

Applies to:

- `POST /api/v1/links`
- `PATCH /api/v1/links/:id`
- `DELETE /api/v1/links/:id`
- `POST /api/v1/api-keys`
- `DELETE /api/v1/api-keys/:id`

Bearer-authenticated API calls do not use cookie-based CSRF protection.

Implementation may satisfy this with existing Better Auth CSRF facilities if available for these routes, or with strict `Origin`/`Referer` validation against configured frontend origins. Invalid cross-origin session-authenticated writes must fail before mutation. If strict origin validation is used, missing `Origin` and missing/invalid `Referer` are rejected for session-authenticated writes; regression tests that create links through session auth must send a valid same-origin `Origin` header.

### 8.2 Rate-Limit Positioning

Rate limiting is not implemented in Phase 3 unless already available from earlier infrastructure.

However, Phase 3 must not bypass future rate-limit integration points:

- API key creation: user-scoped bucket
- link creation: user-scoped bucket
- link list/read: user-scoped bucket
- bearer-authenticated requests: principal user ID and API key ID must be available to limiter

## 9. Frontend Design

Add API client functions:

```ts
createApiKey(...)
listApiKeys(...)
deleteApiKey(...)
updateLink(...)
deleteLink(...)
```

Add routes/pages:

- `/dashboard/api-keys`
- link detail edit/delete controls on `/dashboard/links/:id`

API keys page states:

- loading
- empty
- create success with one-time key panel
- create/list/revoke error
- confirmation state for revoke

Link detail page additions:

- edit title
- edit destination URL
- edit expiration
- disable/re-enable
- delete with confirmation

Keep UI consistent with existing dashboard style and `docs/v1/5-design-system.md`. Do not add alias editing UI.

## 10. Testing and Verification

Backend tests:

- Better Auth API Key plugin is configured and schema workflow includes plugin tables
- valid API key can create/list/view/patch/delete owned links
- session auth still works for dashboard link calls
- invalid bearer returns `401` without session fallback
- missing credentials return `401`
- revoked key no longer authenticates
- API key principal records `created_via_api_key_id`
- duplicate aliases return `409 alias_taken`
- reserved aliases return `400 reserved_alias`
- malformed URLs return `400 invalid_url`
- unsafe URLs/domains return `400 unsafe_url`
- invalid patch bodies return `400 validation_error`
- cross-user link access returns `404`
- deleted links disappear from list and cannot be patched
- API key list never exposes raw key or hash
- session-authenticated `POST`/`PATCH`/`DELETE` rejects invalid Origin/CSRF
- bearer-authenticated `POST`/`PATCH`/`DELETE` does not require CSRF token
- API key wrapper create/delete rejects cross-origin session-authenticated writes

Frontend tests:

- dashboard nav includes API keys
- `/dashboard/api-keys` lists metadata
- create flow displays raw key once
- dismissing/reloading removes raw key
- revoke flow calls delete wrapper and refreshes list
- link detail update/delete actions call product API client correctly

Verification commands:

```sh
bun run lint
bun run check-types
bun run build
bunx turbo run test --filter=backend
bunx turbo run test --filter=skrol-frontend
```

Target acceptance:

- user can create API key from dashboard
- raw API key is not recoverable after creation
- revoked key no longer works
- missing/invalid API key returns `401`
- API key can create generated-code links
- API key can create custom-alias links
- duplicate aliases are rejected
- unsafe URLs are rejected
- API user cannot access another user's links
- soft-deleted links disappear from default lists

## 11. Implementation Notes

Dependency changes must use Bun:

```sh
bun add @better-auth/api-key --filter=backend
bun add @better-auth/api-key --filter=skrol-frontend
```

If workspace filtering syntax differs for Bun in this repo, use the equivalent Bun workspace command. Do not manually edit dependency versions or lockfile entries.

Implementation must verify the exact Better Auth API Key plugin method names and response shapes from installed package types before wiring wrappers and tests.
