## ADDED Requirements

### Requirement: Health Endpoint Availability
The backend SHALL expose a `GET /health` endpoint for service health verification.

#### Scenario: Health endpoint route exists
- **WHEN** a client sends `GET /health`
- **THEN** the backend responds with a structured health response instead of route-not-found

### Requirement: Dependency-Aware Health Status
The health endpoint SHALL report healthy only when the backend runtime is active and required dependencies (PostgreSQL and Redis) are reachable.

#### Scenario: Dependencies are available
- **WHEN** PostgreSQL and Redis connectivity checks succeed
- **THEN** `GET /health` returns a healthy status with dependency status marked available

#### Scenario: A required dependency is unavailable
- **WHEN** either PostgreSQL or Redis connectivity check fails
- **THEN** `GET /health` returns an unhealthy status with the failing dependency identified

### Requirement: Health Response Contract
The health endpoint response SHALL include machine-readable fields for overall status and individual dependency states.

#### Scenario: Health response includes dependency states
- **WHEN** `GET /health` is called
- **THEN** the response payload includes overall health status and explicit PostgreSQL and Redis status fields
