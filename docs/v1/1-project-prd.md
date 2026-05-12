# skrol Product Requirements Document v1

## 1. Document Control

**Product:** skrol
**Domain:** `skrol.ink`
**Document type:** Product Requirements Document
**Version:** v1
**Status:** MVP scope locked
**Primary audience:** Product owner, engineering, future technical contributors
**Product category:** API-first, privacy-conscious URL shortener

---

## 2. Executive Summary

skrol is an API-first, privacy-conscious URL shortener for developers and technical users. It allows authenticated users to create, manage, expire, disable, and inspect short links through a REST API and a minimal web dashboard.

The MVP is intentionally narrow. skrol is not a marketing automation platform, team collaboration product, or analytics surveillance tool. It is a developer-oriented utility that prioritizes clean API design, fast redirects, simple lifecycle controls, and limited aggregate analytics.

The canonical short-link domain for the MVP is:

`https://skrol.ink`

Example short link:

`https://skrol.ink/docs`

---

## 3. Product Thesis

Developers sometimes need to create short links from scripts, backend services, bots, automations, newsletters, or internal tools. Existing commercial shorteners often emphasize marketing workflows, attribution, team management, and tracking-heavy analytics.

skrol addresses a narrower need:

> Provide developers with a simple, reliable, API-first URL shortener that supports useful link management while avoiding invasive tracking by default.

The product should be technically credible, privacy-conscious, and small enough to complete as a serious pet project.

---

## 4. Problem Statement

Long URLs are inconvenient to share, especially in automated messages, documentation, notifications, chat bots, emails, and small applications. Developers often need short links that can be created programmatically and managed later.

However, many short-link services are optimized for marketing teams rather than developers. They frequently include features such as campaign tracking, retargeting, team workspaces, billing tiers, cross-device analytics, and opaque data collection. These capabilities are unnecessary for many technical users and may conflict with privacy-conscious use cases.

skrol should solve the core problem without importing unnecessary complexity:

- Create short links programmatically.
- Redirect visitors quickly and reliably.
- Support custom aliases and expiration.
- Allow users to manage links after creation.
- Provide basic aggregate analytics.
- Avoid persistent user-level tracking.

---

## 5. Target Users

## 5.1 Primary Persona: Developer User

**Profile:** A developer, technical founder, automation user, or hobbyist building apps, scripts, bots, or backend workflows.

**Needs:**

- Create short links through an API.
- Use readable aliases when helpful.
- Expire temporary links automatically.
- Inspect basic usage analytics.
- Avoid integrating a large marketing platform.
- Avoid exposing users to invasive tracking.

**Example use cases:**

- A script generates short links for notification emails.
- A Discord or Slack bot creates short links on command.
- A personal automation workflow shortens URLs before posting them.
- A developer wants clean links for documentation or demos.
- A newsletter author wants total click counts without tracking individual readers.

---

## 5.2 Secondary Persona: Technical Individual Using the Dashboard

**Profile:** A technical user who prefers a simple UI for link inspection, API key management, and occasional manual link creation.

**Needs:**

- Create a link manually.
- Copy an existing short link.
- Disable a problematic link.
- View aggregate analytics.
- Create or revoke API keys.

---

## 5.3 Operator Persona

**Profile:** The person running skrol.

**Needs:**

- Disable abusive links.
- Review link metadata.
- Prevent obvious misuse.
- Maintain service reliability.
- Keep the system simple enough to operate alone.

---

## 6. Product Positioning

skrol is positioned as:

> A developer-first short-link service with clean APIs, fast redirects, custom aliases, link expiration, and privacy-conscious analytics.

skrol is not positioned as:

- A Bitly clone.
- A marketing attribution suite.
- A retargeting platform.
- A team collaboration product.
- A link-in-bio product.
- An ad-tech product.

The product should feel small, reliable, transparent, and technically intentional.

---

## 7. Product Goals

## 7.1 MVP Goals

The MVP must allow authenticated users to:

