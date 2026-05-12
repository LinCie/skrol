# skrol Master Implementation Spec

## 1. Purpose

This document consolidates the PRD, TRD, and ERD into a single execution plan for building the skrol MVP from project setup through production release.

The goal is not to expand scope. The goal is to convert the locked MVP requirements into an implementation-ready plan with clear phases, deliverables, dependencies, validation criteria, and release gates.

---

## 2. MVP Definition

skrol is an authenticated, API-first, privacy-conscious URL shortener hosted on `https://skrol.ink`.

The MVP must allow users to:

1. Sign up, log in, and log out.
2. Create and revoke API keys.
3. Create short links through a REST API.
4. Create short links through a dashboard.
5. Use custom aliases.
6. Set expiration dates.
7. Redirect visitors through `https://skrol.ink/:code`.
8. Disable, re-enable, and soft-delete links.
9. View basic aggregate analytics.
10. Use the product without tracking cookies, fingerprinting, long-term raw IP analytics, or per-visitor profiling.
11. Benefit from baseline abuse prevention: validation, rate limits, blocklist support, and admin disablement.

The MVP must remain intentionally narrow. Excluded features include anonymous link creation, teams, billing, custom domains, QR codes, browser extensions, SDKs, CLI, webhooks, advanced moderation, unique visitor analytics, retargeting pixels, and tracking-heavy marketing analytics.

---

## 3. Source-of-Truth Decisions

### 3.1 Product Boundary

API-first behavior takes priority over dashboard sophistication. The dashboard exists to support link inspection, manual link creation, API key management, and account management.

### 3.2 Technical Stack

Use the following MVP stack:

| Layer               | Decision                              |
| ------------------- | ------------------------------------- |
| Backend             | Elysia on Bun                         |
| Frontend            | Vite + TanStack Router + TypeScript   |
| SQL builder         | Kysely                                |
| Auth                | Better Auth                           |
| API keys            | Better Auth API Key plugin            |
| Database            | PostgreSQL                            |
| Cache / rate limits | Redis                                 |
| Logging             | Pino                                  |
| Error monitoring    | Sentry                                |
| Hosting             | VPS                                   |
| Reverse proxy       | Nginx                                 |
| TLS                 | Certbot or equivalent ACME automation |

### 3.3 API Key Boundary

Do not create a skrol-owned `api_keys` table unless Better Auth’s API Key plugin proves unable to satisfy a required MVP constraint.

Better Auth/plugin-managed schema owns:

- users
- sessions
- accounts / credentials
- verification records, if enabled
- API key records

skrol-owned schema owns:

- `user_profiles`
- `links`
- `click_events`
- `link_audit_logs`
- `domain_blocklist`, optional but recommended for MVP abuse controls

### 3.4 Redirect Status

Use `302 Found` for active links. Do not use `301 Moved Permanently` because destinations may be edited later and permanent redirects can be cached too aggressively.

### 3.5 Deleted Link Public Behavior

Soft-deleted links return `404 Not Found` publicly. Disabled, flagged, and expired links return `410 Gone`.

### 3.6 Geolocation

Defer geolocation unless a local GeoIP database is added without external request-time calls. If added, store only country code, not raw IP.

### 3.7 Redirect Cache

Defer Redis redirect caching until measured latency requires it. Database lookup using a unique indexed `links.code` is acceptable for MVP.

---

## 4. System Architecture

```text
[Browser / API Client]
        |
        v
[Nginx Reverse Proxy]
        |
        +--> Static dashboard assets from Vite build
        |
        +--> Elysia backend
                  |
                  +--> Better Auth session handling
                  +--> Better Auth API Key plugin authentication
                  +--> Link management services
                  +--> Redirect handler
                  +--> Analytics ingestion
                  +--> Admin controls
                  |
                  +--> PostgreSQL via Kysely
                  +--> Redis for rate limits and optional cache
                  +--> Pino structured logging
                  +--> Sentry error monitoring
```

The redirect path must remain small and dependency-light:

1. Normalize code.
2. Reject reserved app routes where applicable.
3. Lookup link by indexed `code`.
4. Check deleted, disabled, flagged, and expired states.
5. Derive normalized analytics metadata.
6. Insert click event without raw IP or full user agent.
7. Return `302 Found`.

