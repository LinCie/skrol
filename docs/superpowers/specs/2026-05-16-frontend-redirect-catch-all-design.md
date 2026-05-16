# Frontend Redirect Catch-All Design

## Goal

Move public short-link URLs from backend origin to frontend origin. In local development, generated links should use `http://localhost:3000/:code` while backend APIs remain on `http://localhost:8000`.

## Chosen Approach

The frontend owns public `/:code` routing. The backend keeps redirect decision logic behind a product API endpoint.

## Architecture

- Backend no longer exposes public browser redirect route `GET /:code` as primary short-link surface.
- Backend exposes `GET /api/v1/redirect/:code` for redirect decisions.
- Existing backend redirect use case remains source of truth for code lookup, active/deleted/disabled/expired checks, analytics insertion, and destination selection.
- Backend link DTOs build `short_url` from configured frontend public origin, not `request.url` backend origin.
- Frontend adds a TanStack Router catch-all route for short codes.
- Frontend catch-all calls backend redirect decision API and navigates with `window.location.replace(location)` when active.

## Data Flow

1. Dashboard creates or lists a link through backend `/api/v1/links`.
2. Backend responds with `short_url` on frontend origin, for example `http://localhost:3000/docs`.
3. Visitor opens frontend `/:code`.
4. Frontend catch-all calls backend `/api/v1/redirect/:code`.
5. Backend resolves code and records privacy-conscious click analytics through existing redirect use case.
6. Backend returns JSON containing destination location for active links.
7. Frontend performs client-side navigation to destination URL.

## API Behavior

- `GET /api/v1/redirect/:code` returns `200` with `{ "location": "https://example.com" }` for active links.
- Missing and soft-deleted links return `404` JSON errors.
- Disabled, flagged, and expired links return `410` JSON errors.
- Endpoint must not set session cookies.
- API route remains under `/api/v1` so it does not conflict with frontend app routes.

## Frontend Behavior

- App routes such as `/`, `/login`, `/signup`, and `/dashboard/*` keep normal behavior.
- Catch-all route handles unmatched root-level paths as candidate short codes.
- While resolving, frontend displays a small loading state.
- `404` displays not-found state.
- `410` displays unavailable state.
- Network or unexpected errors display generic failure state.

## Configuration

- Backend needs frontend public origin for DTO generation.
- Existing frontend API base URL behavior continues to point API calls at backend origin.
- Local defaults should preserve `http://localhost:3000` frontend and `http://localhost:8000` backend behavior.

## Testing

- Backend route tests cover redirect decision API status and response body.
- Backend link API tests cover `short_url` origin generated from frontend public origin.
- Frontend tests cover catch-all API call and successful navigation behavior.
- Existing dashboard route guard tests continue to prove reserved app routes are not treated as short codes.

## Documentation Updates

Update `docs/v1/` after code changes:

- TRD architecture and redirect sections.
- Master Spec MVP definition, system architecture, and redirect flow.
- PRD wording if any public short-link URL behavior conflicts.