1. Create short links through a REST API.
2. Create short links through a minimal dashboard.
3. Use custom aliases.
4. Set link expiration dates.
5. Disable and soft-delete links.
6. Redirect visitors through `skrol.ink/:code`.
7. View basic aggregate analytics.
8. Create and revoke API keys.
9. Avoid storing invasive analytics data.
10. Prevent basic abuse through validation, rate limits, and admin disablement.

---

## 7.2 Technical Learning Goals

Because this is a pet project, the MVP should also support meaningful technical learning:

- REST API design.
- API key authentication.
- Secure API key storage.
- Short-code generation and collision handling.
- Redirect performance.
- URL validation.
- Rate limiting.
- Basic analytics ingestion.
- Privacy-conscious data modeling.
- Abuse-prevention design.
- Minimal production operations.

---

## 8. Non-Goals

The following are explicitly excluded from the MVP:

- Anonymous link creation.
- Team workspaces.
- Organization accounts.
- Role-based access control beyond basic user/admin distinction.
- Billing or subscriptions.
- User-owned custom domains.
- QR code generation.
- Browser extension.
- Mobile app.
- Public link-in-bio pages.
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

These exclusions are deliberate. They preserve the MVP boundary and prevent the pet project from expanding into a full commercial short-link platform prematurely.

---

## 9. Assumptions

The PRD assumes:

1. skrol will initially serve a small user base.
2. The first production domain is `skrol.ink`.
3. Link creation requires authentication.
4. Redirects are public.
5. The product owner is also the initial operator.
6. Privacy-conscious analytics are preferable to granular visitor analytics.
7. The MVP does not require monetization.
8. Custom domains are valuable but too costly for MVP complexity.
9. A minimal dashboard is sufficient if the API is well-designed.
10. Abuse prevention is necessary even for a pet project.

---

## 10. Constraints

## 10.1 Product Constraints

- The MVP must remain small enough to build and maintain as a pet project.
- API-first behavior takes precedence over dashboard sophistication.
- Privacy requirements must not be treated as optional polish.
- Abuse-prevention basics must ship with the MVP.

## 10.2 Technical Constraints

- Short-code lookup must be fast.
- Link creation must enforce unique aliases.
- API keys must not be stored in plaintext.
- Passwords must not be stored in plaintext.
- Redirect handling must not depend on dashboard availability where avoidable.
- Long-term click analytics must not store raw IP addresses.

---

## 11. MVP Scope

The MVP includes exactly these capabilities:

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

Anything not listed here is outside MVP scope unless explicitly added through a later scope change.

---

## 12. User Journeys

## 12.1 API-First Link Creation Journey

1. User signs up.
2. User creates an API key from the dashboard.
3. User copies the API key once.
4. User sends an authenticated request to create a link.
5. skrol validates the destination URL and alias.
6. skrol creates the link.
7. API response returns the short URL.
8. User shares or stores the short URL.
9. Visitors access the short URL and are redirected.
10. User later checks aggregate analytics.

---

## 12.2 Dashboard Link Creation Journey

1. User logs in.
2. User opens the create-link page.
3. User enters a destination URL.
4. User optionally enters an alias, title, and expiration date.
5. skrol validates the input.
6. skrol creates the short link.
7. User copies the short URL.
8. User can later view or manage the link.

---

## 12.3 Redirect Journey

1. Visitor opens `https://skrol.ink/:code`.
2. skrol looks up the link by code.
3. skrol checks whether the link exists, is active, and has not expired.
4. skrol records a privacy-conscious click event.
5. skrol redirects the visitor to the destination URL using `302 Found`.

Failure cases:

- Unknown code returns `404 Not Found`.
- Expired link returns `410 Gone`.
- Disabled link returns `410 Gone`.

---

## 12.4 Link Management Journey

1. User logs in or uses the API.
2. User lists their links.
3. User opens one link.
4. User reviews destination, status, expiration, and analytics.
5. User may update title, destination, or expiration.
6. User may disable, re-enable, or soft-delete the link.

---

## 12.5 Abuse Response Journey

1. Operator identifies an abusive link through reports, logs, or manual inspection.
2. Operator searches for the link by code.
3. Operator reviews metadata.
4. Operator disables or flags the link.
5. Future visits return `410 Gone`.

---

## 13. Functional Requirements

## 13.1 Authentication

