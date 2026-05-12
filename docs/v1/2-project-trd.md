# skrol Technical Requirements Document v1

## 1. Document Control

**Product:** skrol
**Domain:** `skrol.ink`
**Document type:** Technical Requirements Document
**Version:** v1
**Status:** Draft for MVP implementation
**Primary audience:** Product owner, engineering, future technical contributors
**Source document:** skrol Product Requirements Document v1

---

## 2. Technical Summary

skrol is an authenticated, API-first, privacy-conscious URL shortener hosted at `skrol.ink`. The MVP provides short-link creation, management, expiration, disablement, soft deletion, API key authentication, public redirects, aggregate analytics, and basic abuse-prevention controls.

The system will be implemented as a VPS-hosted web application using:

| Layer                 | Technology                   |
| --------------------- | ---------------------------- |
| Backend               | Elysia running on Bun        |
| Frontend              | Vite + TanStack Router       |
| SQL builder           | Kysely                       |
| Authentication        | Better Auth + API Key plugin |
| Primary database      | PostgreSQL                   |
| Cache / rate limiting | Redis                        |
| Logging               | Pino                         |
| Error monitoring      | Sentry                       |
| Hosting               | VPS                          |
| Reverse proxy         | Nginx                        |

PostgreSQL is the production database for the MVP. SQLite is acceptable for local experimentation only, not for the deployed MVP.

---

## 3. Scope Boundary

This TRD covers the technical design for the MVP defined in the PRD.

### 3.1 In Scope

The MVP includes:

1. User authentication.
2. API key management.
3. Short-link creation through REST API.
4. Short-link creation through dashboard.
5. Public redirect handling.
6. Custom aliases.
7. Link expiration.
8. Manual link disablement.
9. Soft deletion.
10. Link management through API.
11. Link management through dashboard.
12. Basic privacy-conscious analytics.
13. URL validation.
14. Rate limiting.
15. Basic abuse-prevention controls.
16. Minimal admin controls for disabling abusive links.

### 3.2 Out of Scope

The following are explicitly excluded from the MVP:

- Anonymous link creation.
- Team workspaces.
- Organization accounts.
- Billing or subscriptions.
- User-owned custom domains.
- QR code generation.
- Browser extension.
- Mobile app.
- Link-in-bio pages.
- UTM campaign builder.
- A/B destination testing.
- Retargeting pixels.
- Tracking cookies.
- Fingerprinting.
- Unique visitor analytics.
- Password-protected links.
- One-time-use links.
- Webhooks.
- SDKs.
- CLI.
- Bulk link creation.
- Enterprise SSO.
- Full moderation dashboard.
- Advanced malware scanning.

---

## 4. Architecture Overview

### 4.1 High-Level Architecture

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
                  +--> Redis for rate limits and cache
                  +--> Pino structured logging
