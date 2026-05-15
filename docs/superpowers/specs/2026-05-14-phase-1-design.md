# Phase 1 Design: Core Data and Redirect System

Date: 2026-05-14  
Project: skrol  
Phase: 1 (Core Data and Redirect System)  
Status: Proposed for implementation planning

## 1. Goal and Scope

Phase 1 implements the backend-only foundation for short links and public redirects, aligned with `docs/v1/4-master-spec.md` section "Phase 1: Core Data and Redirect System".

This phase includes:

- skrol-owned schema and migrations for `user_profiles`, `links`, `click_events`, `link_audit_logs`, and `domain_blocklist`
- alias and URL validation
- short-code generation
- link creation service (internal backend service contract)
- redirect lookup service
- public `GET /:code` redirect route
- privacy-conscious click-event insertion
- status handling for unknown, deleted, disabled, flagged, and expired links

This phase excludes:

- dashboard authentication flows
- API key lifecycle features
- `/api/v1` CRUD endpoints
- dashboard pages and UI

## 2. Governing Decisions

Source-of-truth references:

- Product scope and non-goals: `docs/v1/1-project-prd.md`
- Technical behavior and validation rules: `docs/v1/2-project-trd.md`
- Data ownership boundaries: `docs/v1/3-project-erd.md`
- Phase deliverables and acceptance criteria: `docs/v1/4-master-spec.md`

Enforced boundaries:

- Keep authentication and API key persistence plugin-managed by Better Auth.
- Do not create a skrol-owned `api_keys` table.
- Keep redirect path minimal and reliability-first.
- Preserve privacy constraints (no raw IP, no full user-agent, no cookie/fingerprint identifiers in click event storage).

### 2.1 ID Strategy Decision

Decision: keep `uuidv7()` primary keys for skrol-owned tables in Phase 1.

Rationale:

- `docs/v1/4-master-spec.md` section 5.2 explicitly sets skrol-owned PKs to PostgreSQL 18 `uuidv7()`.
- `docs/v1/3-project-erd.md` states skrol-owned tables should use `uuidv7()` defaults.

Implementation note:

- Verify `uuidv7()` availability in the target PostgreSQL runtime before final migration freeze.
- If unavailable in a specific environment, provide a project-approved fallback migration strategy before applying Phase 1 migrations.

### 2.2 Better Auth Dependency Precondition

Phase 1 excludes auth flow implementation but still stores auth-owned user identifiers.

Precondition:

- Do not hard-code speculative Better Auth physical table names.
- For Phase 1, keep `user_id` as logical ownership fields without DB-level FKs to Better Auth tables unless generated schema has been inspected and confirmed.
- Canonical FK decisions to auth-managed tables can be finalized in Phase 2 after Better Auth schema confirmation.

## 3. Architecture

Implementation follows a vertical-slice sequence centered on public redirect behavior.

### 3.1 Module Boundaries

- `core/links`
  - link entity semantics
  - status handling (`active`, `disabled`, `flagged`, `deleted`)
  - expiration evaluation
  - link creation rules
- `core/redirect`
  - code normalization and lookup
  - effective-state resolution
  - redirect decision output (`302`, `404`, `410`)
- `core/analytics`
  - click-event normalization and best-effort persistence
- `core/safety`
  - domain blocklist checks for destination URLs
- infrastructure adapters
  - Kysely repositories
  - Elysia route handler for `GET /:code`

### 3.2 Redirect Flow

1. Parse and normalize `:code` to lowercase.
2. Reject reserved route segments before link lookup where applicable.
3. Lookup link by unique `links.code`.
4. Resolve effective link state using explicit precedence.
5. Return outcome:
   - unknown/deleted -> `404`
   - disabled/flagged/expired -> `410`
   - active -> `302` redirect to destination URL
6. On successful active redirect, write click event as best effort.
7. If click-event insertion fails, log error and still return redirect.

Route registration rule:

- Register static/system routes before `GET /:code`.
- Redirect handler must reject reserved segments such as `api`, `health`, `status`, `login`, `logout`, `signup`, `dashboard`, and `admin`.
- Reserved segments are not treated as short-link codes.

## 4. Data Model and Migration Strategy

### 4.1 Migration Strategy Choice

The current implementation direction allows refactoring previous migration/code for a cleaner Phase 1 baseline. The canonical result must still match TRD/ERD/Master Spec behavior.