### Requirements

- Users must be able to sign up.
- Users must be able to log in.
- Users must be able to log out.
- Passwords must be hashed using a modern password hashing algorithm.
- Authenticated dashboard sessions must be protected against common web attacks.
- Link creation must require authentication.
- Anonymous users must not be able to create links in the MVP.

### Acceptance Criteria

- A new user can create an account.
- A registered user can log in.
- A logged-in user can access their dashboard.
- A logged-out user cannot access private dashboard pages.
- A logged-out user cannot create links.

---

## 13.2 API Key Management

### Requirements

- Users must be able to create API keys.
- Users must be able to name API keys.
- Users must be able to revoke API keys.
- API keys must be displayed only once at creation time.
- API keys must not be stored in plaintext.
- The system must store a hash of each API key.
- The system should store a visible key prefix for identification.
- API keys must be usable for authenticated API requests.

### Suggested API Key Format

`sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

Optional future distinction:

- `sk_test_...` for test keys.
- `sk_live_...` for live keys.

For MVP, one environment is sufficient.

### Acceptance Criteria

- A user can create a new API key from the dashboard.
- The raw API key is visible only immediately after creation.
- Refreshing the page does not reveal the raw key again.
- A revoked key no longer works.
- API requests with missing, invalid, or revoked keys are rejected.

---

## 13.3 Short-Link Creation

### API Endpoint

`POST /api/v1/links`

### Request Body

```json
{
	"url": "https://example.com/very/long/path",
	"alias": "docs",
	"title": "Example Docs",
	"expires_at": "2026-12-31T23:59:59Z"
}
```

### Response Body

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

### Requirements

- `url` is required.
- `alias` is optional.
- `title` is optional.
- `expires_at` is optional.
- If `alias` is not provided, the system must generate a random short code.
- Generated codes must be unique.
- Custom aliases must be unique.
- Custom aliases must be case-insensitive.
- Custom aliases should be stored and resolved in lowercase.
- Destination URLs must use `http` or `https`.
- Unsafe URL schemes must be rejected.
- Malformed URLs must be rejected.
- Reserved aliases must be rejected.

### Alias Rules

Allowed characters:

- Lowercase letters: `a-z`
- Numbers: `0-9`
- Hyphen: `-`
- Underscore: `_`

Suggested length:

- Minimum: 3 characters.
- Maximum: 64 characters.

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

### Acceptance Criteria

- A user can create a short link with only a destination URL.
- A user can create a short link with a custom alias.
- Duplicate aliases are rejected.
- Invalid URLs are rejected.
- Unsafe schemes are rejected.
- Reserved aliases are rejected.
- Created links are immediately usable for redirects.

---

## 13.4 Redirect Handling

### Public Redirect Endpoint

`GET /:code`

Example:

`GET https://skrol.ink/docs`

### Requirements

- Redirects must be publicly accessible.
- Redirects must not require authentication.
- Active links must redirect to their destination URL.
- Unknown codes must return `404 Not Found`.
- Expired links must return `410 Gone`.
- Disabled links must return `410 Gone`.
- Deleted links must return `404 Not Found` or `410 Gone`; implementation must choose one behavior and keep it consistent.
- Redirects must log a privacy-conscious click event.
- Redirects should use `302 Found` by default.

### Redirect Status Decision

The MVP will use `302 Found`, not `301 Moved Permanently`.

Rationale:

- Destinations may be edited later.
- `301` redirects can be cached aggressively.
- `302` gives the system more operational flexibility.

### Acceptance Criteria

- Visiting an active short URL redirects to the destination.
- Visiting a nonexistent short URL returns `404`.
- Visiting an expired short URL returns `410`.
- Visiting a disabled short URL returns `410`.
- Redirects produce analytics events without storing raw IP addresses long-term.

---

## 13.5 Link Management API

### Endpoints

- `GET /api/v1/links`
- `GET /api/v1/links/:id`
- `PATCH /api/v1/links/:id`
- `DELETE /api/v1/links/:id`

### Requirements

Users must be able to:

- List their links.
- View a specific link.
- Update a link title.
- Update a destination URL.
- Update an expiration date.
- Disable a link.
- Re-enable a disabled link.
- Soft-delete a link.