```

### 4.2 Deployment Shape

For MVP, skrol will run as a single VPS deployment containing:

- Reverse proxy.
- Elysia backend process.
- Built Vite frontend assets.
- PostgreSQL database.
- Redis instance.
- Log output using Pino.
- Deployment and migration scripts.

The redirect path, API, and dashboard may share the same Elysia backend. The redirect path must remain minimal and performance-sensitive.

---

## 5. Technology Stack

## 5.1 Backend

The backend will use **Elysia** running on **Bun**.

Responsibilities:

- REST API endpoints.
- Public redirect route.
- Dashboard auth integration.
- Better Auth API Key plugin authentication.
- URL validation.
- Short-code generation.
- Link lifecycle management.
- Click analytics ingestion.
- Rate-limit enforcement.
- Admin disable/flag controls.

## 5.2 Frontend

The frontend dashboard will use:

- Vite.
- TanStack Router.
- TypeScript.

The dashboard is a utility interface, not the primary product surface. It must support:

- Signup.
- Login.
- Links list.
- Link detail.
- Create link.
- Better Auth API Key plugin records.
- Account settings.
- Minimal admin controls where applicable.

## 5.3 SQL Access

The application will use **Kysely** as the SQL query builder.

Rationale:

- Explicit SQL behavior.
- Type-safe query construction.
- Good fit for PostgreSQL.
- Avoids unnecessary ORM abstraction.
- Preserves control over indexes, joins, transactions, and migrations.

## 5.4 Authentication

The application will use **Better Auth** for dashboard authentication, session management, and API key management through the Better Auth API Key plugin.

API authentication will use Better Auth's API Key plugin. API keys remain separate from dashboard session cookies, but API-key creation, storage, verification, expiration, revocation, and metadata are managed through Better Auth's API Key plugin.

## 5.5 Primary Database

The production database will be **PostgreSQL**.

Rationale:

- Durable relational storage for Better Auth users and API keys, plus skrol-owned links, click events, and audit logs.
- Strong support for concurrent read/write workloads.
- Unique constraints for short codes and aliases.
- Indexed lookup for redirect performance.
- Better fit than SQLite for public redirects and analytics ingestion.
- Compatible with Kysely and Better Auth.

SQLite is rejected for production MVP because skrol has public redirect traffic, event ingestion, authentication, API keys, audit logs, and privacy-sensitive analytics. SQLite may be used only for isolated local experiments if needed.

## 5.6 Redis

Redis will be used for:

- Rate-limit counters.
- Temporary cache entries.
- Optional hot redirect cache.
- Short-lived operational state.

Redis must not be the source of truth for:

- Users.
- Better Auth API Key plugin records.
- Links.
- Click events.
- Audit logs.

## 5.7 Logging

The application will use **Pino** for structured JSON application logging.

Logging must avoid recording:

- Raw passwords.
- Raw API keys.
- Password hashes.
- API key hashes.
- Long-term raw IP analytics.
- Full user-agent strings in analytics records.
- Sensitive authorization headers.

## 5.8 Error Monitoring

The application will use **Sentry** for production error monitoring.

Responsibilities:

- Capture uncaught backend exceptions.
- Capture unhandled promise rejections.
- Capture frontend runtime errors.
- Group and triage production issues.
- Provide release-aware error visibility after deployments.

Sentry must be configured with privacy-preserving event scrubbing. It must not capture raw passwords, raw API keys, authorization headers, session cookies, or sensitive request bodies.

## 5.9 Bot Challenge Provider

The MVP may use **Cloudflare Turnstile** for selective bot and abuse protection.

Turnstile should be used for high-abuse human-submitted surfaces, not for every public redirect.

Recommended protected surfaces:

- Signup form.
- Login form after suspicious behavior.
- Link creation form after suspicious behavior.
- API key creation form after suspicious behavior.
- Future public abuse report form, if added.

Turnstile should not be placed directly in the normal `GET /:code` redirect path because that would degrade the core short-link experience and interfere with legitimate visitors.

## 5.10 Hosting

The app will be hosted on a VPS.

Required VPS components:

- Linux server.
- Bun runtime.
- PostgreSQL.
- Redis.
- Nginx.
- TLS certificate automation, typically using Certbot with Nginx.
- Process manager such as systemd or Docker Compose.
- Backup mechanism.
- Log rotation.

---

## 6. Runtime Environments

## 6.1 Local Development

Local development should support:

- Backend hot reload.
- Frontend dev server.
- Local PostgreSQL.
- Local Redis.
- Seed data.
- Test API keys.
- Disposable development database.

Recommended local services:

```text
app-backend
app-frontend
postgres
redis
```

## 6.2 Production

Production must use:

- PostgreSQL.
- Redis.
- HTTPS.
- Secure cookies.
- Production logging.
- Database backups.
- Explicit environment variables.
- Migration workflow.

## 6.3 Environment Variables

Required variables:

```text
NODE_ENV=production
APP_ENV=production
APP_BASE_URL=https://skrol.ink
API_BASE_URL=https://skrol.ink/api
DATABASE_URL=postgres://...
REDIS_URL=redis://...
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=https://skrol.ink
# API_KEY_PEPPER is not required unless a custom API-key strategy is used.
API_KEY_PEPPER=...
SESSION_COOKIE_DOMAIN=skrol.ink
LOG_LEVEL=info
```

Optional variables:

```text
GEOLITE_DB_PATH=...
BLOCKLIST_SOURCE_PATH=...
ADMIN_EMAILS=...
RATE_LIMIT_PREFIX=skrol
```

Secrets must not be committed to version control.

---

## 7. Data Model

The exact Better Auth tables, including API Key plugin tables, may be generated by Better Auth. skrol-owned product tables must be defined explicitly.

## 7.1 Users

User storage may be managed by Better Auth. skrol must be able to associate application records with user IDs.

Required logical fields:

| Field        | Type        | Notes             |
| ------------ | ----------- | ----------------- |
| `id`         | text / uuid | Primary key       |
| `email`      | text        | Unique            |
| `role`       | text        | `user` or `admin` |
| `created_at` | timestamptz | Required          |
| `updated_at` | timestamptz | Required          |

If Better Auth does not provide `role`, skrol must maintain a separate profile or user metadata table.

## 7.2 API Keys

API key records are managed by Better Auth's API Key plugin.

The physical API-key table is generated by Better Auth. skrol must not define a separate `api_keys` table unless the Better Auth API Key plugin cannot satisfy a required MVP constraint.

Rules:

- API key creation, storage, verification, expiration, revocation, and metadata are handled by Better Auth's API Key plugin.
- Raw API keys must not be stored in plaintext.
- Invalid, expired, disabled, or deleted API keys cannot authenticate.
- API key hashes must never be exposed through skrol API responses.

## 7.3 Links

Table: `links`

| Column            |        Type | Required | Notes                                      |
| ----------------- | ----------: | -------: | ------------------------------------------ |
| `id`              |        text |      yes | Primary key, e.g. `link_...`               |
| `user_id`         |        text |      yes | Owner                                      |
| `code`            |        text |      yes | Unique lowercase short code                |
| `destination_url` |        text |      yes | Validated HTTP/HTTPS URL                   |
| `title`           |        text |       no | Optional display title                     |
| `status`          |        text |      yes | `active`, `disabled`, `flagged`, `deleted` |
| `expires_at`      | timestamptz |       no | Null means no expiration                   |
| `created_at`      | timestamptz |      yes | Creation timestamp                         |
| `updated_at`      | timestamptz |      yes | Last mutation timestamp                    |
| `deleted_at`      | timestamptz |       no | Soft-delete timestamp                      |

Rules:

- `code` is stored lowercase.
- Custom aliases are case-insensitive.
- Generated short codes use lowercase alphanumeric characters.
- Deleted links are excluded from default user lists.
- Disabled and flagged links do not redirect.
- Expiration is computed from `expires_at`; no separate `expired` status is required.

## 7.4 Click Events

Table: `click_events`

| Column            |        Type | Required | Notes                                           |
| ----------------- | ----------: | -------: | ----------------------------------------------- |
| `id`              |        text |      yes | Primary key, e.g. `clk_...`                     |
| `link_id`         |        text |      yes | References link                                 |
| `clicked_at`      | timestamptz |      yes | Event timestamp                                 |
| `referrer_domain` |        text |       no | Normalized domain only                          |
| `country`         |        text |       no | ISO country code if implemented                 |
| `browser`         |        text |       no | Browser family                                  |
| `os`              |        text |       no | Operating system family                         |
| `device`          |        text |       no | `desktop`, `mobile`, `tablet`, `bot`, `unknown` |
| `is_bot`          |     boolean |      yes | Bot classification                              |

Forbidden long-term fields:

- Raw IP address.
- Full user-agent string.
- Cookie identifiers.
- Fingerprint identifiers.
- Per-visitor identity.

## 7.5 Link Audit Logs

Table: `link_audit_logs`

| Column           |        Type | Required | Notes                       |
| ---------------- | ----------: | -------: | --------------------------- |
| `id`             |        text |      yes | Primary key, e.g. `aud_...` |
| `link_id`        |        text |      yes | Link being modified         |
| `user_id`        |        text |       no | Actor if known              |
| `action`         |        text |      yes | Audited action              |
| `previous_value` |       jsonb |       no | Previous value snapshot     |
| `new_value`      |       jsonb |       no | New value snapshot          |
| `created_at`     | timestamptz |      yes | Audit timestamp             |

Required audited actions:

- Destination URL changed.
- Link disabled.
- Link re-enabled.
- Link deleted.
- Link flagged by admin.
- Link unflagged by admin.

---

## 8. Database Constraints and Indexes

## 8.1 Required Constraints

```sql
ALTER TABLE links
  ADD CONSTRAINT links_code_unique UNIQUE (code);