### 4.2 skrol-Owned Tables

- `user_profiles`
  - `user_id` text PK
  - `role` text with allowed values `user|admin`
  - `created_at`, `updated_at`
- `links`
  - `id` uuid PK default `uuidv7()`
  - `user_id` text (owner)
  - `code` text unique, normalized lowercase
  - `destination_url` text
  - `title` nullable text
  - `status` text in (`active`, `disabled`, `flagged`, `deleted`)
  - `expires_at` nullable timestamptz
  - `created_via_api_key_id` nullable text (logical ref only)
  - `created_at`, `updated_at`, `deleted_at`
- `click_events`
  - `id` uuid PK default `uuidv7()`
  - `link_id` uuid reference target (logical FK in Phase 1)
  - `clicked_at` timestamptz
  - `referrer_domain` nullable text (domain-only)
  - `country`, `browser`, `os`, `device` nullable text
  - `is_bot` boolean
- `link_audit_logs`
  - `id` uuid PK default `uuidv7()`
  - `link_id` uuid reference target (logical FK in Phase 1)
  - `user_id` nullable text
  - `actor_api_key_id` nullable text
  - `action` text
  - `previous_value`, `new_value` nullable jsonb
  - `created_at` timestamptz
- `domain_blocklist` (included in Phase 1)
  - `id` uuid PK default `uuidv7()`
  - `domain` unique text
  - `reason` nullable text
  - `created_by_user_id` text
  - `created_at` timestamptz
  - `disabled_at` nullable timestamptz

Domain blocklist matching semantics:

- Normalize candidate hostname by lowercasing and removing a trailing dot.
- Convert IDN hostnames to ASCII/punycode before matching.
- Ignore rows where `disabled_at IS NOT NULL`.
- Active blocklist entry blocks exact domain and subdomains.

### 4.3 Constraints and Indexes

Required constraints:

- unique `links.code`
- check `links.status IN ('active','disabled','flagged','deleted')`
- check `user_profiles.role IN ('user','admin')`

Required indexes:

- `links(user_id)`
- `links(user_id, created_at DESC)`
- `click_events(link_id)`
- `click_events(clicked_at)`
- `click_events(link_id, clicked_at DESC)`
- `link_audit_logs(link_id)`
- `domain_blocklist(domain)` unique

## 5. Validation and Domain Rules

### 5.1 Alias Rules

- Normalize by trim + lowercase.
- Must match `^[a-z0-9_-]{3,64}$`.
- Must not use reserved aliases (from docs).
- Generated code uses lowercase alphanumeric characters.

### 5.2 Code Generation Rules

- Generated code length: 7
- Alphabet: `a-z0-9`
- Randomness: cryptographically secure source
- Collision handling: rely on DB uniqueness and retry up to 5 attempts

### 5.3 URL Rules

Allow only:

- `http`
- `https`

Reject:

- malformed URLs
- non-HTTP schemes
- localhost, loopback, private ranges, link-local, metadata IPs
- blocklisted domains

Do not fetch destination URLs during creation/update/redirect.

Validation clarifications:

- No DNS resolution in Phase 1 URL validation.
- Private-range rejection applies to literal IP-host destinations.
- Reject URL userinfo forms that can hide true hosts (e.g., `trusted.com@evil.com`).
- Reject empty hostnames and relative URLs.

Minimum edge-case test coverage:

- IPv6 loopback/private/link-local
- IPv4-mapped IPv6 literals
- localhost with trailing dot
- IDN/punycode hosts
- malformed/overlong/relative URL inputs

## 6. Service Contracts

### 6.1 Link Creation Service (Internal)

Auth-neutral service contract:

```ts
createLink({
  ownerUserId,
  actorApiKeyId,
  destinationUrl,
  alias,
  title,
  expiresAt,
}: {
  ownerUserId: string;
  actorApiKeyId?: string | null;
  destinationUrl: string;
  alias?: string;
  title?: string;
  expiresAt?: Date | null;
})
```

Responsibilities:

- normalize and validate inputs
- enforce alias rules and uniqueness
- enforce URL safety and blocklist
- generate code when alias absent
- insert link row with default active status
- return canonical short-link payload for downstream layers

### 6.2 Redirect Lookup Service

Responsibilities:

- find link by normalized code
- compute effective state
- map state to response decision
- expose destination URL only for active redirect path

Decision table:

Effective-state precedence:

