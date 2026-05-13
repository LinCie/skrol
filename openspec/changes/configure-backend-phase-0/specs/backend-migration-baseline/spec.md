## ADDED Requirements

### Requirement: Migration Workflow Availability
The backend project SHALL include a documented, executable migration workflow using `kysely-ctl` for applying skrol-owned schema migrations.

#### Scenario: Developer runs migration command
- **WHEN** a developer executes the configured migration apply command
- **THEN** pending Kysely migrations run in order and report success or actionable failure

### Requirement: Phase 0 Schema Baseline Migration
The migration set SHALL include an initial schema baseline for skrol-owned tables required by project Phase 0 planning.

#### Scenario: New environment is bootstrapped
- **WHEN** migrations are run against an empty database
- **THEN** the baseline skrol-owned tables are created according to the defined schema ownership boundary

### Requirement: Migration Failure Safety
The migration workflow SHALL fail with non-zero exit and clear diagnostics when a migration cannot be applied.

#### Scenario: Migration apply error occurs
- **WHEN** a migration step fails during execution
- **THEN** the command exits with failure and reports which migration and operation caused the error
