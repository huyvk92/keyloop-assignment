# Intelligent Inventory Dashboard

A dashboard that gives dealership managers a current overview of their vehicle stock. It
highlights **aging stock** (vehicles in inventory for more than 90 days), and lets managers
**log and keep a proposed action** for each aging vehicle. The brief is the Keyloop "Supply"
scenario ([docs/ASSIGNMENT.md](docs/ASSIGNMENT.md)).

- **Web:** React 19, TypeScript, Vite, Tailwind CSS v4, TanStack Query, React Router, React Hook
  Form + Zod, English/Vietnamese UI.
- **API:** Node.js, Fastify 5, Zod, SQLite (better-sqlite3), Swagger.
- **Contract:** one shared Zod schema package used by both sides (`shared/api/`).

| Brief requirement                                                     | Where to see it                                                                                                                            |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. Filterable list of all vehicles (make, model, age)                 | Filter bar and vehicle table: make → model, age buckets, custom age range, "aging only", search. Server-side paging and sorting            |
| 2. Automatically identify and prominently display aging stock (>90 d) | KPI cards (total, aging, % aging, average days), the **Aging stock** section (10 oldest), and the "Aging" label on every row               |
| 3. Log and persist a status or proposed action per aging vehicle      | **View** → drawer with history → **Log action** form. Stored in SQLite, append-only, and kept across reloads, browsers and server restarts |

Screenshots: [docs/screenshots/](docs/screenshots/).

## Quick start

