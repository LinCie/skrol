## Main Project Documents

This project has four primary planning documents. Consult the correct document before making product, architecture, schema, or implementation decisions.

### 1. `docs/v1/1-project-prd.md` — Product Requirements Document

The PRD defines what skrol is, who it serves, what the MVP includes, and what is explicitly out of scope.

Consult the PRD when deciding:

- whether a feature belongs in the MVP
- what user problem a feature is solving
- expected product behavior and user journeys
- product constraints, non-goals, and acceptance criteria
- dashboard copy and UX terminology

Use this as the source of truth for product scope.

### 2. `docs/v1/2-project-trd.md` — Technical Requirements Document

The TRD translates the PRD into technical design. It defines the stack, architecture, API behavior, authentication approach, validation rules, rate limits, observability, deployment assumptions, and testing requirements.

Consult the TRD when implementing:

- backend routes and REST API behavior
- authentication and authorization
- redirect logic
- URL and alias validation
- rate limiting
- logging, monitoring, deployment, and testing
- performance, reliability, security, and privacy requirements

Use this as the source of truth for technical implementation details.

### 3. `docs/v1/3-project-erd.md` — Entity Relationship Document

The ERD defines the data model and ownership boundary between Better Auth/plugin-managed tables and skrol-owned tables.

Consult the ERD before changing:

- database schema
- migrations
- table ownership
- relationships between users, links, click events, audit logs, and blocklists
- API key persistence assumptions
- Better Auth integration boundaries

Important rule: authentication and API-key lifecycle belong to Better Auth/plugin-managed schema; short-link product data belongs to skrol-owned schema.

### 4. `docs/v1/4-master-spec.md` — Master Implementation Spec

The Master Spec consolidates the PRD, TRD, and ERD into an execution plan. It defines source-of-truth decisions, build phases, deliverables, acceptance criteria, release gates, and recommended implementation order.

Consult the Master Spec when:

- planning work
- choosing the next implementation task
- checking phase deliverables
- validating release readiness
- resolving sequencing questions
- reviewing project-wide decisions across product, technical, and schema concerns

Use this as the main execution guide.

## Navigation Tip: Inspect Document Headings Quickly

Use heading extraction to inspect document structure before reading full files.

```sh
# All headings across docs/
grep -RInE '^#{2,3} ' docs/

# Only ## headings
grep -RInE '^## ' docs/

# Only ### headings
grep -RInE '^### ' docs/
```

You can also grep individual documents directly.

```sh
# PRD
grep -nE '^#{2,3} ' docs/v1/v1-project-prd.md

# TRD
grep -nE '^#{2,3} ' docs/v1/v1-project-trd.md

# ERD
grep -nE '^#{2,3} ' docs/v1/v1-project-erd.md

# Master Spec
grep -nE '^#{2,3} ' docs/v1/v1-master-spec.md
```

Use this before making scope, architecture, schema, API, validation, or implementation decisions.

## Conflict Resolution

If documents appear to conflict:

1. Use the PRD for product scope and non-goals.
2. Use the TRD for technical behavior and implementation requirements.
3. Use the ERD for schema ownership and database structure.
4. Use the Master Spec for implementation order, release gates, and consolidated execution decisions.

Do not expand MVP scope unless the PRD and Master Spec are both updated.