Users must not be able to:

- Access links owned by another user.
- Edit system fields directly.
- Reuse aliases owned by another active link.
- Modify deleted links except through future admin tooling.

### Acceptance Criteria

- A user can list only their own links.
- A user can update only their own links.
- A user can disable and re-enable their own links.
- A user can soft-delete their own links.
- Deleted links no longer appear in the default dashboard list.

---

## 13.6 Dashboard

### Required Pages

1. Login.
2. Signup.
3. Links list.
4. Link detail.
5. Create link.
6. API keys.
7. Account settings.

### Links List Requirements

The links list must show:

- Short URL.
- Destination URL.
- Title.
- Status.
- Created date.
- Expiration date.
- Total clicks.
- Copy button.

### Link Detail Requirements

The link detail page must show:

- Short URL.
- Destination URL.
- Title.
- Status.
- Created date.
- Expiration date.
- Total clicks.
- Clicks over time.
- Referrer domain breakdown.
- Country breakdown, if available.
- Device breakdown.
- Browser breakdown.
- Disable action.
- Delete action.

### Acceptance Criteria

- A logged-in user can create a link from the dashboard.
- A logged-in user can copy the short URL.
- A logged-in user can inspect analytics for a link.
- A logged-in user can disable a link.
- A logged-in user can delete a link.
- A logged-in user can create and revoke API keys.

---

## 13.7 Privacy-Conscious Analytics

### Analytics Philosophy

skrol should provide useful aggregate analytics without becoming a surveillance tool.

The MVP must avoid:

- Tracking cookies.
- Cross-site user identity.
- Device fingerprinting.
- Persistent raw IP storage.
- Long-term full user-agent storage.
- Individual clickstream profiles.

### Data to Track

The MVP may store:

- Link ID.
- Timestamp.
- Referrer domain.
- Country code, if derived.
- Browser family.
- Operating system family.
- Device type.
- Bot flag.

### Data Not to Store Long-Term

The MVP must not store long-term:

- Raw IP address.
- Full user-agent string.
- Cookies.
- Fingerprint identifiers.
- Per-visitor identity.

### Click Event Example

```json
{
	"link_id": "link_123",
	"clicked_at": "2026-05-12T10:00:00Z",
	"referrer_domain": "example.com",
	"country": "ID",
	"browser": "Chrome",
	"os": "Android",
	"device": "mobile",
	"is_bot": false
}
```

### Acceptance Criteria

- Link detail pages show total clicks.
- Link detail pages show clicks over time.
- Link detail pages show aggregate referrer domains.
- Link detail pages show aggregate country data if geolocation is implemented.
- Link detail pages show aggregate device/browser data.
- Raw IP addresses are not stored in the click events table.
- No analytics cookies are set by default.

---

## 13.8 URL Validation

### Requirements

The system must validate destination URLs at creation and update time.

Allowed schemes:

- `http`
- `https`

Rejected schemes:

- `javascript:`
- `data:`
- `file:`
- `ftp:`
- `mailto:`
- `tel:`
- Any non-HTTP scheme.

The system should reject destinations pointing to:

- `localhost`
- `127.0.0.1`
- `0.0.0.0`
- Private IPv4 ranges.
- Private IPv6 ranges.
- Link-local addresses.
- Cloud metadata IPs.

### Rationale

Even though skrol only redirects and does not fetch the destination server-side, blocking internal and local destinations reduces abuse and avoids turning the shortener into a helper for suspicious workflows.

### Acceptance Criteria

- Valid HTTP and HTTPS URLs are accepted.
- Malformed URLs are rejected.
- Non-HTTP URLs are rejected.
- Localhost URLs are rejected.
- Private network URLs are rejected.

---

## 13.9 Rate Limiting

### Requirements

Rate limiting must exist for both API requests and public redirects.

Suggested MVP limits:

| Area               |                    Limit |
| ------------------ | -----------------------: |
| Link creation      |   60 per user per minute |
| Link list/read API |  300 per user per minute |
| API key creation   |     10 per user per hour |
| Login attempts     | 10 per IP per 15 minutes |
| Public redirects   | High threshold, IP-based |