1. missing row -> unknown
2. `deleted_at IS NOT NULL` or `status = 'deleted'` -> deleted
3. `status = 'flagged'` -> flagged
4. `status = 'disabled'` -> disabled
5. `expires_at IS NOT NULL AND expires_at <= now` -> expired
6. `status = 'active'` -> active

Public mapping:

- unknown/deleted -> `404`
- flagged/disabled/expired -> `410`
- active -> `302`

### 6.3 Click Event Recording

Responsibilities:

- run only on successful active redirect path
- persist only aggregate/privacy-safe fields
- never persist raw IP/full UA/cookies/fingerprints
- fail without affecting redirect response

Execution policy:

- Await insertion with a short internal timeout in Phase 1.
- On timeout/error, log and continue redirect response.
- Revisit async strategy later only if measured latency requires changes.

## 7. Route Behavior

### 7.1 Public Redirect Route

Route: `GET /:code`

Behavior:

- delegate business logic to redirect service
- return exact status mapping (`302`, `404`, `410`)
- do not set analytics cookies
- keep handler thin and deterministic

## 8. Observability and Error Handling

### 8.1 Error Handling Rules

- redirect path errors map to required public statuses where applicable
- analytics insertion errors are logged but do not fail redirect
- reject invalid creation inputs with stable domain error codes for future API mapping

### 8.2 Logging Rules

- structured logs with request context and reason codes
- log redirect outcomes and failure reasons
- avoid logging sensitive request-derived data

Explicitly prohibited in logs:

- `Authorization` header values
- cookies or session tokens
- full user-agent strings
- raw IP values as analytics fields
- full destination URLs by default when query strings may contain sensitive data

Preferred log fields:

- request ID
- short code
- link ID
- decision reason
- HTTP status
- handler duration

## 9. Testing Plan for Phase 1 Gate

### 9.1 Unit Tests

- alias normalization and reserved alias rejection
- URL validation/safety checks
- redirect decision matrix
- generator collision retry behavior

### 9.2 Integration Tests

- migrations up/down succeed on clean DB
- `GET /:code` status behavior matches acceptance criteria
- click events inserted only with allowed fields
- domain blocklist rejection on link creation

Additional Phase 1 gate tests:

- `GET /:code` is case-insensitive for code lookup
- reserved route segments are not handled as short-link codes
- `deleted_at IS NOT NULL` returns `404` even if status appears active
- `expires_at == now` returns `410`
- analytics insertion failure still returns `302`
- redirect responses do not set analytics cookies
- duplicate alias race is handled by DB uniqueness behavior
- blocklisted subdomain behavior follows blocklist semantics
- Better Auth table dependency precondition is respected by migration strategy

### 9.3 Acceptance Mapping

Master Spec Phase 1 acceptance criteria coverage:

- generated links unique -> code generation + unique DB constraint + collision retry tests
- custom aliases normalized lowercase -> alias normalization tests
- reserved aliases rejected -> alias validator tests
- unsafe URLs rejected -> URL validator tests
- active links return `302` -> redirect integration tests
- unknown links return `404` -> redirect integration tests
- deleted links return `404` -> redirect integration tests
- disabled/flagged/expired return `410` -> redirect integration tests
- click events exclude raw IP/full UA -> schema + insert-path tests

## 10. Implementation Slice Order

1. Confirm ID strategy and Better Auth schema dependency precondition
2. Validation modules (alias + URL) and edge-case tests
3. Schema canonicalization and type regeneration
4. Link creation service (internal, auth-neutral contract)
5. Redirect core service and effective-state resolution
6. `GET /:code` with reserved-route protection
7. Privacy analytics insertion on successful redirects
8. Test completion and acceptance gate verification

## 11. Risks and Mitigations

- Migration refactor risk: refactoring early migration history can break non-clean local DB states. Mitigation: verify on clean DB and document reset expectation for local development.
- Status ambiguity risk: misclassifying deleted vs disabled/flagged/expired. Mitigation: explicit decision table and tests.
- Privacy regression risk: accidental event enrichment with sensitive fields. Mitigation: strict event schema and dedicated regression tests.

## 12. Out-of-Scope Reminder

This design intentionally does not include:

- Better Auth session flows (Phase 2)
- Better Auth API Key plugin route integration (Phase 3)
- analytics query APIs or dashboard panels (Phase 4)

The goal is a stable, minimal, and testable redirect/data foundation for subsequent phases.