ALTER TABLE links
  ADD CONSTRAINT links_status_check
  CHECK (status IN ('active', 'disabled', 'flagged', 'deleted'));

ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('user', 'admin'));
```

If roles are stored outside a `users` table, apply the role constraint to the skrol-owned user metadata table.

## 8.2 Required Indexes

```sql
CREATE UNIQUE INDEX links_code_unique_idx ON links(code);
CREATE INDEX links_user_id_idx ON links(user_id);
CREATE INDEX links_user_id_created_at_idx ON links(user_id, created_at DESC);
CREATE INDEX click_events_link_id_idx ON click_events(link_id);
CREATE INDEX click_events_clicked_at_idx ON click_events(clicked_at);
CREATE INDEX click_events_link_id_clicked_at_idx ON click_events(link_id, clicked_at DESC);
-- API-key indexes are managed by Better Auth's generated API Key plugin schema.
CREATE INDEX link_audit_logs_link_id_idx ON link_audit_logs(link_id);
```

## 8.3 Optional Future Indexes

If click volume grows:

```sql
CREATE INDEX click_events_link_id_date_idx
ON click_events(link_id, date_trunc('day', clicked_at));
```

If dashboard search is added:

```sql
CREATE INDEX links_destination_url_trgm_idx ON links USING gin (destination_url gin_trgm_ops);
```

The trigram index is not required for MVP.

---

## 9. Authentication and Authorization

## 9.1 Dashboard Authentication

Dashboard authentication uses Better Auth.

Requirements:

- Users can sign up.
- Users can log in.
- Users can log out.
- Sessions use secure HTTP-only cookies in production.
- Private dashboard routes require an authenticated session.
- Logged-out users cannot create links.
- Logged-out users cannot access dashboard pages.

Session cookie requirements:

```text
httpOnly: true
secure: true in production
sameSite: Lax
path: /
```

## 9.2 API Authentication

API requests use Better Auth API Key plugin authentication.

Example:

```http
Authorization: Bearer sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Authentication flow:

1. Extract the API key from the configured request header.
2. Verify the API key using Better Auth's API Key plugin.
3. Reject invalid, expired, disabled, or deleted API keys.
4. Resolve the authenticated user from the Better Auth API Key plugin result.
5. Continue request under the resolved authenticated API principal.
6. Apply skrol ownership and authorization checks.

Missing, invalid, expired, disabled, or deleted API keys return `401 Unauthorized`.

## 9.3 API Key Format

MVP key format:

```text
sk_live_<random_secret>
```

Requirements:

- API key generation must use Better Auth's API Key plugin.
- The API key format should use a skrol-compatible prefix where supported.
- Raw key material must not be stored in plaintext.
- API key hashes must not be exposed to clients.

Recommended visible prefix:

```text
sk_live_abcd1234
```

## 9.4 Password and Secret Handling

Passwords are managed by Better Auth. If skrol must configure password hashing, use a modern password hashing algorithm such as Argon2id or bcrypt.

API key storage:

- API key storage is handled by Better Auth's API Key plugin.
- Do not disable API-key hashing unless explicitly documented and reviewed.
- Never log raw keys.
- Never return key hashes.

## 9.5 Authorization Rules

Users may only access their own resources.

Rules:

- A user can list only their own links.
- A user can view only their own links.
- A user can update only their own links.
- A user can delete only their own links.
- A user can list only their own Better Auth API keys.
- A user can revoke only their own Better Auth API keys.
- Admin users may inspect and disable/flag links for abuse response.

---

## 10. API Design

## 10.1 API Versioning

All public API endpoints use `/api/v1`.

## 10.2 Error Format

All API errors must follow this structure:

```json
{
	"error": {
		"code": "alias_taken",
		"message": "This alias is already in use."
	}
}
```

## 10.3 Error Codes

| Code               | HTTP Status | Meaning                                 |
| ------------------ | ----------: | --------------------------------------- |
| `unauthorized`     |         401 | Missing, invalid, or revoked auth       |
| `forbidden`        |         403 | Authenticated but not allowed           |
| `not_found`        |         404 | Resource not found                      |
| `validation_error` |         400 | Generic validation failure              |
| `alias_taken`      |         409 | Alias already exists                    |
| `reserved_alias`   |         400 | Alias conflicts with system route       |
| `invalid_url`      |         400 | URL is malformed                        |
| `unsafe_url`       |         400 | URL uses rejected scheme or destination |
| `rate_limited`     |         429 | Rate limit exceeded                     |
| `internal_error`   |         500 | Unexpected server error                 |

## 10.4 Required Endpoints

