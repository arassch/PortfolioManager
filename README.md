# Portfolio Manager

Simple portfolio projection tool with a small Express + PostgreSQL backend.

## Setup
- Install dependencies: `npm install`.
- Copy `.env.example` to `.env` (or `.env.local` for Vite) and fill in your DB credentials.
- Create the database and user (example):
  - `createuser sara --pwprompt`
  - `createdb sara -O portfolio_user`
- Apply the schema: `psql -U sara -d portfolio_manager -f src/database/schema.sql`.

## Run
- Start the API: `npm run server` (nodemon) or `npm run server:type` for plain node.
- Start the Vite dev server: `npm run dev` (ensure `VITE_API_URL` points at the API).
- Seed a test user/portfolio (optional): `curl http://localhost:5000/api/seed`.
