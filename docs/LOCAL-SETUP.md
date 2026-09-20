# Lokal/Self-Contained Drift

## Oversigt

Projektet kører selvstændigt med en Express + PostgreSQL backend (`server/`) — ingen ekstern Supabase-afhængighed.

## Hurtigstart

```bash
# Start alt med Docker Compose - ingen .env-fil nødvendig, alle værdier er faste i docker-compose.yml
docker compose up --build

# Åbn appen
# Frontend: http://localhost:8080
# Backend API: http://localhost:3001
# Database: localhost:5433
```

For at ændre porte, `JWT_SECRET`, database-password osv., rediger værdierne direkte i `docker-compose.yml`.

## Første gang

Når appen starter op for første gang uden brugere, vises en "Opret første administrator" formular på login-siden. Den første bruger bliver automatisk administrator.

## Arkitektur

```
┌─────────────┐     ┌──────────────┐     ┌────────────┐
│   Frontend   │────▶│   Backend    │────▶│ PostgreSQL │
│   (Nginx)    │     │  (Express)   │     │            │
│   port 8080  │     │  port 3001   │     │  port 5433 │
└─────────────┘     └──────────────┘     └────────────┘
```

### Frontend
- Vite/React app bygget til Nginx
- `src/services/db.ts` re-eksporterer `src/services/local-client.ts`, som er den eneste database-klient og ruter alle kald til backend'en

### Backend (`server/`)
- Express + TypeScript
- JWT-baseret autentificering
- Generisk query-handler der efterligner PostgREST-syntaks
- Lokale ækvivalenter til alle Edge Functions

### Database
- Standard PostgreSQL 16
- `server/init.sql` opretter hele skemaet + seed-data automatisk

## Miljøvariabler

Der er ingen `.env`-fil — alle værdier er hardcodet direkte i `docker-compose.yml`. Rediger filen for at ændre dem:

| Variabel | Beskrivelse | Standard |
|----------|-------------|----------|
| `VITE_LOCAL_API_URL` | Backend URL set fra frontend-build | (tom = samme-origin `/api`-proxy) |
| `POSTGRES_DB` | Database navn | `perleplade` |
| `POSTGRES_PASSWORD` | Database password | `postgres` |
| `JWT_SECRET` | JWT signerings-nøgle | (skift hvis stakken eksponeres udenfor lokalnetværket) |
| App-port (host) | Frontend port | `8080` |
| Backend-port (host) | Backend port | `3001` |

## Stop og reset

```bash
# Stop
docker compose down

# Stop og slet al data (fuld reset)
docker compose down -v
```

## Produktion

For produktion bør du:
1. Sætte et stærkt `JWT_SECRET`
2. Sætte et stærkt `POSTGRES_PASSWORD`
3. Overveje at sætte en reverse proxy (Nginx/Caddy) foran med HTTPS
4. Evt. flytte database til en separat server/managed PostgreSQL