Requirements: **Node ≥ 20** (`.nvmrc` pins 24) and npm. `better-sqlite3` installs a prebuilt
binary on macOS, Linux and Windows. If no prebuilt binary matches your platform, see
[Troubleshooting](#troubleshooting).

```bash
npm install
cp .env.example .env && cp server/.env.example server/.env
npm run dev
```

- Web: http://localhost:5173. `/api` is proxied to the API.
- API: http://127.0.0.1:3001. Swagger UI: http://127.0.0.1:3001/api/docs

On first start the API creates `server/data/app.db` and seeds 4 UK dealerships with
deterministic sample data.

### Reproducible demo (recommended)

Vehicle ages are calendar days counted from "today" in the dealership's time zone. The seed
places vehicles at exactly 0, 30, 31, 60, 61, **90 and 91** days. As real days pass, those
boundaries shift. To see exactly the seeded values, pin "today" and start from a fresh
database:

```bash
rm -rf server/data
APP_TODAY=2026-10-07 npm run dev
```

You can also set `APP_TODAY=2026-10-07` in `server/.env`. To reset all data at any time, stop the
servers and delete `server/data/`.

## Demo walkthrough

1. **Overview:** `/` opens the alphabetically first dealership, _Birmingham Central Motors_
   (360 vehicles, 86 aging). Switch dealerships with the **Dealership** dropdown. _York Pop-up
   Showroom_ has no stock, so it shows the empty states.
2. **Filter (requirement 1):**
   - Choose a make and the model list narrows to that make.
   - Pick an age bucket or a custom range, tick "Aging only", or search by VIN, stock number
     or model (for example `stk-104`).
   - Filters, sort and page live in the URL, so a filtered view can be shared or bookmarked.
3. **Aging stock (requirement 2):**
   - With `APP_TODAY=2026-10-07`, a 90-day vehicle is _not_ aging and a 91-day vehicle is. Try
     the custom range 90-91.
   - "View all N aging vehicles" shows exactly the N aging vehicles.
4. **Log an action (requirement 3):**
   - Click **View** on an aging vehicle, pick a status, add an optional note and your name,
     then save.
   - History, the list row, the aging section and the KPIs update without a reload.
   - Reload the page, open another browser, or restart `npm run dev`: the action is still there.
   - A vehicle aged 90 days or less shows its history but no form, and the API rejects a POST
     for it with `422 VEHICLE_NOT_AGING`.
5. **Language:** switch between English and Tiếng Việt in the header. Stored data is never
   translated.

Try the API directly in Swagger, or with curl:

```bash
curl -s http://127.0.0.1:3001/api/dealerships
curl -s "http://127.0.0.1:3001/api/dealerships/1/vehicles?ageBucket=over-90&make=Ford&pageSize=5"
curl -s http://127.0.0.1:3001/api/dealerships/1/summary
curl -s -X POST http://127.0.0.1:3001/api/vehicles/224/actions \
  -H 'content-type: application/json' \
  -d '{"status":"Price Reduction Planned","note":"Reduce by 5%","loggedBy":"Jane Smith"}'
```

## API

| Method | Path                                      | Purpose                                                                                                                            |
| ------ | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/dealerships`                        | Dealerships A-Z                                                                                                                    |
| GET    | `/api/dealerships/:dealershipId/vehicles` | Filtered, sorted, paged list (`make, model, ageBucket, minAge, maxAge, agingOnly, needsAttention, q, sort, order, page, pageSize`) |
| GET    | `/api/dealerships/:dealershipId/facets`   | Makes and models in stock (for the filters)                                                                                        |
| GET    | `/api/dealerships/:dealershipId/summary`  | KPIs over the whole stock (filters ignored)                                                                                        |
| GET    | `/api/vehicles/:vehicleId`                | Vehicle detail plus action history, newest first                                                                                   |
| POST   | `/api/vehicles/:vehicleId/actions`        | Log an action: `201`, `400 VALIDATION_ERROR`, `404 NOT_FOUND`, or `422 VEHICLE_NOT_AGING`                                          |
| GET    | `/api/health`                             | Liveness and database check                                                                                                        |

Every error body has the shape `{ "error": { "code", "message", "details?" } }`. There are no
update or delete endpoints for actions: history is append-only, and database triggers enforce
it too.

## Project structure

```
src/                 React web app
  app/               shell: providers, router, layout, error boundaries
  pages/             thin route components
  features/          inventory/, dealerships/, vehicle-actions/ (components, hooks, api, lib)
  components/        shared UI (Button, Dialog, Field, Select, states…) + stories
  i18n/              English and Vietnamese resources (typed keys)
  mocks/             MSW handlers mirroring the API (tests, Storybook, offline dev)
server/              Fastify API (npm workspace)
  src/modules/       dealerships/, inventory/, actions/ (routes → service → repository)
  src/db/            migrations, seeders, connection
shared/api/          Zod contract + parity scenario tables used by both sides
docs/                PRD, TRD, System Design, AI collaboration log, screenshots
.claude/             Claude Code agents and skills used to build this project
```

## Scripts

| Command                     | What it does                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------ |
| `npm run dev`               | Web + API with hot reload                                                                        |
| `npm run validate`          | Quality gate: typecheck, lint, format check, web and API tests with coverage, isolated perf test |
| `npm run build`             | Production build of the web app                                                                  |
| `npm run storybook`         | Component explorer at http://localhost:6006                                                      |
| `npm run seed:api`          | Migrate and seed the database file                                                               |
| `npm run test` / `test:api` | Watch-mode tests for web / API                                                                   |

To work on the UI without the API, set `VITE_USE_MOCKS=true` in `.env`. MSW then serves the same
contract in the browser.

## Testing approach

- **API:** service unit tests with a pinned clock (date boundaries, DST, time zones) and route
  tests through `app.inject` on in-memory SQLite. Every rejected request checks that nothing was
  stored. A restart test runs on a real database file, and a perf smoke test uses 5,000 vehicles.
- **Web:** React Testing Library + MSW. Tests query by role and label, and the 4 UI states
  (loading, error, empty, data) are covered.
- **Parity:** shared scenario tables (`shared/api/*.cases.ts`) run against both the real API and
  the MSW mock, so the mock used by web tests cannot drift from the server. They have already
  caught real divergences.
- **Real browser:** key flows were checked in headless Chrome against the real API, with axe
  accessibility checks. See the AI collaboration log.

## Documentation

| Document                                                     | Purpose                                                                      |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| [docs/SYSTEM_DESIGN.md](docs/SYSTEM_DESIGN.md)               | **System Design Document**: architecture, decisions, all assumptions         |
| [docs/PRD.md](docs/PRD.md)                                   | Requirements: user stories, acceptance criteria, business rules, assumptions |
| [docs/TRD.md](docs/TRD.md)                                   | Technical design, ADRs, task plan with status                                |
| [docs/AI_COLLABORATION_LOG.md](docs/AI_COLLABORATION_LOG.md) | How AI was directed, verified and corrected, step by step                    |
| [docs/ASSIGNMENT.md](docs/ASSIGNMENT.md)                     | The original brief                                                           |

This project was built with Claude Code as a directed collaborator. Custom agents (BA, architect,
web and API developers, tester, reviewer) and skills in [`.claude/`](.claude/) drive a
spec-driven workflow: PRD → TRD → implement in waves → independent review and test mapping →
fix rounds. Every AI output was verified before it was accepted, and the corrections are recorded
in the collaboration log.

## Status

- **Done and committed:** requirements 1-3, English/Vietnamese UI, dealership dropdown, KPIs and
  aging section, vehicle drawer with action history and logging.
- **In progress:** Refresh / "Last updated", the "Needs attention" KPI, label and filter,
  sortable column headers, and remembering the "Logged by" name. These are implemented and in
  review fixes, not yet committed.
- **Planned:** a full accessibility pass with a real screen reader, Playwright end-to-end tests,
  and an optional CSV export. A configurable aging threshold is out of scope (fixed at 90 days).

## Troubleshooting

- **`better-sqlite3` fails to install or load:** run `npm rebuild better-sqlite3`. If no
  prebuilt binary exists for your platform, install build tools (macOS:
  `xcode-select --install`; Debian/Ubuntu: `build-essential python3`) and run it again.
- **Port in use:** change `PORT` in `server/.env`. The web proxy expects 3001, so if you change
  it, also change `server.proxy` in `vite.config.ts`.
- **Ages don't match the walkthrough:** start with `APP_TODAY=2026-10-07` and a fresh
  `server/data/`.
