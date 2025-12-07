# Portfolio Manager

Simple portfolio projection tool with a React (Vite) frontend and an Express + PostgreSQL backend.

## Setup
1) Install dependencies
   - Frontend: `cd client && npm install`
   - Backend: `cd server && npm install`
2) Configure environment
   - Backend: create `server/.env` with your DB creds (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`, optional `PORT` for the API; defaults to 5001).
   - Frontend: set `VITE_API_URL` if your API is not `http://localhost:5001`.
3) Provision database
   - Create DB/user as needed (example): `createuser portfolio_user --pwprompt`, `createdb portfolio_manager -O portfolio_user`
   - Apply schema: `psql -U <db_user> -d portfolio_manager -f database/schema.sql`

## Run (two terminals)
- Backend API: `cd server && npm run dev` (or `npm start` if you prefer plain node)
- Frontend: `cd client && npm run dev` (Vite will print the local URL)

## Optional
- Seed a test user/portfolio: `curl http://localhost:5001/api/seed`