Analytics insert failure must not block the redirect.

---

## 5. Data Model

### 5.1 Auth / Plugin-Managed Entities

Represent these as generated external dependencies:

- `AUTH_USERS`
- `AUTH_SESSIONS`
- `AUTH_ACCOUNTS`
- `AUTH_VERIFICATIONS`
- `AUTH_API_KEYS`

Do not hard-code speculative physical Better Auth table names in skrol migrations. Inspect generated schema first.

### 5.2 skrol-Owned Entities

#### `user_profiles`

Purpose: skrol-specific user metadata, especially role.

Columns:

- `user_id text primary key`
- `role text not null default 'user'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- `role in ('user', 'admin')`

#### `links`

Purpose: central short-link entity.

Columns:

- `id text primary key`
- `user_id text not null`
- `code text not null unique`
- `destination_url text not null`
- `title text null`
- `status text not null default 'active'`
- `expires_at timestamptz null`
- `created_via_api_key_id text null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `deleted_at timestamptz null`

Constraints:

- `code = lower(code)`
- `status in ('active', 'disabled', 'flagged', 'deleted')`
- unique index on `code`

Required indexes:

- `links(code)` unique
- `links(user_id)`
- `links(user_id, created_at desc)`
- optional `links(created_via_api_key_id)`

#### `click_events`

Purpose: privacy-conscious analytics events for successful redirects.

Columns:

- `id text primary key`
- `link_id text not null`
- `clicked_at timestamptz not null default now()`
- `referrer_domain text null`
- `country text null`
- `browser text null`
- `os text null`
- `device text null`
- `is_bot boolean not null default false`

Forbidden long-term fields:

- raw IP
- full user-agent string
- cookie ID
- visitor ID
- fingerprint ID
- session ID

Required indexes:

- `click_events(link_id)`
- `click_events(clicked_at)`
- `click_events(link_id, clicked_at desc)`

#### `link_audit_logs`

Purpose: audit trail for sensitive link lifecycle changes.

Columns:

- `id text primary key`
- `link_id text not null`
- `user_id text null`
- `actor_api_key_id text null`
- `action text not null`
- `previous_value jsonb null`
- `new_value jsonb null`
- `created_at timestamptz not null default now()`

Required actions:

- `destination_url_changed`
- `link_disabled`
- `link_reenabled`
- `link_deleted`
- `link_flagged`
- `link_unflagged`
- `expiration_changed`
- `title_changed`

#### `domain_blocklist`

Purpose: reject known abusive or disallowed destination domains.

Columns:

- `id text primary key`
- `domain text not null unique`
- `reason text null`
- `created_by_user_id text null`
- `created_at timestamptz not null default now()`
- `disabled_at timestamptz null`

Required behavior:

- domain is normalized lowercase
- active records are those with `disabled_at is null`

---

## 6. API Contract

### 6.1 Authentication

API requests use bearer token authentication:

