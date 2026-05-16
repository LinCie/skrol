# Phase 4 Design: Analytics

Date: 2026-05-16  
Project: skrol  
Phase: 4 (Analytics)  
Status: Drafted from approved brainstorming; ready for spec review

## 1. Goal and Scope

Phase 4 adds privacy-conscious aggregate analytics for link owners through API and dashboard, while preserving redirect reliability and current auth/ownership boundaries.

In scope:

- aggregate analytics queries for one link:
  - total clicks
  - clicks over time
  - referrer-domain breakdown
  - browser breakdown
  - device breakdown
- optional country breakdown support when country data is available
- product API endpoint:
  - `GET /api/v1/links/:id/analytics`
- dashboard link-detail analytics panels
- required upstream fixes inside Phase 4 tasks when current click-event capture is insufficient for accepted analytics outputs
- correctness and privacy-focused tests

Out of scope:

- unique visitor analytics
- cookie/fingerprint-based analytics
- raw IP analytics storage
- full user-agent storage
- geolocation service rollout as mandatory Phase 4 requirement
- performance benchmarking and load testing tasks in this phase plan, except lightweight query-shape sanity checks needed to avoid obviously unbounded aggregate queries

## 2. Governing Decisions

Source-of-truth references:

- product scope and non-goals: `docs/v1/1-project-prd.md`
- technical behavior and API requirements: `docs/v1/2-project-trd.md`
- schema ownership and `click_events` model: `docs/v1/3-project-erd.md`
- phase deliverables and acceptance: `docs/v1/4-master-spec.md`

Phase-4 decisions locked during brainstorming:

1. Country analytics remains optional for now.
2. Phase 4 plan may include prerequisite fixes in redirect analytics capture where needed.
3. Phase 4 plan focuses on correctness and privacy, not performance benchmarking.
4. Ownership checks for analytics endpoint follow existing product API policy; cross-user access should not leak resource existence.
5. Redirect availability remains higher priority than analytics write success.

## 3. Current-State Findings Relevant to Phase 4

Observed from current codebase:

- `click_events` schema already includes fields needed for aggregate dimensions: `referrer_domain`, `country`, `browser`, `os`, `device`, `is_bot`.
- redirect use case currently persists mostly null metadata for browser/device/country and only normalizes referrer domain.
- backend has analytics repository/entity scaffolding but no user-facing aggregate analytics endpoint for link details.
- frontend link-management pages exist from earlier phases; analytics panels for Phase 4 deliverables are not complete.

Implication:

- Phase 4 must include a redirect metadata-capture patch before or alongside analytics read endpoint work to avoid shipping mostly empty breakdown panels.

## 4. Recommended Approach

Use a vertical slice approach:

1. Add/patch analytics capture where needed in redirect path (non-blocking behavior preserved).
2. Implement analytics aggregation query layer and endpoint.
3. Integrate link-detail dashboard panels to endpoint response.
4. Add privacy/correctness tests across redirect, API, and dashboard.

Rationale:

- aligns with API-first product boundary
- produces visible user value quickly
- keeps behavior and verification localized
- avoids speculative abstractions

## 5. Architecture and Boundaries

### 5.1 Backend Ownership

Backend owns analytics aggregation and authorization checks for `GET /api/v1/links/:id/analytics`.

Responsibilities:

- validate caller identity via existing principal model
- enforce link ownership and anti-enumeration behavior
- execute aggregate queries scoped by `link_id`
- return normalized aggregate payload only

### 5.2 Redirect Path Invariants

Redirect path must keep these invariants:

- no external network calls for analytics capture
- no raw IP or full user-agent persistence
- analytics insert failure does not block redirect response

### 5.3 Frontend Ownership

Frontend link-detail route consumes one analytics endpoint and renders:

- total clicks
- clicks over time
- referrers
- browsers
- devices
- country panel only when data is available/implemented

## 6. Data Flow and API Contract

### 6.1 Request Flow

1. Client calls `GET /api/v1/links/:id/analytics`.
2. Backend resolves authenticated principal.
3. Backend verifies link existence and ownership policy.
4. Backend runs aggregate queries over `click_events` for that link.
5. Backend returns aggregate response payload.

### 6.2 Proposed Response Shape

```json
{
	"data": {
		"link_id": "uuid",
		"total_clicks": 1234,
		"clicks_over_time": [
			{ "bucket_start": "2026-05-16T00:00:00.000Z", "clicks": 120 }
		],
		"referrers": [{ "referrer_domain": "example.com", "clicks": 77 }],
		"browsers": [{ "browser": "Chrome", "clicks": 81 }],
		"devices": [{ "device": "desktop", "clicks": 90 }],
		"countries": [{ "country": "ID", "clicks": 25 }]
	}
}
```