Exact values may be tuned during implementation.

### Acceptance Criteria

- Excessive link creation requests are rate-limited.
- Excessive login attempts are rate-limited.
- Rate-limited API responses return `429 Too Many Requests`.
- Rate limits do not block normal manual dashboard usage.

---

## 13.10 Abuse Prevention

### Requirements

The MVP must include:

- URL scheme validation.
- Reserved alias protection.
- Domain blocklist support.
- Rate-limited link creation.
- Admin ability to disable a link.
- Basic bot detection for analytics classification.
- No anonymous link creation.

### Admin Control Requirements

Admin users must be able to:

- Search for a link by code.
- View link metadata.
- Disable a link.
- Mark a link as flagged.

A full moderation dashboard is not required for MVP. A minimal admin route or internal script is acceptable.

### Acceptance Criteria

- Admin can disable an abusive link.
- Disabled abusive links return `410 Gone`.
- Blocklisted domains cannot be used as destinations.
- Anonymous users cannot create links.

---

## 14. API Requirements

## 14.1 Authentication Method

API requests must use bearer token authentication.

Example:

```http
Authorization: Bearer sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Missing, invalid, or revoked tokens must return `401 Unauthorized`.

---

## 14.2 Required MVP API Endpoints

### Links

- `POST /api/v1/links`
- `GET /api/v1/links`
- `GET /api/v1/links/:id`
- `PATCH /api/v1/links/:id`
- `DELETE /api/v1/links/:id`
- `GET /api/v1/links/:id/analytics`

### API Keys

- `POST /api/v1/api-keys`
- `GET /api/v1/api-keys`
- `DELETE /api/v1/api-keys/:id`

### System

- `GET /health`

---

## 14.3 API Error Format

All API errors should follow a consistent structure.

Example:

```json
{
	"error": {
		"code": "alias_taken",
		"message": "This alias is already in use."
	}
}
```

Suggested error codes:

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

---

## 15. UX Requirements

The dashboard should be minimal and utilitarian. It exists to support API-first usage, not to become the primary product surface.

## 15.1 UX Principles

- Fast to understand.
- Low visual complexity.
- Developer-oriented language.
- Copyable API-related values.
- Clear status labels.
- Clear failure states.
- No dark patterns.

## 15.2 Required UX States

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

## 15.3 Copy Requirements

The product should use precise language:

- Use “disabled” rather than vague terms like “inactive” when a user manually disables a link.
- Use “expired” when `expires_at` has passed.
- Use “deleted” only for soft-deleted links.
- Use “flagged” for admin-marked abuse cases.

---

## 16. Data Model Requirements

## 16.1 User

Required fields:

- `id`
- `email`
- `password_hash`
- `role`
- `created_at`
- `updated_at`

Suggested roles:

- `user`
- `admin`

---

## 16.2 API Key

Required fields:

- `id`
- `user_id`
- `name`
- `key_prefix`
- `key_hash`
- `last_used_at`
- `revoked_at`
- `created_at`

---

## 16.3 Link

Required fields:

- `id`
- `user_id`
- `code`
- `destination_url`
- `title`
- `status`
- `expires_at`
- `created_at`
- `updated_at`
- `deleted_at`

Suggested statuses:

- `active`
- `disabled`
- `flagged`
- `deleted`

Expiration can be computed from `expires_at`; a separate `expired` status is optional.

---

## 16.4 Click Event

Required fields:

- `id`
- `link_id`
- `clicked_at`
- `referrer_domain`
- `country`
- `browser`
- `os`
- `device`
- `is_bot`

Do not include long-term raw IP storage in this table.

---

## 16.5 Link Audit Log

Required fields:

- `id`
- `link_id`
- `user_id`
- `action`
- `previous_value`
- `new_value`
- `created_at`

Required audited actions:

- Destination URL changed.
- Link disabled.
- Link re-enabled.
- Link deleted.
- Link flagged by admin.

---

## 17. Non-Functional Requirements

## 17.1 Performance

MVP targets:

- Redirect p95 latency below 100 ms, excluding external network latency.
- API p95 latency below 300 ms for normal requests.
- Link creation below 500 ms under normal conditions.
- Dashboard initial page load below 2 seconds under normal conditions.

---

## 17.2 Reliability

MVP targets:

- Redirects should be the most reliable path in the system.
- Dashboard downtime should not necessarily imply redirect downtime, if avoidable.
- Unknown or unavailable destinations should not be checked synchronously during redirect.
- Database indexes must support fast lookup by short code.

Required indexes:

- Unique index on `links.code`.
- Index on `links.user_id`.
- Index on `click_events.link_id`.
- Index on `click_events.clicked_at`.
- Index on `api_keys.key_prefix`.

---

## 17.3 Security

Requirements:

- Hash passwords.
- Hash API keys.
- Use HTTPS in production.
- Validate destination URLs.
- Protect dashboard sessions.
- Rate-limit sensitive endpoints.
- Prevent users from accessing each other’s links.
- Avoid exposing raw API keys after creation.
- Prevent reserved route collisions.

---

## 17.4 Privacy

Requirements:

- No tracking cookies by default.
- No fingerprinting.
- No long-term raw IP storage in click analytics.
- No full user-agent storage in click analytics.
- Store normalized analytics metadata only.
- Keep analytics intentionally aggregate.
- Provide a simple privacy note explaining what is and is not collected.

---

## 18. Success Metrics

Because this is a pet project, success should be measured through both product completion and technical quality.

## 18.1 MVP Completion Metrics

The MVP is complete when:

1. A user can sign up and log in.
2. A user can create and revoke an API key.
3. A user can create a short link through the API.
4. A user can create a short link through the dashboard.
5. A user can create a custom alias.
6. A user can set an expiration date.
7. A public visitor can access `https://skrol.ink/:code` and be redirected.
8. Expired links stop redirecting.
9. Disabled links stop redirecting.
10. A user can view a list of their links.
11. A user can view detail for one link.
12. A user can see total clicks for a link.
13. A user can see basic aggregate analytics.
14. A user can disable a link.
15. A user can soft-delete a link.
16. Invalid and unsafe destination URLs are rejected.
17. API requests are rate-limited.
18. Link creation requires authentication.
19. Raw IP addresses are not stored long-term in click analytics.
20. Admin can disable an abusive link.