```http
Authorization: Bearer sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Missing, invalid, expired, disabled, or revoked keys return `401 Unauthorized`.

Dashboard requests may use Better Auth session cookies. Both dashboard-originated and API-key-originated requests must pass the same ownership checks.

### 6.2 Error Shape

All API errors must use:

```json
{
	"error": {
		"code": "alias_taken",
		"message": "This alias is already in use."
	}
}
```

Standard error codes:

- `unauthorized`
- `forbidden`
- `not_found`
- `validation_error`
- `alias_taken`
- `reserved_alias`
- `invalid_url`
- `unsafe_url`
- `rate_limited`
- `internal_error`

### 6.3 Required Endpoints

Links:

```text
POST   /api/v1/links
GET    /api/v1/links
GET    /api/v1/links/:id
PATCH  /api/v1/links/:id
DELETE /api/v1/links/:id
GET    /api/v1/links/:id/analytics
```

API keys:

```text
POST   /api/v1/api-keys
GET    /api/v1/api-keys
DELETE /api/v1/api-keys/:id
```

System:

```text
GET /health
```

Redirect:

```text
GET /:code
```

---

## 7. Validation Rules

### 7.1 Alias Rules

Normalize alias by trimming whitespace and lowercasing.

Allowed format:

```text
^[a-z0-9_-]{3,64}$
```

Reserved aliases:

- `api`
- `admin`
- `app`
- `auth`
- `dashboard`
- `login`
- `logout`
- `signup`
- `settings`
- `health`
- `status`

Generated codes:

- length: 7 characters
- alphabet: lowercase `a-z` and digits `0-9`
- generation: cryptographically secure randomness
- uniqueness: enforced by database unique constraint
- retry: up to 5 attempts on collision

### 7.2 URL Rules

Accept only:

- `http`
- `https`

Reject:

- malformed URLs
- `javascript:`
- `data:`
- `file:`
- `ftp:`
- `mailto:`
- `tel:`
- all non-HTTP schemes
- `localhost`
- `127.0.0.1`
- `0.0.0.0`
- private IPv4 ranges
- private IPv6 ranges
- link-local addresses
- cloud metadata IPs
- blocklisted domains

Do not fetch destination URLs during creation, update, or redirect.

---

## 8. Dashboard Requirements

Required routes:

```text
/login
/signup
/dashboard
/dashboard/links
/dashboard/links/new
/dashboard/links/:id
/dashboard/api-keys
/dashboard/settings
/admin/links
```

Required pages:

1. Login
2. Signup
3. Links list
4. Link detail
5. Create link
6. API keys
7. Account settings
8. Minimal admin link lookup/action page or equivalent internal script

Links list shows:

- short URL
- destination URL
- title
- status
- created date
- expiration date
- total clicks
- copy button

Link detail shows:

- short URL
- destination URL
- title
- status
- created date
- expiration date
- total clicks
- clicks over time
- referrer-domain breakdown
- country breakdown, if implemented
- device breakdown
- browser breakdown
- disable action
- delete action

Required UI states:

- empty links list
- empty analytics state
- invalid URL
- alias taken
- reserved alias
- expired link
- disabled link
- deleted link
- API key created
- API key revoked
- rate limited

---

## 9. Analytics Requirements

On successful redirect, derive and store:

- `link_id`
- `clicked_at`
- `referrer_domain`, domain only
- `country`, optional
- `browser`, family only
- `os`, family only
- `device`
- `is_bot`

Do not store long-term:

- raw IP
- full user-agent
- cookies
- fingerprint identifiers
- visitor IDs
- per-user clickstream identity

Dashboard analytics must support:

- total clicks
- clicks over time
- referrer-domain breakdown
- device breakdown
- browser breakdown
- country breakdown if geolocation is implemented

Bot detection is classification only. Do not block bots by default in the redirect path.

---

## 10. Rate Limiting

Use Redis for production rate limiting.

Initial buckets:

| Area               | Key                                       |          Limit |
| ------------------ | ----------------------------------------- | -------------: |
| Link creation      | `user:{user_id}:link_create`              |         60/min |
| Link list/read API | `user:{user_id}:api_read`                 |        300/min |
| API key creation   | Better Auth plugin or skrol wrapper       |        10/hour |
| Login attempts     | `ip:{ip}:login` and `email:{email}:login` |      10/15 min |
| Public redirects   | `ip:{ip}:redirect`                        | high threshold |

Return `429 Too Many Requests` with standard error shape. Include `Retry-After` where practical.

Failure mode:

- auth-sensitive endpoints fail closed if Redis is unavailable
- public redirects fail open for the rate-limit layer only, while still requiring database link lookup

---

## 11. Abuse Prevention

Required MVP controls:

1. No anonymous link creation.
2. HTTP/HTTPS-only URL validation.
3. Private/local/network metadata destination rejection.
4. Reserved alias rejection.
5. Domain blocklist support.
6. Rate-limited link creation.
7. Admin disable and flag actions.
8. Audit logs for sensitive lifecycle changes.
9. Basic bot classification for analytics.

Cloudflare Turnstile may be used selectively for:

- signup abuse
- suspicious login behavior
- suspicious link creation
- suspicious API key creation

Do not put Turnstile in the normal `GET /:code` redirect path.

---

## 12. Security Requirements

### 12.1 Sessions

Dashboard sessions must use:

```text
httpOnly: true
secure: true in production
sameSite: Lax
path: /
```

### 12.2 API Keys

Rules:

- raw API keys shown only once at creation
- raw keys never logged
- key hashes never returned
- invalid, expired, disabled, or deleted keys rejected
- API-key lifecycle handled by Better Auth API Key plugin unless proven inadequate

### 12.3 Authorization

Users may only access their own links and API keys. Cross-user resource access should generally return `404`, not `403`, to avoid leaking resource existence.

Admin-only actions require:

- authenticated dashboard session or controlled internal server access
- `role = admin`
- audit-log entry

### 12.4 Output Safety

Escape user-controlled dashboard fields:

- title
- destination URL display text
- referrer domains
- API key names

---

## 13. Observability

### 13.1 Logging

Use Pino structured JSON logs.

Avoid logging:

- raw passwords
- raw API keys
- password hashes
- API key hashes
- authorization headers
- session cookies
- full request bodies by default
- full user-agent in analytics records

### 13.2 Request IDs

Each request should have a request ID.

Return where practical:

```http
X-Request-ID: req_123
```

### 13.3 Sentry

Sentry must be configured with:

- `sendDefaultPii: false`
- authorization header scrubbing
- cookie header scrubbing
- API key scrubbing
- password scrubbing
- conservative performance sampling
- no unrestricted session replay unless separately reviewed

---

## 14. Performance Targets

| Area                   |                                          Target |
| ---------------------- | ----------------------------------------------: |
| Redirect p95 latency   | < 100 ms excluding external destination latency |
| API p95 latency        |                    < 300 ms for normal requests |
| Link creation          |                < 500 ms under normal conditions |
| Dashboard initial load |             < 2 seconds under normal conditions |

Redirect optimization rules:

- indexed lookup by `links.code`
- minimal selected columns
- no external network calls
- analytics insert must be lightweight
- cache only after measurement shows need

---

## 15. Reliability Rules

### 15.1 PostgreSQL Failure

- API returns controlled `503` or `500 internal_error`.
- Redirects return controlled `503` because link resolution is unavailable.
- Health check fails.

### 15.2 Redis Failure

- Auth-sensitive endpoints fail closed where abuse risk is high.
- Public redirects continue database lookup and fail open only for rate limiting.
- Redis outage is logged.

### 15.3 Analytics Insert Failure

- Redirect still proceeds.
- Error is logged.
- Analytics loss is acceptable; redirect availability has priority.

---

## 16. Implementation Phases

## Phase 0: Project Foundation

Objective: establish a stable development and deployment baseline.

Deliverables:

- monorepo or structured app repository
- Bun/Elysia backend scaffold
- Vite/TanStack Router frontend scaffold
- shared TypeScript configuration
- local PostgreSQL and Redis setup
- `.env.example`
- Kysely database connection
- migration workflow selected
- Pino configured
- baseline `/health`
- basic CI: lint, typecheck, test

Acceptance criteria:

- backend starts locally
- frontend starts locally
- backend connects to PostgreSQL
- backend connects to Redis
- `/health` returns healthy when dependencies are available
- CI runs without manual steps

---

## Phase 1: Core Data and Redirect System

Objective: implement the core short-link primitive and public redirect path.

Deliverables:

- skrol-owned migrations for `user_profiles`, `links`, `click_events`, `link_audit_logs`, and optionally `domain_blocklist`
- alias validation
- URL validation
- short-code generator
- link creation service function
- redirect lookup service
- public `GET /:code`
- privacy-conscious click-event insert
- deleted/disabled/flagged/expired status handling

Acceptance criteria:

- generated links are unique
- custom aliases are normalized lowercase
- reserved aliases are rejected
- unsafe URLs are rejected
- active links return `302`
- unknown links return `404`
- deleted links return `404`
- disabled, flagged, and expired links return `410`
- click events do not store raw IP or full user-agent

---

## Phase 2: Authentication and Dashboard Basics

Objective: make the product usable by authenticated dashboard users.

Deliverables:

- Better Auth integration
- signup
- login
- logout
- secure session configuration
- protected dashboard routes
- `user_profiles` creation/defaulting
- links list page
- create-link page
- link detail page
- session-authenticated link create/list/detail calls

Acceptance criteria:

- user can sign up
- user can log in
- user can log out
- logged-out users cannot access dashboard pages
- logged-in users can create a link from dashboard
- logged-in users can list only their own links
- logged-in users can view only their own link details
- dashboard displays correct empty/error states

---

## Phase 3: API-First Layer

Objective: make the REST API fully usable by developers.

Deliverables:

- Better Auth API Key plugin installed
- Better Auth API Key plugin schema generated/applied
- API key create/list/revoke dashboard UI or wrappers
- API key shown once at creation
- API-key verification middleware
- `POST /api/v1/links`
- `GET /api/v1/links`
- `GET /api/v1/links/:id`
- `PATCH /api/v1/links/:id`
- `DELETE /api/v1/links/:id`
- consistent API error shape
- pagination for link listing
- ownership checks on all endpoints

Acceptance criteria:

- user can create an API key
- raw API key is not recoverable after creation
- revoked API key no longer works
- missing/invalid API key returns `401`
- API can create generated-code links
- API can create custom-alias links
- API rejects duplicate aliases
- API rejects unsafe URLs
- API user cannot access another user’s links
- soft-deleted links disappear from default lists

---

## Phase 4: Analytics

Objective: expose useful aggregate analytics without invasive tracking.

Deliverables:

- total-click query
- clicks-over-time query
- referrer-domain aggregation
- device aggregation
- browser aggregation
- bot classification field handling
- optional country aggregation if local GeoIP is implemented
- link analytics API: `GET /api/v1/links/:id/analytics`
- dashboard analytics panels

Acceptance criteria:

- link detail shows total clicks
- link detail shows clicks over time
- link detail shows referrer breakdown
- link detail shows browser/device breakdown
- country breakdown appears only if implemented
- no analytics cookies are set by redirect path
- click-event records do not contain raw IP or full user-agent

---

## Phase 5: Safety and Admin Controls

Objective: ship baseline abuse prevention and operator controls.

Deliverables:

- Redis rate limiting
- domain blocklist lookup
- admin role enforcement
- admin search by code
- admin disable action
- admin flag action
- audit logging for sensitive changes
- optional Turnstile on high-abuse forms
- privacy note

Acceptance criteria:

- excessive link creation returns `429`
- excessive login attempts are rate-limited
- blocklisted domains are rejected with `unsafe_url`
- admin can search a link by code
- admin can disable or flag abusive links
- admin action creates audit log entry
- disabled/flagged links return `410`
- privacy note accurately describes collected and excluded data

---

## Phase 6: Operations and Production Release

Objective: deploy the MVP safely to `skrol.ink`.

Deliverables:

- VPS provisioned
- PostgreSQL installed/configured
- Redis installed/configured
- Nginx configured
- TLS certificate automation
- production environment variables
- migration execution process
- process manager: systemd or Docker Compose
- log rotation
- Sentry backend/frontend integration
- database backup script
- restore procedure documented
- basic API documentation
- release checklist completed

Acceptance criteria:

- production app serves HTTPS
- `/health` works
- dashboard loads
- signup/login works
- API key flow works
- API link creation works
- public redirect works on `skrol.ink`
- unsafe URLs are rejected in production
- rate limits are active
- admin disablement works
- backup exists and restore command is documented
- Sentry receives production release errors if induced in a controlled test

---

## 17. Testing Plan

### Unit Tests

Required:

- URL parser and validator
- alias validator
- reserved alias rejection
- short-code generator
- generated-code collision retry behavior
- error response formatter
- referrer-domain normalization
- bot detection heuristic
- status transition rules

### Integration Tests

Required:

- signup/login/logout
- API key creation/revocation
- generated-code link creation
- custom-alias link creation
- duplicate alias rejection
- invalid URL rejection
- unsafe URL rejection
- link update ownership checks
- soft deletion
- redirect success
- expired link returns `410`
- disabled link returns `410`
- flagged link returns `410`
- deleted link returns `404`
- analytics event inserted on redirect
- raw IP not stored in click events

### API Contract Tests

Required:

- status codes
- error codes
- required response fields
- auth rejection cases
- pagination behavior
- malformed input handling

### Security Tests

Required:

- missing auth rejected
- invalid API key rejected
- revoked API key rejected
- user cannot access another user’s links
- user cannot revoke another user’s API keys
- private IP URLs rejected
- non-HTTP schemes rejected
- reserved aliases rejected
- user-controlled dashboard fields escaped

### Performance Checks

Required before release:

- redirect lookup p95 under target with sample data
- link creation latency under target
- list endpoint latency with sample user data
- analytics aggregation latency with sample click events

---

## 18. Release Criteria

The MVP is releasable only when all of the following are true:

1. User signup/login/logout works.
2. Dashboard session protection works.
3. API key creation, one-time display, verification, and revocation work.
4. API link creation works.
5. Dashboard link creation works.
6. Custom aliases work.
7. Expiration works.
8. Public redirects work on `skrol.ink`.
9. Unknown links return `404`.
10. Deleted links return `404`.
11. Expired, disabled, and flagged links return `410`.
12. Users can list, inspect, update, disable, re-enable, and soft-delete their own links.
13. Users cannot access another user’s links.
14. Aggregate analytics are visible.
15. Raw IPs are not stored in long-term click events.
16. Full user-agent strings are not stored in long-term click events.
17. No analytics cookies are set by the redirect path.
18. Unsafe URLs are rejected.
19. Reserved aliases are rejected.
20. Rate limiting exists for sensitive endpoints.
21. Admin can disable abusive links.
22. Audit logs exist for sensitive lifecycle changes.
23. Basic API documentation exists.
24. Privacy note exists.
25. Health check exists.
26. Production logging and Sentry are configured.
27. Database backup and restore procedure are documented.

---

## 19. Post-Launch Metrics

### Product Metrics

- registered users
- API keys created
- links created
- custom aliases created
- redirects served
- links receiving at least one click
- expired links
- disabled links
- blocklisted destination attempts

### Engineering Metrics

- redirect p95 latency
- API p95 latency
- redirect error rate
- API error rate
- link creation success rate
- generated-code collision rate
- rate-limit trigger count
- failed API authentication attempts

### Privacy Metrics

- tracking cookies set by redirect path, target: zero
- click events stored without raw IP, target: 100%
- operational log retention duration
- number of analytics fields stored per click

---

## 20. Risk Register

| Risk                                        |   Severity | Mitigation                                                                                  |
| ------------------------------------------- | ---------: | ------------------------------------------------------------------------------------------- |
| Phishing/spam abuse                         |       High | No anonymous creation, URL validation, blocklist, rate limits, admin disablement            |
| Slow redirects                              |       High | Unique index on `links.code`, minimal redirect path, optional Redis cache after measurement |
| Analytics violates privacy positioning      |     Medium | Store normalized aggregate metadata only; no cookies, fingerprinting, raw IP, or full UA    |
| Scope creep into Bitly clone                |     Medium | Enforce MVP non-goals and decision log                                                      |
| Alias collision with app routes             |     Medium | Reserved aliases and route precedence                                                       |
| API key leakage                             |     Medium | Hash/plugin-managed storage, one-time raw display, revocation                               |
| Destination changed after trust established |     Medium | Audit destination changes, admin disablement                                                |
| Bot traffic pollutes analytics              | Low/Medium | `is_bot` classification                                                                     |
| Operational burden                          |     Medium | Keep single-VPS MVP, defer custom domains/teams/billing                                     |

---

## 21. Execution Order Summary

Recommended build order:

1. Project foundation.
2. Database schema and migrations.
3. URL and alias validation.
4. Short-code generation.
5. Link service.
6. Redirect route.
7. Click-event insertion.
8. Better Auth dashboard auth.
9. Basic dashboard link flows.
10. Better Auth API Key plugin integration.
11. REST API endpoints.
12. Analytics queries and UI.
13. Rate limiting.
14. Domain blocklist.
15. Admin disable/flag controls.
16. Audit logs.
17. Observability and Sentry.
18. API documentation.
19. Privacy note.
20. Production deployment.
21. Release checklist.

---

## 22. Immediate Next Actions

1. Create the repository structure and local Docker Compose services for PostgreSQL and Redis.
2. Select the Kysely-compatible migration workflow.
3. Generate and inspect Better Auth schema, including API Key plugin tables.
4. Write skrol-owned migrations only after confirming Better Auth physical table names.
5. Implement URL validation and alias validation first, because they sit on the critical path for API, dashboard, redirect safety, and abuse prevention.
6. Build the redirect system before the dashboard polish, because redirect reliability is the core product behavior.
7. Defer geolocation and redirect caching unless implementation remains simple and does not weaken privacy or reliability.
