---
name: init-node-api
description: Scaffold the Node.js API as an npm workspace in server/ - Fastify 5 + Zod type provider, SQLite (better-sqlite3) with migrations and seeders, injected Clock, uniform error handling, Swagger docs, Helmet/CORS, Vitest + app.inject tests - plus a shared/ Zod contract used by both web and API, a Vite /api proxy, and one `npm run dev` for both. Use once after /init-react-app, before implementing backend TRD tasks.
argument-hint: (no arguments)
disable-model-invocation: true
---

# Init Node API

Follow [node-api-best-practices](../node-api-best-practices/SKILL.md). Exact file contents are in
[reference.md](reference.md). Copy them as given and don't improvise configs.

## 0. Preconditions

- The web app from `/init-react-app` exists at the repo root (`package.json`, `vite.config.ts`).
- `server/` does not exist yet. If it does, stop and ask.
- Working tree is clean (`git status`), so the scaffold can be reviewed as one diff.

## 1. Workspace & dependencies

Follow the **Install** section of reference.md in order: add the `server` workspace, run a root
`npm install`, then the server dependencies, then `concurrently`. If a tool later fails with
missing files, do the clean install from the version notes.

## 2. Files

Create from reference.md:

```
shared/api/common.ts          # ApiErrorSchema, HealthResponseSchema (contract)
server/package.json  server/tsconfig.json  server/vitest.config.ts  server/.env.example
server/src/config.ts  server/src/app.ts  server/src/server.ts
server/src/lib/clock.ts  server/src/lib/errors.ts
server/src/plugins/error-handler.ts
server/src/db/connection.ts  migrate.ts  seed.ts  seed-cli.ts
server/src/routes/health.ts
server/test/helpers.ts
server/src/**/*.test.ts       # config, connection, migrate, seed, error-handler, health
```

Then `cp server/.env.example server/.env`.

## 3. Root changes

- `vite.config.ts`: `@shared` alias + `server.proxy` for `/api` (full file in reference.md)
- `tsconfig.app.json`: `@shared/*` path and `"shared"` in `include`
- `eslint.config.js`: `server/**` (node globals, no `@/` imports) and `shared/**` (zod only) blocks
- `src/lib/http.ts` + test: `HttpError.code` read from the shared `ApiErrorSchema`
- `package.json` scripts, `.env.example` (`VITE_USE_MOCKS=false`), `.gitignore` additions

## 4. Verify (all must pass, fix and re-run until green)

```bash
npx prettier --write . && npm run validate      # web + API typecheck, lint, format, tests, coverage
npm run build && npm run build-storybook -- --quiet
```

Smoke test with real processes. Run `npm run dev` in the background, then wait for a real 200.
Don't just wait for curl to succeed: the proxy answers 500 while the API is still starting.

```bash
for i in $(seq 1 60); do [ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:5173/api/health)" = 200 ] && break; sleep 1; done
curl -s http://127.0.0.1:3001/api/health        # {"status":"ok","database":"up","today":"..."}
curl -s http://localhost:5173/api/health        # same JSON through the Vite proxy
curl -s http://localhost:5173/api/nope          # {"error":{"code":"NOT_FOUND",...}}
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/api/docs/   # 200
ls server/data/app.db                           # database file created
```

Stop the dev processes afterwards (`pkill -INT -f "concurrently -k -n web,api"`).

## 5. Report

List the installed versions, the files created and changed, gate and smoke-test results, and any
deviation from reference.md. Log the step with `/log-ai-decision`. Suggest (but don't make) the
commit `chore: scaffold node api workspace [init-node-api]`.
Next: `/create-trd` (or `/implement-trd` if the TRD exists).
