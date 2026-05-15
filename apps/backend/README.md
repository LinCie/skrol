# Backend Service

Bun + Elysia backend for the skrol short-link service.

## Quick Start

### Prerequisites

- Bun 1.3.13+
- PostgreSQL 18+
- Redis 8+

### Local Development

1. **Set up environment variables**

   Copy `.env.example` from the repository root to `.env` in the project root:

   ```bash
   cp .env.example .env
   ```

   Update the values for your local PostgreSQL and Redis instances:

   ```env
   NODE_ENV=development
   PORT=3000
   LOG_LEVEL=info
   DATABASE_URL=postgresql://user:password@localhost:5432/skrol
   REDIS_URL=redis://localhost:6379
   ```

2. **Install dependencies**

   From the repository root:

   ```bash
   bun install
   ```

3. **Run migrations**

   Apply pending migrations to set up the database schema:

   ```bash
   cd apps/backend
   bun run migrate
   ```

4. **Start the backend**

   ```bash
   bun run dev
   ```

   The backend will start on `http://localhost:3000`.

5. **Verify health**

   ```bash
   curl http://localhost:3000/health
   ```

   Expected response when dependencies are available:

   ```json
   {
     "status": "healthy",
     "timestamp": "2026-05-13T04:24:17.615Z",
     "dependencies": {
       "postgres": "available",
       "redis": "available"
     }
   }
   ```

## Available Scripts

### Development

```bash
bun run dev
```

Starts the backend in watch mode. Changes to source files trigger automatic restart.

### Build

```bash
bun run build
```

Compiles the backend to `dist/` directory for production deployment.

### Type Check

```bash
bun run check-types
```

Runs TypeScript type checking without emitting files.

### Lint

```bash
bun run lint
```

Runs ESLint to check code quality.

### Test

```bash
bun run test
```

Runs the test suite (currently a placeholder).

## Database Migrations

Migrations are managed using `kysely-ctl` and stored in the `migrations/` directory.

### Running Migrations

Apply all pending migrations:

```bash
bun run migrate
```

### Listing Migrations

View migration status:

```bash
bun run migrate:list
```

### Skipping Migrations

Skip a specific migration (use with caution):

```bash
bun run migrate:skip
```

### Creating New Migrations

1. Create a new file in `migrations/` following the naming convention: `NNN_description.ts`
2. Implement `up()` and `down()` functions using Kysely schema builder
3. Run `bun run migrate` to apply

### Better Auth Schema Workflow

Better Auth keeps its own auth/session schema separate from skrol-owned tables.

Use the backend scripts to inspect or apply that schema against the configured
`BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, and `DATABASE_URL` values:

```bash
bun run auth:schema:generate
bun run auth:schema:migrate
```

If you want the generated SQL saved to a file, pass `--output <path>` to the
generate script.

Example migration structure:

```typescript
import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // Migration logic
}

export async function down(db: Kysely<any>): Promise<void> {
  // Rollback logic
}
```

## API Endpoints

### Health Check

```
GET /health
```

Returns service health status and dependency availability.

**Response (200 - Healthy):**

```json
{
  "status": "healthy",
  "timestamp": "2026-05-13T04:24:17.615Z",
  "dependencies": {
    "postgres": "available",
    "redis": "available"
  }
}
```

**Response (503 - Unhealthy):**

```json
{
  "status": "unhealthy",
  "timestamp": "2026-05-13T04:24:17.615Z",
  "dependencies": {
    "postgres": "unavailable",
    "redis": "available"
  }
}
```

### Root

```
GET /
```

Returns basic service information.

**Response:**

```json
{
  "message": "Backend service is running",
  "version": "1.0.0"
}
```

## Configuration

Backend configuration is loaded from environment variables at startup. Required variables:

| Variable       | Description                          | Example                                       |
| -------------- | ------------------------------------ | --------------------------------------------- |
| `NODE_ENV`     | Environment (development/production) | `development`                                 |
| `PORT`         | HTTP server port                     | `3000`                                        |
| `DATABASE_URL` | PostgreSQL connection string         | `postgresql://user:pass@localhost:5432/skrol` |
| `REDIS_URL`    | Redis connection string              | `redis://localhost:6379`                      |
| `LOG_LEVEL`    | Pino log level                       | `info`                                        |
| `SENTRY_DSN`   | Sentry error tracking (optional)     | (empty for Phase 0)                           |

Missing required variables will cause startup to fail with a clear error message.

## Logging

The backend uses Pino for structured logging. In development, logs are formatted with `pino-pretty` for readability. In production, logs are output as JSON.

Request and error logging is automatically registered with Elysia hooks.

## Troubleshooting

### Backend fails to start

Check the error message for missing environment variables or connection issues:

```bash
# Verify PostgreSQL is running
psql $DATABASE_URL -c "SELECT 1"

# Verify Redis is running
redis-cli -u $REDIS_URL ping
```

### Health endpoint returns unhealthy

Check individual dependency status in the response. Verify PostgreSQL and Redis are running and accessible.

### Migrations fail

Ensure the database exists and the connection string is correct:

```bash
# Create database if needed
createdb skrol

# Run migrations
bun run migrate
```

## Architecture

### Startup Sequence

The backend follows a deterministic startup sequence:

1. Load and validate configuration
2. Initialize logger
3. Initialize PostgreSQL connection
4. Initialize Redis connection
5. Register routes and middleware
6. Start HTTP server
7. Set up graceful shutdown handlers

If any step fails, the process exits immediately with a clear error message.

### Database Schema

The backend manages skrol-owned tables:

- `user_profiles` - User metadata and roles
- `links` - Short link records
- `click_events` - Click analytics
- `link_audit_logs` - Audit trail
- `domain_blocklist` - Blocked domains

Authentication and API key management are handled by Better Auth (external dependency).

## Deployment

For production deployment:

1. Build the backend: `bun run build`
2. Set production environment variables
3. Run migrations: `bun run migrate`
4. Start the server: `bun dist/index.js`

The backend is designed to be stateless and can be scaled horizontally behind a load balancer.
