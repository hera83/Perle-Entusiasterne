# Perleplade App

En dansk perlepladeapplikation bygget med React, Vite, Tailwind CSS, Express og PostgreSQL.

## Teknologier

- Vite + React + TypeScript
- shadcn-ui + Tailwind CSS
- Express + PostgreSQL (selvstændig backend i `server/`)

---

## 🚀 Kør med Docker (anbefalet)

Én fast opsætning: frontend (Nginx) + backend (Express) + PostgreSQL. Ingen `.env`-fil nødvendig — alle værdier er hardcodet i `docker-compose.yml`.

```bash
docker compose up --build
```

| Service        | URL                    |
| -------------- | ---------------------- |
| Frontend (app) | http://localhost:8080  |
| Backend API    | http://localhost:3001  |
| PostgreSQL     | localhost:5433          |

Ved første opstart uden brugere vises et "Opret første administrator"-flow på login-siden — den første oprettede bruger bliver automatisk administrator.

### Stop / nulstil

```bash
# Stop
docker compose down

# Stop og slet al data (fuld nulstilling af databasen)
docker compose down -v
```

### Ændre konfiguration (fx til produktion)

Der er ingen `.env`-fil — rediger værdierne (porte, `JWT_SECRET`, `POSTGRES_PASSWORD` osv.) direkte i `docker-compose.yml`. Se [docs/LOCAL-SETUP.md](docs/LOCAL-SETUP.md) for flere detaljer om arkitekturen og produktionshærdning.

---

## 📁 Fil-struktur (Docker-relateret)

```
├── docker-compose.yml    # Fast opsætning: frontend + backend + Postgres, ingen .env nødvendig
├── Dockerfile            # Frontend multi-stage build (Vite build -> Nginx)
├── server/
│   ├── Dockerfile        # Backend build (Express + TypeScript)
│   ├── init.sql          # Fuldt databaseskema + seed-data, køres automatisk ved DB-opstart
│   └── src/               # Express API (query-handler, auth, RPC/edge-function-ækvivalenter)
└── supabase/
    └── migrations/        # Historik over skemaændringer (dokumentation - server/init.sql er den funktionelle sandhed)
```

---

## Lokal udvikling (uden Docker)

```bash
# Klon repo
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>

# Installer dependencies
npm install

# Start dev server
npm run dev
```

Kræver Node.js – [installer med nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

For at køre frontend uden Docker mod backend'en, se opsætningen af `server/` i [docs/LOCAL-SETUP.md](docs/LOCAL-SETUP.md).
