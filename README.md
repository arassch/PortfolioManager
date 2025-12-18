# Portfolio Planner

Simple portfolio projection tool with a React (Vite) frontend and an Express + PostgreSQL backend.

## Setup
1) Install dependencies
   - Frontend: `cd client && npm install`
   - Backend: `cd server && npm install`
2) Configure environment
   - Backend: create `server/.env` with:
     - DB: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT` (or `DATABASE_URL`)
     - API: `PORT` (default 5001), `ALLOWED_ORIGINS` (comma-separated list, e.g. `http://localhost:5173`)
     - Auth: `JWT_SECRET` (strong random), optional `JWT_TTL` (default `10m`), optional `ALLOW_SEED` (`true` only in local if you want `/api/seed`), optional `SEED_PASSWORD` for the seeded user
     - Google Sign-In (optional): `GOOGLE_CLIENT_ID` (OAuth client ID)
     - Email (verification/reset): set either SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`) or `RESEND_API_KEY`; use `CLIENT_URL`/`VERIFY_URL_BASE`/`RESET_URL_BASE` for links. If not configured, verification links are printed to the server console.
   - Frontend: set `VITE_API_URL` if your API is not `http://localhost:5001`. For Google Sign-In, set `VITE_GOOGLE_CLIENT_ID` to the same OAuth client ID.
3) Provision database
   - Create DB/user as needed (example): `createuser portfolio_user --pwprompt`, `createdb portfolio_manager -O portfolio_user`
   - Apply schema: `psql -U <db_user> -d portfolio_manager -f database/schema.sql`

## Run (two terminals)
- Backend API: `cd server && npm run dev` (or `npm run start` if you prefer plain node)
- Frontend: `cd client && npm run dev` (Vite will print the local URL)

## Optional
- Seed a test user/portfolio (local only; requires `ALLOW_SEED=true`): `curl http://localhost:5001/api/seed`