Contract notes:

- payload is aggregate-only
- no event-level sensitive data
- `countries` is optional in Phase 4 implementation policy; if present, values are country codes only

### 6.3 Time-Series Policy

- `total_clicks` is all-time for the link.
- `clicks_over_time` defaults to last 30 days.
- bucket size is daily for Phase 4.
- buckets use UTC.
- results sort ascending by `bucket_start`.
- missing days are returned with `clicks: 0` for stable chart rendering.

### 6.4 Breakdown Policy

- `referrers`: top 20 by click count.
- `browsers`: top 20 by click count.
- `devices`: all known device categories.
- `countries`: top 20 by click count when implemented.
- null referrer is represented as `direct`.
- null browser/device/country is represented as `unknown`.
- ties are sorted alphabetically by dimension value after click count.

### 6.5 Bot Policy

- `total_clicks` and all breakdowns include all successful redirect click events, including bot-classified events.
- `is_bot` is captured for classification and future filtering only.
- Phase 4 does not add unique visitor counts, bot filtering, or visitor segmentation.

## 7. Redirect Analytics Capture Patch (Phase 4 Prerequisite)

Phase 4 includes an upstream patch to improve usefulness of stored analytics dimensions.

Patch goals:

- preserve existing referrer-domain normalization
- classify browser/os/device family values from user-agent without storing full user-agent
- retain `is_bot` classification field handling
- keep `country` nullable/optional unless local GeoIP pipeline already exists
- keep write-path lightweight and non-blocking

Data safety rules:

- do not add raw IP persistence
- do not add cookie or fingerprint identifiers
- do not log full user-agent in analytics records

## 8. Error Handling and Edge Cases

API endpoint behavior:

- invalid/missing credentials: `401`
- cross-user access: `404` (anti-enumeration)
- unknown link id: `404`
- soft-deleted link: `404` for normal product access
- no analytics yet: success with zero/empty aggregates
- unexpected server failure: `500` with standard product error envelope

Redirect-path behavior:

- analytics persistence failure is logged but does not block redirect resolution

Country behavior:

- country breakdown appears only when implemented and data exists

## 9. Testing Strategy (Correctness + Privacy)

### 9.1 Backend Tests

- unit tests for aggregate query mapping and normalization
- integration/API tests for `GET /api/v1/links/:id/analytics`:
  - success path
  - `401` for unauthenticated
  - `404` for unknown link
  - `404` for non-owner
  - empty analytics state

### 9.2 Redirect Regression Tests

- metadata extraction remains normalized and privacy-safe
- analytics write failure still non-blocking for redirect
- no raw IP/full user-agent persisted in click events

### 9.3 Frontend Tests

- link-detail analytics loading/empty/populated/error states
- panel rendering for referrer/browser/device/time-series/total
- country panel visibility conditional on country data availability

### 9.4 Acceptance Mapping

Tests must prove each Phase 4 acceptance criterion:

- total clicks shown
- clicks over time shown
- referrer breakdown shown
- browser/device breakdown shown
- country only if implemented
- no analytics cookies on redirect path
- click events exclude raw IP and full user-agent

## 10. Risks and Mitigations

1. **Risk:** Existing redirect writes produce sparse analytics dimensions.  
   **Mitigation:** include prerequisite metadata-capture patch in same phase.

2. **Risk:** Analytics endpoint leaks cross-user link existence.  
   **Mitigation:** use same ownership anti-enumeration semantics as existing link routes.

3. **Risk:** Analytics improvements accidentally add invasive tracking fields.  
   **Mitigation:** explicit privacy assertions in tests and DTO constraints.

4. **Risk:** Country support creates scope creep into geolocation rollout.  
   **Mitigation:** keep country optional; no mandatory GeoIP integration in this phase.

## 11. Deliverables Checklist

- aggregate analytics query capability
- `GET /api/v1/links/:id/analytics`
- dashboard link-detail analytics panels
- redirect metadata-capture prerequisite patch (if needed)
- correctness/privacy test coverage for endpoint and redirect invariants

## 12. Ready-for-Plan Notes

Implementation plan should:

- follow TDD task breakdown
- call out exact files to create/modify
- include prerequisite redirect patch tasks before analytics-read tasks when required
- avoid performance benchmark tasks in this phase plan
- preserve existing architectural boundaries and API error conventions
