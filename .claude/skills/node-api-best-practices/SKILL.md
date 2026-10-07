---
name: node-api-best-practices
description: Node.js API best practices for this repo's server/ workspace - Fastify 5 + Zod type provider, shared API contract in shared/, SQLite via better-sqlite3 with migrations and seeders, layered modules (routes/service/repository), injected Clock for date rules, uniform error format, validation, security, OpenAPI docs, and testing with app.inject. Use whenever writing, reviewing, or planning backend code or API contracts.
---

# Node API Best Practices

Rules for all code in `server/` and `shared/`. Breaking one requires an ADR in the TRD.

## 1. Approved libraries

| Concern | Library | Notes |
| ------- | ------- | ----- |
| Runtime | Node ≥ 20 (see `.nvmrc`), TypeScript strict, `tsx` (dev/start) | No build step; `tsc --noEmit` for type checks |
| HTTP | `fastify` 5 + `fastify-type-provider-zod` | Route schemas = Zod schemas from `shared/` |
| Validation | `zod` 4 (same instance as the web app) | Request + response + env |
| Database | SQLite via `better-sqlite3` (sync, transactional) | Plain SQL + repositories; no ORM |
| Docs | `@fastify/swagger` + `@fastify/swagger-ui` | `/api/docs` generated from the Zod schemas |
| Security | `@fastify/helmet`, `@fastify/cors` | CORS limited to `CORS_ORIGIN` |
| Logging | Fastify's built-in pino logger | Structured JSON; never `console.log` in request code |
| Tests | `vitest` + `app.inject()` + in-memory SQLite | No real network, no shared DB file |

Any other dependency needs a TRD task or ADR. Check `server/package.json` before importing anything.

## 2. Structure

```
shared/api/<feature>.ts     # Zod schemas + inferred types for requests/responses (the contract)
server/src/
  app.ts                    # buildApp(deps): plugins, error handler, module registration
  server.ts                 # entry: config, DB, migrate, seed, listen, graceful shutdown
  config.ts                 # Zod-validated env
  lib/clock.ts              # Clock (now) - inject, never call new Date() in business code
  lib/errors.ts             # AppError, NotFoundError, BusinessRuleError
  plugins/error-handler.ts  # uniform { error: { code, message, details? } }
  db/connection.ts  db/migrate.ts  db/seed.ts  db/seed-cli.ts
  modules/<feature>/
    <feature>.routes.ts     # HTTP only: schema, parse, call service, map result
    <feature>.service.ts    # business rules (pure where possible, takes Clock)
    <feature>.repository.ts # SQL only; returns typed rows
    <feature>.seed.ts       # Seeder with realistic, deterministic sample data
    *.test.ts               # service unit tests + route tests via app.inject
server/test/helpers.ts      # createTestApp({ today, seeders, setup })
```

Layer rules: routes → service → repository. Routes don't contain SQL, and repositories don't
contain business rules. Dependencies (`db`, `clock`) come in through plugin options and are
never imported as module-level singletons.

## 3. API contract (`shared/`)

- Each endpoint's request/query/params/response is a Zod schema in `shared/api/<feature>.ts`.
  The web app parses responses with the **same** schema (see `fetchJson` in `src/lib/http.ts`).
- `shared/` imports only `zod`, never web or server code (ESLint enforces this).
- Changing a schema is a contract change: update the server route, the web consumer, the MSW
  handlers, and the tests in the same task.

## 4. HTTP conventions

- All routes are under `/api`. Use plural nouns (`/api/dealerships/:id/vehicles`) and nest only
  one level.
- Status codes: 200 for GET/PUT, 201 for create (POST), 400 for schema validation, 404 for
  not found, 422 for a business rule violation (`BusinessRuleError` with a specific code such as
  `VEHICLE_NOT_AGING`), and 500 for unexpected errors (no internal details leaked).
- Every error body matches `ApiErrorSchema`. Throw `AppError` subclasses and let the error
  handler format them; never `reply.send({ error })` by hand.
- List endpoints: filtering, sorting, and pagination happen **server-side** (query params
  validated by Zod, e.g. `page`, `pageSize` ≤ 100, `sort`). They return
  `{ items, total, page, pageSize }`.
- Every route declares a `response` schema. This doubles as output filtering and documentation.

## 5. Business rules & time

- Date logic (such as vehicle age) lives in the service and reads time only from the injected
  `Clock`. Tests and demos pin it with `fixedClock('2026-10-07')` or `APP_TODAY`.
- Do calendar-day arithmetic on dates (`YYYY-MM-DD`) in the relevant time zone, not with
  millisecond division, which breaks on DST changes.
- Business rules are enforced on the server even if the UI also checks them (PRD BR-18).
  Each rule has a unit test at its boundaries.

## 6. Database

- Schema changes go only through `db/migrate.ts`: append a migration with the next id and
  never edit an applied one. Use `STRICT` tables, `NOT NULL`, `CHECK` constraints for enums and
  lengths, foreign keys, and indexes for filter and sort columns.
- Always use prepared statements with parameters and never interpolate input into SQL.
  Build dynamic `ORDER BY` columns from a whitelist map.
- Writes that touch several rows or tables run inside `db.transaction(...)`.
- Append-only data (such as action history) has no UPDATE or DELETE statements in the
  repository.
- Store timestamps as ISO-8601 UTC strings and dates as `YYYY-MM-DD`.
- Seeders are deterministic: generate data relative to the clock's "today" so ages land in every
  bucket, including the exact boundaries (90 and 91 days).

## 7. Security

- Validate params, query, and body with Zod, including max lengths and enums. Trim strings
  where the PRD says so.
- Use Helmet and CORS restricted to the configured origin. Secrets only come from env, are
  never committed (`server/.env` is gitignored), and are never logged.
- Return user-supplied text as data and never build HTML on the server.

## 8. Testing

- **Service tests**: pure business rules with a fixed clock, covering boundaries and
  invalid input.
- **Route tests**: `createTestApp({ today, seeders })` + `app.inject()`. Assert the status
  code and parse the body with the shared schema. Cover 2xx, 400, 404, and 422, plus
  persistence (write, then read back).
- **Persistence across restart**: covered by `db/connection.test.ts` (file DB reopen).
  Feature tests use `:memory:`.
- Coverage thresholds: 80% lines/functions/statements, 70% branches (`server/vitest.config.ts`).

## 9. Operations

- Run `npm run dev` (root) for web and API together, or `npm run dev:api` for the API alone.
  Swagger is at http://127.0.0.1:3001/api/docs.
- `npm run seed:api` migrates and seeds the database file; deleting `server/data/` resets it.
- Graceful shutdown closes the HTTP server, then the database.