### Links

```text
POST   /api/v1/links
GET    /api/v1/links
GET    /api/v1/links/:id
PATCH  /api/v1/links/:id
DELETE /api/v1/links/:id
GET    /api/v1/links/:id/analytics
```

### API Keys

```text
POST   /api/v1/api-keys     -> delegates to Better Auth API Key plugin
GET    /api/v1/api-keys     -> delegates to Better Auth API Key plugin
DELETE /api/v1/api-keys/:id -> delegates to Better Auth API Key plugin
```

### System

```text
GET /health
```

### Redirect

```text
GET /:code
```

---

## 11. Link Creation API

## 11.1 Endpoint

```http
POST /api/v1/links
```

## 11.2 Authentication

Requires a valid Better Auth API key or authenticated dashboard session for dashboard-originated requests.

## 11.3 Request Body

```json
{
	"url": "https://example.com/very/long/path",
	"alias": "docs",
	"title": "Example Docs",
	"expires_at": "2026-12-31T23:59:59Z"
}
```

## 11.4 Validation

Rules:

- `url` is required.
- `url` must be syntactically valid.
- `url` scheme must be `http` or `https`.
- `url` must not point to forbidden local/private destinations.
- `alias` is optional.
- If provided, `alias` must match `^[a-z0-9_-]{3,64}$` after lowercasing.
- Alias must not be reserved.
- Alias must be unique.
- `title` is optional.
- `expires_at` is optional.
- If provided, `expires_at` must be a valid future timestamp.

## 11.5 Success Response

Status: `201 Created`

```json
{
	"id": "link_123",
	"short_url": "https://skrol.ink/docs",
	"code": "docs",
	"destination_url": "https://example.com/very/long/path",
	"title": "Example Docs",
	"status": "active",
	"expires_at": "2026-12-31T23:59:59Z",
	"created_at": "2026-05-12T10:00:00Z"
}
```

## 11.6 Failure Responses

| Condition           | Status | Error code         |
| ------------------- | -----: | ------------------ |
| Missing auth        |    401 | `unauthorized`     |
| Invalid URL         |    400 | `invalid_url`      |
| Unsafe URL          |    400 | `unsafe_url`       |
| Invalid alias       |    400 | `validation_error` |
| Reserved alias      |    400 | `reserved_alias`   |
| Alias already taken |    409 | `alias_taken`      |
| Rate limited        |    429 | `rate_limited`     |

---

## 12. Link Management API

## 12.1 List Links

```http
GET /api/v1/links
```

Requirements:

- Requires authentication.
- Returns only links owned by authenticated user.
- Excludes soft-deleted links by default.
- Supports pagination.

Recommended query params:

```text
limit: default 25, max 100
after: cursor
status: optional active|disabled|flagged|deleted
```

## 12.2 Get Link

```http
GET /api/v1/links/:id
```

Requirements:

- Requires authentication.
- User must own the link unless admin.
- Includes core metadata.
- Does not include raw click events by default.

## 12.3 Update Link

```http
PATCH /api/v1/links/:id
```

Allowed updates:

- `title`.
- `destination_url`.
- `expires_at`.
- `status` transitions for disable/re-enable.

Rules:

- Destination updates must pass URL validation.
- Destination changes must create audit log entry.
- Deleted links cannot be updated by normal users.

## 12.4 Delete Link

```http
DELETE /api/v1/links/:id
```

Behavior:

- Soft-delete the link.
- Set `status = 'deleted'`.
- Set `deleted_at = now()`.
- Create audit log entry.
- Exclude from default link lists.

---

## 13. Redirect Flow

## 13.1 Endpoint

```http
GET /:code
```

Example:

```http
GET https://skrol.ink/docs
```

## 13.2 Redirect Algorithm

```text
1. Receive GET /:code.
2. Normalize code to lowercase.
3. Reject reserved app routes before link lookup where applicable.
4. Lookup link by code using indexed query.
5. If no link exists, return 404 Not Found.
6. If link is deleted, return 404 Not Found.
7. If link is disabled, return 410 Gone.
8. If link is flagged, return 410 Gone.
9. If link has expires_at and expires_at <= now, return 410 Gone.
10. Derive privacy-conscious analytics metadata.
11. Insert click event without raw IP or full user-agent.
12. Return 302 Found with Location set to destination_url.
```

## 13.3 Status Codes

| Condition     | Status |
| ------------- | -----: |
| Active link   |    302 |
| Unknown code  |    404 |
| Deleted link  |    404 |
| Expired link  |    410 |
| Disabled link |    410 |
| Flagged link  |    410 |

## 13.4 Deleted Link Decision

Soft-deleted links return `404 Not Found`.

Rationale:

- Avoids confirming that a deleted short code once existed.
- Keeps deleted resources semantically absent for public visitors.
- Preserves `410 Gone` for explicit unavailable states such as expired, disabled, or flagged.

## 13.5 Redirect Method

Use `302 Found`, not `301 Moved Permanently`.

Rationale:

- Destinations may be edited later.
- `301` may be cached aggressively.
- `302` preserves operational flexibility.

## 13.6 Redirect Performance Requirements

Redirect path target:

```text
p95 latency < 100 ms, excluding external destination latency
```

Redirect implementation rules:

- Use indexed lookup by `links.code`.
- Avoid expensive joins.
- Avoid dashboard dependencies.
- Do not synchronously validate destination availability during redirect.
- Do not perform external malware checks synchronously in redirect path.
- Keep analytics insertion lightweight.

---

## 14. Short-Code Generation

## 14.1 Generated Code Rules

Default generated code:

```text
length: 7 characters
alphabet: lowercase a-z and digits 0-9
case: lowercase only
```

Possible code space:

```text
36^7 = 78,364,164,096
```

