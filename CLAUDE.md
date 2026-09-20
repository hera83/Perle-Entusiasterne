# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Perleplade App — a Danish "bead plate" (perleplade) pattern gallery and editor. Users browse/favorite published patterns, admins manage users and content, and a Workshop lets users import an image or draw a pattern on a bead grid and export it as a PDF. Runs entirely on a self-hosted Express + PostgreSQL backend (`server/`) — no external hosted service.

## Commands

```bash
npm run dev          # Vite dev server on :8080
npm run build         # production build
npm run lint          # eslint .
npm run test           # vitest run (single run)
npm run test:watch    # vitest watch mode
```

Run a single test file: `npx vitest run src/test/example.test.ts`. Tests live under `src/**/*.{test,spec}.{ts,tsx}` (jsdom environment, setup file `src/test/setup.ts`).

Backend (in `server/`):
```bash
cd server
npm run dev    # tsx watch src/index.ts — Express API on :3001
npm run build  # tsc
npm run start  # node dist/index.js
```

There is no backend test suite.

## Architecture: local backend

The frontend talks to a self-hosted Express + PostgreSQL backend in `server/` via a hand-written Supabase-API-compatible shim — there is no hosted/cloud backend mode.

The indirection point is [src/services/db.ts](src/services/db.ts): all app code imports `db` from here and calls `.from()`, `.auth`, `.functions.invoke()`, `.rpc()` in the same shape as the Supabase JS client API. `db` re-exports [src/services/local-client.ts](src/services/local-client.ts)'s `localClient`, which:
- implements a `LocalQueryBuilder` that translates PostgREST-style chained filters (`.eq()`, `.ilike()`, `.in()`, `.or()`, `.range()`, embedded `select("categories(name)")` joins, etc.) into a JSON payload POSTed to `/api/query`
- implements auth (`signInWithPassword`, `signUp`, `signOut`, `onAuthStateChange`, ...) against `/api/auth/*`, storing a JWT in `localStorage`
- proxies `functions.invoke(name, ...)` to `/api/functions/:name` and `rpc(name, ...)` to `/api/rpc/:name`

On the server side, `server/src/index.ts` is a generic query handler that reconstructs SQL from that same JSON payload (`handleSelect`/`handleInsert`/`handleUpdate`/`handleUpsert`/`handleDelete`, `buildWhere`, `parseSelectWithJoins`), plus hand-written equivalents of every Supabase Edge Function and Postgres RPC used by the frontend. `server/src/schema.ts` (`RELATIONSHIPS`) is the FK map the join-embedding parser relies on — **any new relation used in a `select("table(cols)")` embed in the frontend must be added here too, or the join will silently be dropped.** Any new RPC or Edge Function called via `db.rpc()`/`db.functions.invoke()` needs a matching case added in `server/src/index.ts` — nothing dispatches to it automatically.

Database schema is defined by `server/init.sql` (full schema + seed data, applied automatically when the Postgres container starts). `supabase/migrations/*.sql` is kept only as historical documentation of how the schema evolved — it is not applied anywhere; treat `server/init.sql` as the functional source of truth and update both when changing the schema.

`AuthContext` ([src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx)) relies on the backend issuing long-lived JWTs — there is no proactive token-refresh scheduling or tab-visibility re-sync (that logic only existed for the now-removed hosted mode).

## Deployment

Single Docker Compose stack, `docker-compose.yml`: Nginx frontend (`:8080`) + Express backend (`:3001`) + Postgres (`:5433`). All configuration is hardcoded directly in the compose file — no `.env` file is needed; `docker compose up --build` works standalone. Edit `docker-compose.yml` directly to change ports, `JWT_SECRET`, or `POSTGRES_PASSWORD`. See [docs/LOCAL-SETUP.md](docs/LOCAL-SETUP.md) and [README.md](README.md) for details.

## Domain model

Core tables (see `server/src/schema.ts` and `src/integrations/supabase/types.ts`): `bead_patterns` (owned by a user, belongs to a `categories`, has a `share_token` for public sharing), `bead_plates` (one pattern is split into a grid of plates, each storing its beads as JSON, addressed by `row_index`/`column_index`), `bead_colors`, `profiles` / `user_roles` (role-based admin check, not Supabase RLS-only), `user_favorites`, `user_progress`, `pdf_downloads`, `announcements`. Admin status is determined by a row in `user_roles` with `role = 'admin'`, checked via `checkAdminRole()` in `AuthContext` and hand-implemented as an RPC in `server/src/index.ts`.

The pattern editor (`src/components/workshop/PatternEditor.tsx`, `InteractiveBeadGrid.tsx`) is the largest/most complex component — it edits a pattern's plate grid interactively. `src/lib/generatePatternPdf.ts` exports a pattern to PDF via `jspdf`.

## UI stack

shadcn/ui (Radix primitives) + Tailwind, all UI primitives pre-generated under `src/components/ui/` — treat these as vendored, not hand-authored. Path alias `@/*` → `src/*` (set in `vite.config.ts` and `tsconfig`). App UI text/labels are in Danish; keep new UI copy consistent with that.

`eslint.config.js` disables `@typescript-eslint/no-unused-vars` — don't rely on lint to catch unused vars.
