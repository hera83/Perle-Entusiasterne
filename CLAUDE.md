# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Perleplade App — a Danish "bead plate" (perleplade) pattern gallery and editor. Users browse/favorite published patterns, admins manage users and content, and a Workshop lets users import an image or draw a pattern on a bead grid and export it as a PDF. Originally scaffolded and still edited via Lovable.ai (`lovable-tagger` dev plugin, `.lovable/plan.md` tracks in-flight Lovable-authored plans).

## Commands

```bash
npm run dev          # Vite dev server on :8080
npm run build         # production build
npm run build:dev     # dev-mode build (used by Lovable preview)
npm run lint          # eslint .
npm run test           # vitest run (single run)
npm run test:watch    # vitest watch mode
```

Run a single test file: `npx vitest run src/test/example.test.ts`. Tests live under `src/**/*.{test,spec}.{ts,tsx}` (jsdom environment, setup file `src/test/setup.ts`).

Backend (local mode only, in `server/`):
```bash
cd server
npm run dev    # tsx watch src/index.ts — Express API on :3001
npm run build  # tsc
npm run start  # node dist/index.js
```

There is no backend test suite.

## Architecture: dual backend mode

The frontend can run against **two different backends** without code changes, selected by `VITE_BACKEND_MODE`:

- **Hosted mode** (default, `VITE_BACKEND_MODE` unset): talks to Lovable Cloud / hosted Supabase directly via `@supabase/supabase-js` (`src/integrations/supabase/client.ts`).
- **Local mode** (`VITE_BACKEND_MODE=local`): talks to a self-hosted Express + PostgreSQL backend in `server/`, via a hand-written Supabase-API-compatible shim.

The indirection point is [src/services/db.ts](src/services/db.ts): all app code imports `db` from here (never `supabase` directly) and calls `.from()`, `.auth`, `.functions.invoke()`, `.rpc()` exactly as it would on the real Supabase client. `db` resolves to either the real `supabase` client or [src/services/local-client.ts](src/services/local-client.ts)'s `localClient`, which:
- implements a `LocalQueryBuilder` that translates PostgREST-style chained filters (`.eq()`, `.ilike()`, `.in()`, `.or()`, `.range()`, embedded `select("categories(name)")` joins, etc.) into a JSON payload POSTed to `/api/query`
- implements auth (`signInWithPassword`, `signUp`, `signOut`, `onAuthStateChange`, ...) against `/api/auth/*`, storing a JWT in `localStorage`
- proxies `functions.invoke(name, ...)` to `/api/functions/:name` and `rpc(name, ...)` to `/api/rpc/:name`

On the server side, `server/src/index.ts` is a generic query handler that reconstructs SQL from that same JSON payload (`handleSelect`/`handleInsert`/`handleUpdate`/`handleUpsert`/`handleDelete`, `buildWhere`, `parseSelectWithJoins`), plus hand-written equivalents of every Supabase Edge Function and Postgres RPC used by the frontend. `server/src/schema.ts` (`RELATIONSHIPS`) is the FK map the join-embedding parser relies on — **any new relation used in a `select("table(cols)")` embed in the frontend must be added here too, or local mode will silently drop the join.** Any new RPC or Edge Function called via `db.rpc()`/`db.functions.invoke()` needs a matching case added in `server/src/index.ts` — nothing dispatches to it automatically.

Supabase Edge Functions live in `supabase/functions/*` (real, hosted-mode implementations); their local-mode equivalents are the `/api/functions/*` routes in `server/src/index.ts`. Keep both in sync when changing behavior — there is no code sharing between them.

Database schema/migrations under `supabase/migrations/*.sql` are the source of truth and are shared by both modes: in local mode, `server/init.sql` plus `docker/volumes/db/apply-migrations.sh` apply these same migration files against the local Postgres container on startup.

`AuthContext` ([src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx)) branches on `isLocalMode` for session-refresh behavior: hosted mode schedules proactive token refresh every 55 minutes and re-syncs on tab visibility change; local mode issues long-lived JWTs and skips all of that. `src/lib/patch-supabase-auth.ts` / `src/lib/clock-skew-storage.ts` patch the real Supabase client's storage (hosted mode only, must be the first import) to tolerate client/server clock skew — irrelevant in local mode.

## Deployment topologies

Two independent Docker Compose stacks (see [docs/LOCAL-SETUP.md](docs/LOCAL-SETUP.md) and [README.md](README.md) for full details):

- `docker-compose.yml` — cloud mode, frontend container only, talks out to hosted Supabase via `.env`.
- `docker-compose.local.yml` — full local stack: Nginx frontend (`:8080`) + Express backend (`:3001` / `:BACKEND_PORT`) + Postgres (`:5433`), configured via `.env.local` (copy from `.env.local.example`).

An alternate local topology (referenced in `docs/LOCAL-SETUP.md`) runs the *hosted-mode* Supabase stack itself locally (Postgres, Auth, PostgREST, Realtime, Storage, Edge Functions, Kong, Studio) via `docker/volumes/*` — this is different from the `server/` Express backend; don't conflate the two "local" setups.

## Domain model

Core tables (see `server/src/schema.ts` and `src/integrations/supabase/types.ts`): `bead_patterns` (owned by a user, belongs to a `categories`, has a `share_token` for public sharing), `bead_plates` (one pattern is split into a grid of plates, each storing its beads as JSON, addressed by `row_index`/`column_index`), `bead_colors`, `profiles` / `user_roles` (role-based admin check, not Supabase RLS-only), `user_favorites`, `user_progress`, `pdf_downloads`, `announcements`. Admin status is determined by a row in `user_roles` with `role = 'admin'`, checked via `checkAdminRole()` in `AuthContext` (hosted: RPC/RLS; local: same RPC name, hand-implemented in `server/src/index.ts`).

The pattern editor (`src/components/workshop/PatternEditor.tsx`, `InteractiveBeadGrid.tsx`) is the largest/most complex component — it edits a pattern's plate grid interactively. `src/lib/generatePatternPdf.ts` exports a pattern to PDF via `jspdf`.

## UI stack

shadcn/ui (Radix primitives) + Tailwind, all UI primitives pre-generated under `src/components/ui/` — treat these as vendored, not hand-authored. Path alias `@/*` → `src/*` (set in `vite.config.ts` and `tsconfig`). App UI text/labels are in Danish; keep new UI copy consistent with that.

`eslint.config.js` disables `@typescript-eslint/no-unused-vars` — don't rely on lint to catch unused vars.