---

## 18.2 Product Usage Metrics

Useful metrics after launch:

- Number of registered users.
- Number of API keys created.
- Number of links created.
- Number of custom aliases created.
- Number of redirects served.
- Percentage of links receiving at least one click.
- Number of expired links.
- Number of disabled links.
- Number of blocklisted destination attempts.

---

## 18.3 Engineering Metrics

Useful engineering metrics:

- Redirect p95 latency.
- API p95 latency.
- Redirect error rate.
- API error rate.
- Link creation success rate.
- Generated-code collision rate.
- Rate-limit trigger count.
- Failed API authentication attempts.

---

## 18.4 Privacy Metrics

Useful privacy metrics:

- Percentage of click events stored without raw IP addresses.
- Number of analytics fields stored per click.
- Raw operational log retention duration.
- Number of tracking cookies set by redirect path; target should be zero.

---

## 19. Risks and Mitigations

| Risk                                                      |      Severity | Mitigation                                                                       |
| --------------------------------------------------------- | ------------: | -------------------------------------------------------------------------------- |
| Service is abused for phishing or spam                    |          High | No anonymous creation, URL validation, rate limits, blocklist, admin disablement |
| Redirects become slow                                     |          High | Index `links.code`, keep redirect path minimal, consider caching later           |
| Analytics conflict with privacy positioning               |        Medium | Store aggregate/normalized metadata only, avoid cookies and fingerprinting       |
| Scope expands into a Bitly clone                          |        Medium | Maintain MVP non-goals and decision log                                          |
| Custom aliases collide with app routes                    |        Medium | Reserve system aliases                                                           |
| API keys leak                                             |        Medium | Hash stored keys, show raw key once, allow revocation                            |
| Destination URL can be changed after trust is established |        Medium | Audit destination changes, allow admin disablement                               |
| Bot traffic pollutes analytics                            | Low to medium | Store `is_bot` classification where practical                                    |
| Pet project becomes operationally burdensome              |        Medium | Keep MVP small, avoid custom domains and teams initially                         |