## 14.2 Generation Algorithm

```text
1. Generate random 7-character code using cryptographically secure randomness.
2. Attempt insert into links table.
3. If unique constraint violation occurs, retry with a new code.
4. Retry up to 5 times.
5. If all attempts fail, return internal_error.
```

Uniqueness must be enforced by the database, not only application logic.

## 14.3 Custom Alias Rules

Allowed characters:

```text
a-z
0-9
-
_
```

Length:

```text
minimum: 3
maximum: 64
```

Normalization:

```text
trim whitespace
lowercase
validate
store lowercase
resolve lowercase
```

## 14.4 Reserved Aliases

Reserved aliases:

```text
api
admin
app
auth
dashboard
login
logout
signup
settings
health
status
```

The alias validator must reject reserved aliases.

---

## 15. URL Validation

## 15.1 Allowed Schemes

Allowed:

```text
http
https
```

Rejected:

```text
javascript
data
file
ftp
mailto
tel
any non-HTTP scheme
```

## 15.2 Forbidden Destinations

Reject destinations pointing to:

- `localhost`.
- `127.0.0.1`.
- `0.0.0.0`.
- Private IPv4 ranges.
- Private IPv6 ranges.
- Link-local addresses.
- Cloud metadata IPs.
- Blocklisted domains.

## 15.3 URL Validation Algorithm

```text
1. Parse URL using standards-compliant URL parser.
2. Reject malformed input.
3. Require scheme http or https.
4. Normalize hostname.
5. Reject localhost and local-only hostnames.
6. If hostname is an IP address, reject private, loopback, link-local, and metadata addresses.
7. If hostname is a domain, check domain blocklist.
8. Store normalized URL string.
```

## 15.4 Server-Side Fetching

The MVP must not fetch destination URLs during creation or redirect.

Rationale:

- Avoids unnecessary latency.
- Avoids SSRF exposure.
- Keeps validation deterministic.
- Avoids false negatives from temporarily unavailable destinations.

---

## 16. Analytics Pipeline

## 16.1 Analytics Philosophy

Analytics must remain aggregate and privacy-conscious.

The system must not implement:

- Tracking cookies.
- Cross-site user identity.
- Device fingerprinting.
- Persistent raw IP storage.
- Long-term full user-agent storage.
- Individual clickstream profiles.

## 16.2 Click Event Capture

On successful redirect, the system may derive:

| Field             | Source                          |               Stored |
| ----------------- | ------------------------------- | -------------------: |
| `link_id`         | Link lookup                     |                  yes |
| `clicked_at`      | Server time                     |                  yes |
| `referrer_domain` | `Referer` header                |     yes, domain only |
| `country`         | Derived from IP, if implemented |             optional |
| `browser`         | Derived from user-agent         |                  yes |
| `os`              | Derived from user-agent         |                  yes |
| `device`          | Derived from user-agent         |                  yes |
| `is_bot`          | User-agent heuristic            |                  yes |
| Raw IP            | Request metadata                | no long-term storage |
| Full user-agent   | Request header                  | no long-term storage |

## 16.3 Geolocation Decision

Geolocation is optional for MVP.

Default MVP decision:

```text
Defer geolocation unless a local, privacy-conscious GeoIP database is added without external request-time calls.
```

If implemented:

- Use a local GeoIP database.
- Derive country code in memory.
- Store country code only.
- Do not store raw IP in `click_events`.
- Do not call external geolocation APIs during redirect.

## 16.4 Bot Detection

MVP bot detection uses a basic user-agent parser or heuristic.

Requirements:

- Classify obvious bots as `is_bot = true`.
- Avoid complex fingerprinting.
- Do not block bots by default.
- Use bot flag for analytics classification only.

## 16.5 Analytics Queries

Dashboard analytics must support:

- Total clicks.
- Clicks over time.
- Referrer domain breakdown.
- Device breakdown.
- Browser breakdown.
- Country breakdown if geolocation is implemented.

Example queries:

```sql
SELECT count(*)
FROM click_events
WHERE link_id = $1;
```

```sql
SELECT date_trunc('day', clicked_at) AS day, count(*)
FROM click_events
WHERE link_id = $1
GROUP BY day
ORDER BY day;
```

```sql
SELECT referrer_domain, count(*)
FROM click_events
WHERE link_id = $1
GROUP BY referrer_domain
ORDER BY count(*) DESC
LIMIT 20;
```

---

## 17. Rate Limiting

## 17.1 Mechanism

Production rate limiting uses Redis.

Acceptable algorithms:

- Fixed window with short TTL.
- Sliding window.
- Token bucket.

MVP recommendation:

```text
Redis fixed window or sliding window counters are acceptable.
```

In-memory rate limiting is allowed only for local development.

## 17.2 Rate-Limit Buckets

| Area               | Key                                         |          Limit |
| ------------------ | ------------------------------------------- | -------------: |
| Link creation      | `user:{user_id}:link_create`                |         60/min |
| Link list/read API | `user:{user_id}:api_read`                   |        300/min |
| API key creation   | Better Auth API Key plugin or skrol wrapper |        10/hour |
| Login attempts     | `ip:{ip}:login` plus `email:{email}:login`  |      10/15 min |
| Public redirects   | `ip:{ip}:redirect`                          | High threshold |

## 17.3 Rate-Limited Response

Status: `429 Too Many Requests`

```json
{
	"error": {
		"code": "rate_limited",
		"message": "Too many requests. Please try again later."
	}
}
```

Where practical, include:

```http
Retry-After: <seconds>
```

## 17.4 Redirect Rate Limits

Redirect rate limits must be high enough not to block normal usage. They exist primarily to reduce abusive automated traffic.

Redirect rate limiting should not require user authentication.

---

## 18. Abuse Prevention and Admin Controls

## 18.1 Abuse Risks

Primary risks:

- Phishing links.
- Spam links.
- Malware redirection.
- Link obfuscation for suspicious destinations.
- Alias squatting on system-like routes.
- Bot traffic polluting analytics.
- API key leakage.

## 18.2 MVP Abuse Controls

Required controls:

- No anonymous link creation.
- URL scheme validation.
- Private/local destination rejection.
- Reserved alias rejection.
- Domain blocklist support.
- Rate-limited link creation.
- Admin ability to disable links.
- Admin ability to flag links.
- Audit log for admin actions.

## 18.3 Cloudflare Turnstile Decision

Cloudflare Turnstile is approved as an optional anti-abuse layer, but it is not the primary bot-detection mechanism for redirect analytics.

Use Turnstile for:

- Signup abuse prevention.
- Login abuse mitigation after suspicious attempts.
- Link creation abuse mitigation.
- API key creation abuse mitigation.

Do not use Turnstile for:

- Normal public redirects.
- Analytics bot classification.
- Every authenticated dashboard request.

Rationale:

- skrol's core product experience depends on fast, low-friction redirects.
- Challenging redirect visitors would make short links less reliable and less transparent.
- Bot classification for analytics can be handled separately through lightweight user-agent heuristics.
- Turnstile is more appropriate for protecting form submissions and account-abuse surfaces.

Implementation model:

```text
1. Frontend renders Turnstile widget on protected forms when required.
2. Browser receives Turnstile token.
3. Frontend submits token with form request.
4. Backend verifies token with Cloudflare.
5. Backend rejects request if verification fails.
6. Backend does not store Turnstile token after verification.
```

## 18.4 Domain Blocklist

The blocklist may initially be a static configuration file or database table.

Minimum behavior:

- Reject link creation if destination hostname matches blocklisted domain.
- Reject link update if new destination hostname matches blocklisted domain.
- Return `unsafe_url` error.

## 18.5 Admin Controls

MVP admin controls may be implemented as a minimal admin route or internal script.

Required admin capabilities:

- Search link by code.
- View link metadata.
- Disable link.
- Mark link as flagged.
- View audit log for link.

Admin actions must be authenticated and audited.

## 18.6 Admin Authorization

Admin access requires:

- Authenticated dashboard session.
- User role equals `admin`.

If admin actions are implemented as an internal script, the script must require explicit server access and must still write audit records.

---

## 19. Dashboard Technical Requirements

## 19.1 Required Pages

Dashboard pages:

1. Login.
2. Signup.
3. Links list.
4. Link detail.
5. Create link.
6. API keys.
7. Account settings.

Admin-only pages or routes:

1. Link lookup by code.
2. Link abuse action page.

Admin pages may be deferred if an internal script provides equivalent MVP capability.

## 19.2 Frontend Routing

Use TanStack Router.

Suggested routes:

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

## 19.3 Dashboard API Access

Dashboard may call backend endpoints using session authentication.

Rules:

- Dashboard routes require session auth.
- API routes must distinguish session-authenticated dashboard requests from bearer-token API requests.
- Ownership checks apply in both cases.

## 19.4 Required UI States

The dashboard must handle:

- Empty links list.
- Empty analytics state.
- Invalid URL error.
- Alias already taken error.
- Reserved alias error.
- Expired link state.
- Disabled link state.
- Deleted link state.
- API key created state.
- API key revoked state.
- Rate-limited state.

---

## 20. Security Requirements

## 20.1 Transport Security

Production must use HTTPS.

Recommended setup:

- Nginx with Certbot.

## 20.2 Input Validation

Validate:

- URLs.
- Aliases.
- Titles.
- Timestamps.
- Pagination params.
- API key names.
- Route params.

## 20.3 Output Safety

The dashboard must avoid rendering user-controlled fields unsafely.

Fields requiring escaping:

- Link title.
- Destination URL display text.
- Referrer domains.
- API key names.

## 20.4 API Key Safety

Rules:

- Better Auth API Key plugin manages key creation, storage, verification, expiration, revocation, and deletion.
- Raw key material must not be stored in plaintext.
- Raw key material must never be logged.
- Invalid, expired, disabled, or deleted keys must be rejected.
- Key hashes must never be returned to clients.

## 20.5 Session Safety

Rules:

- HTTP-only cookies.
- Secure cookies in production.
- SameSite cookie protection.
- CSRF protection for state-changing dashboard requests where applicable.

## 20.6 Authorization Safety

All link endpoints and Better Auth API Key plugin routes or wrappers must enforce ownership.

Failure to find an owned resource should generally return `404`, not `403`, to avoid leaking cross-user resource existence.

---

## 21. Privacy Requirements

## 21.1 Analytics Privacy

The redirect path must not set analytics cookies.

The click event table must not contain:

- Raw IP address.
- Full user-agent string.
- Cookie ID.
- Fingerprint ID.
- Visitor ID.

## 21.2 Operational Logs

Operational logs may contain transient request metadata needed for debugging and abuse response, but must be minimized.

Required controls:

- Do not log authorization headers.
- Do not log raw API keys.
- Do not log passwords.
- Avoid logging full request bodies by default.
- Apply log retention.

## 21.3 Privacy Note

The product must include a basic privacy note explaining:

- What click data is collected.
- What is not collected.
- No tracking cookies by default.
- No fingerprinting.
- No long-term raw IP storage in analytics.

---

## 22. Observability, Logging, and Error Monitoring

## 22.1 Pino Logging

Logs must be structured JSON.

Recommended base fields:

```json
{
	"level": "info",
	"time": "2026-05-12T10:00:00.000Z",
	"request_id": "req_123",
	"method": "POST",
	"path": "/api/v1/links",
	"status": 201,
	"duration_ms": 42
}
```