---

## 20. Release Criteria

The MVP may be considered releasable when:

1. All MVP completion criteria are satisfied.
2. Redirect path works reliably on `skrol.ink`.
3. Authentication and API key flows are functional.
4. API documentation exists at a basic level.
5. Unsafe URLs are rejected.
6. Rate limiting exists for sensitive endpoints.
7. Admin can disable abusive links.
8. Privacy note exists.
9. Basic monitoring or logs exist for errors and abuse signals.
10. There is a backup or recovery plan for the database.

---

## 21. Recommended Implementation Sequence

### Phase 1: Core Redirect System

- Database schema for users, links, and click events.
- Short-code generation.
- Public redirect route.
- URL validation.

### Phase 2: Authentication and Dashboard Basics

- Signup.
- Login.
- Session handling.
- Links list.
- Create-link form.
- Link detail page.

### Phase 3: API-First Layer

- API key creation.
- API key hashing.
- Bearer token authentication.
- Link creation endpoint.
- Link management endpoints.

### Phase 4: Analytics

- Click event normalization.
- Total clicks.
- Clicks over time.
- Referrer domain aggregation.
- Device/browser aggregation.

### Phase 5: Safety and Polish

- Rate limiting.
- Domain blocklist.
- Admin disable control.
- Error format consistency.
- Basic API documentation.
- Privacy note.

---

## 22. Deferred Post-MVP Roadmap

Potential V1 or later features:

- OpenAPI specification.
- Public API docs.
- QR code generation.
- Bulk link creation.
- CLI.
- Webhooks.
- Custom domains.
- Team workspaces.
- Role-based permissions.
- More advanced bot filtering.
- Privacy-preserving approximate unique counts.
- Import/export.
- Self-hosted deployment mode.

---

## 23. Open Questions

These do not block the PRD, but they should be resolved during TRD or implementation:

1. What exact stack will be used?
2. What short-code generation algorithm will be used?
3. What default generated-code length should be used?
4. Should deleted links return `404 Not Found` or `410 Gone`?
5. What database will be used?
6. What rate-limiting mechanism will be used?
7. Will geolocation be implemented in MVP or deferred?
8. What bot-detection library or heuristic will be used?
9. How long should operational logs be retained?
10. How will admin actions be authenticated and audited?

---

## 24. Decision Log

| Decision           | MVP Choice                            | Rationale                                                          |
| ------------------ | ------------------------------------- | ------------------------------------------------------------------ |
| Product type       | API-first privacy-conscious shortener | Matches pet project goals and differentiates from marketing tools. |
| Domain             | `skrol.ink`                           | Domain already acquired.                                           |
| Anonymous creation | Excluded                              | Reduces abuse risk.                                                |
| Redirect status    | `302 Found`                           | Allows destination edits without permanent cache issues.           |
| Custom aliases     | Included                              | Important for developer usability.                                 |
| Link expiration    | Included                              | Useful and technically meaningful.                                 |
| Analytics          | Aggregate only                        | Supports privacy-first posture.                                    |
| Raw IP storage     | Excluded from long-term analytics     | Avoids invasive tracking.                                          |
| API keys           | Included                              | Core to API-first positioning.                                     |
| Custom domains     | Deferred                              | Adds DNS, SSL, and ownership complexity.                           |
| Teams              | Deferred                              | Not needed for pet project MVP.                                    |
| Billing            | Deferred                              | Not relevant to initial build.                                     |
| QR codes           | Deferred                              | Useful but nonessential.                                           |

---

## 25. Final MVP Definition

skrol MVP is an authenticated, API-first URL shortener hosted on `skrol.ink`. It allows users to create, manage, expire, disable, and inspect short links through both a REST API and a minimal dashboard. Public redirects are fast and use `302 Found`. The system supports custom aliases, API keys, soft deletion, basic abuse controls, and privacy-conscious aggregate analytics. It does not support anonymous link creation, tracking cookies, fingerprinting, custom domains, billing, teams, or invasive user-level analytics in the MVP.