## 22.2 Sentry Error Monitoring

Sentry must be integrated into both backend and frontend production builds.

Backend requirements:

- Initialize Sentry before application routes are registered.
- Capture uncaught exceptions.
- Capture unhandled promise rejections.
- Attach request ID where possible.
- Attach environment and release version.
- Scrub sensitive headers and request bodies.

Frontend requirements:

- Capture dashboard runtime errors.
- Attach release version.
- Avoid recording sensitive form values.
- Disable or restrict session replay unless explicitly reviewed for privacy impact.

Required Sentry configuration rules:

```text
sendDefaultPii: false
scrub Authorization header
scrub Cookie header
scrub raw API keys
scrub passwords
sample performance traces conservatively
```

Sentry is for error monitoring, not product analytics.

## 22.3 Request IDs

Each request should receive a request ID.

Request ID should be:

- Accepted from trusted reverse proxy header if present.
- Generated if absent.
- Included in logs.
- Returned in response headers where practical.

Example:

```http
X-Request-ID: req_123
```

## 22.4 Metrics to Track

Engineering metrics:

- Redirect p95 latency.
- API p95 latency.
- Redirect error rate.
- API error rate.
- Link creation success rate.
- Generated-code collision rate.
- Rate-limit trigger count.
- Failed API authentication attempts.

Product metrics:

- Number of registered users.
- Number of API keys created.
- Number of links created.
- Number of custom aliases created.
- Number of redirects served.
- Number of expired links.
- Number of disabled links.
- Number of blocklisted destination attempts.

Privacy metrics:

- Number of tracking cookies set by redirect path; target is zero.
- Percentage of click events stored without raw IP; target is 100%.
- Operational log retention duration.

## 22.5 Log and Error Retention

Recommended MVP retention:

```text
Application logs: 7 to 30 days
Nginx access logs: 7 to 30 days
Sentry event retention: according to configured Sentry project retention
Database backups: 7 to 30 days depending on storage cost
```

The exact production value must be documented before launch.

---

## 23. Performance Requirements

## 23.1 Targets

| Area                   |                                          Target |
| ---------------------- | ----------------------------------------------: |
| Redirect p95 latency   | < 100 ms excluding external destination latency |
| API p95 latency        |                    < 300 ms for normal requests |
| Link creation          |                < 500 ms under normal conditions |
| Dashboard initial load |             < 2 seconds under normal conditions |

## 23.2 Redirect Optimization

Required:

- Unique indexed lookup by `links.code`.
- Minimal data selection.
- No external network calls.
- Lightweight analytics insert.
- Optional Redis cache for hot links if needed.

## 23.3 Optional Redirect Cache

Redis may cache active link resolution:

```text
key: link_code:{code}
value: destination/status/expires_at
TTL: 30 to 300 seconds
```

Cache invalidation required on:

- Destination update.
- Disable.
- Re-enable.
- Delete.
- Flag.
- Expiration update.

For MVP, database-only lookup is acceptable until measured latency requires caching.

---

## 24. Reliability and Failure Modes

## 24.1 Database Failure

If PostgreSQL is unavailable:

- API requests return `503 Service Unavailable` or `500 internal_error`.
- Redirects cannot reliably resolve links and should return a controlled `503`.
- Health check must fail.

## 24.2 Redis Failure

If Redis is unavailable:

- Rate limiting may fail closed or fail open depending on endpoint risk.
- Login and link creation should fail closed if abuse risk is high.
- Redirects may fail open for rate limiting but continue database lookup.
- Application must log Redis outage.

Recommended default:

```text
Auth-sensitive endpoints: fail closed
Public redirects: fail open for rate-limit layer only
```

## 24.3 Analytics Insert Failure

If click event insertion fails:

- Redirect should still proceed if link is valid.
- Error should be logged.
- Analytics loss is acceptable; redirect availability has priority.

## 24.4 Destination Availability

The app does not check destination availability during redirect.

If destination site is down, skrol still returns `302` to the configured destination.

---

## 25. Deployment and Infrastructure

## 25.1 Reverse Proxy

Use Nginx explicitly for the MVP reverse proxy.

Responsibilities:

- Terminate TLS.
- Serve frontend static assets.
- Proxy `/api/*` to Elysia backend.
- Proxy `/:code` requests to Elysia backend.
- Add request ID header if possible.
- Enforce reasonable request body limits.
- Apply basic IP allow/deny rules if needed.
- Emit access logs with privacy-conscious retention.

TLS should be provisioned using Certbot or an equivalent ACME client.

## 25.2 Process Management

Acceptable options:

- systemd service.
- Docker Compose.
- supervised Bun process.

Recommended MVP:

```text
Docker Compose or systemd, whichever is simpler for the operator.
```

## 25.3 Database Migrations

Migrations must be version-controlled.

Rules:

- No manual production schema drift.
- Migrations must run before app deployment when required.
- Destructive migrations require backup first.
- Better Auth-generated schema changes must be reviewed.

## 25.4 Backups

PostgreSQL backups are required before MVP release.

Minimum backup policy:

- Daily database backup.
- Store backup outside the active database directory.
- Periodically test restore.
- Document restore command.

## 25.5 Deployment Steps

Typical deployment:

```text
1. Pull latest code.
2. Install dependencies.
3. Build frontend.
4. Build or prepare backend.
5. Run database migrations.
6. Restart backend process.
7. Restart backend process.
8. Reload Nginx if config changed.
9. Confirm Sentry release visibility.
10. Run health check.
11. Verify redirect route.
```

---

## 26. Testing Strategy

## 26.1 Unit Tests

Required unit test areas:

- URL validation.
- Alias validation.
- Reserved alias rejection.
- Short-code generation.
- API key hashing/comparison.
- Error response formatting.
- Referrer domain normalization.
- Bot detection heuristic.

## 26.2 Integration Tests

Required integration tests:

- User signup/login flow.
- API key creation and revocation through Better Auth API Key plugin.
- Link creation with generated code.
- Link creation with custom alias.
- Duplicate alias rejection.
- Invalid URL rejection.
- Unsafe URL rejection.
- Link update ownership checks.
- Soft deletion.
- Redirect success.
- Expired link returns `410`.
- Disabled link returns `410`.
- Deleted link returns `404`.
- Analytics event inserted on redirect.
- Raw IP not stored in click event.

## 26.3 API Contract Tests

Required:

- Response status codes.
- Error code consistency.
- Required fields.
- Auth rejection cases.
- Pagination behavior.

## 26.4 Security Tests

Required:

- Missing auth rejected.
- Invalid API key rejected.
- User cannot revoke another user's Better Auth API key.
- User cannot access another user's links.
- User cannot revoke another user's API key.
- Reserved aliases rejected.
- Private IP URLs rejected.
- Non-HTTP schemes rejected.

## 26.5 Performance Checks

Before release, test:

- Redirect lookup latency.
- Link creation latency.
- API list latency with sample data.
- Analytics aggregation queries with sample click events.

---

## 27. Implementation Phases

## Phase 1: Core Redirect System

Deliverables:

- PostgreSQL schema for links and click events.
- Kysely database setup.
- Short-code generation.
- URL validation.
- Public redirect route.
- Basic click event insertion.

## Phase 2: Authentication and Dashboard Basics

Deliverables:

- Better Auth integration.
- Signup.
- Login.
- Logout.
- Protected dashboard routes.
- Links list page.
- Create-link page.
- Link detail page.

## Phase 3: API-First Layer

Deliverables:

- Better Auth API Key plugin installation.
- Better Auth API Key plugin schema generation.
- API key creation and revocation through Better Auth.
- API key verification middleware for skrol API routes.
- Link creation API.
- Link management API.
- Consistent API errors.

## Phase 4: Analytics

Deliverables:

- Click event normalization.
- Total clicks.
- Clicks over time.
- Referrer domain aggregation.
- Device/browser aggregation.
- Optional country aggregation.

## Phase 5: Safety and Operations

Deliverables:

- Redis rate limiting.
- Domain blocklist.
- Admin disable/flag control.
- Audit logs.
- Pino structured logging.
- Health check.
- Backup plan.
- Privacy note.
- Basic API documentation.

---

## 28. Acceptance Criteria Traceability

| PRD Requirement             | TRD Coverage                                                                                       |
| --------------------------- | -------------------------------------------------------------------------------------------------- |
| User authentication         | Better Auth, dashboard auth, session rules                                                         |
| API key management          | Better Auth API Key plugin configuration, generated schema, creation, verification, and revocation |
| REST link creation          | `POST /api/v1/links` contract                                                                      |
| Dashboard link creation     | Vite/TanStack dashboard requirements                                                               |
| Public redirects            | `GET /:code` algorithm                                                                             |
| Custom aliases              | Alias validation and constraints                                                                   |
| Link expiration             | Redirect expiration logic                                                                          |
| Manual disablement          | Link status and admin/user controls                                                                |
| Soft deletion               | `deleted_at`, `status=deleted`, public `404`                                                       |
| Link management API         | List, get, patch, delete endpoints                                                                 |
| Basic analytics             | Click events and aggregation queries                                                               |
| URL validation              | Scheme and destination validation                                                                  |
| Rate limiting               | Redis buckets and limits                                                                           |
| Abuse prevention            | Blocklist, admin controls, validation                                                              |
| Admin disablement           | Admin controls and audit logs                                                                      |
| Privacy-conscious analytics | No raw IP/full UA in click events                                                                  |
| Performance                 | Latency targets and indexes                                                                        |
| Reliability                 | failure modes and backup requirements                                                              |
| Security                    | auth, hashing, HTTPS, ownership checks                                                             |

---

## 29. Open Technical Decisions

The following decisions should be finalized during implementation:

| Decision                                 | Default TRD Position                                                                                        |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Reverse proxy                            | Nginx preferred for automatic TLS; Nginx acceptable                                                         |
| Process manager                          | systemd or Docker Compose                                                                                   |
| Migration tool                           | Kysely-compatible migration workflow                                                                        |
| Better Auth API Key plugin configuration | Header style, prefix format, user-owned keys, expiration policy, metadata usage, and rate-limit interaction |
| Geolocation                              | Deferred unless local GeoIP is easy to add                                                                  |
| Bot detection library                    | Basic user-agent parser or simple heuristic                                                                 |
| Operational log retention                | 7–30 days; exact value before launch                                                                        |
| Redirect caching                         | Defer until measured need                                                                                   |
| Admin UI                                 | Minimal route or internal script for MVP                                                                    |
| Public API docs                          | Basic docs required before release                                                                          |

---

## 30. Final MVP Technical Definition

The skrol MVP will be a VPS-hosted, Elysia-based web application with a Vite/TanStack Router dashboard, Nginx reverse proxy, PostgreSQL persistence through Kysely, Better Auth dashboard authentication, Better Auth API Key plugin authentication for skrol API requests, Redis-backed rate limiting, Pino structured logging, and Sentry error monitoring.

The system will support authenticated short-link creation, custom aliases, expiration, disablement, soft deletion, public `302` redirects, privacy-conscious click analytics, and basic abuse controls. PostgreSQL is the production source of truth. Redis is used only for cache and rate-limiting concerns. The redirect path is public, minimal, indexed, and optimized for reliability. Analytics must remain aggregate and must not persist raw IP addresses, full user-agent strings, cookies, fingerprints, or per-visitor identities.
