# Northstar — banking management demo

A full-stack **simulated banking** app built with React, Express, Node.js, and MongoDB. The visual direction is a modern retail-banking dashboard, not a copy of any bank's branding. **This is a portfolio/learning demo, is not affiliated with HDFC Bank or any financial institution, and must not be used to collect real banking credentials or handle real money.** All balances and transfers are fictitious.

## Included
- React + Vite responsive dashboard, local SVG artwork, Lucide icons, login and registration.
- Express API with bcrypt password hashing, short-lived JWT in an HttpOnly cookie, signed double-submit CSRF protection, origin checks, Helmet, rate limits, and input validation.
- MongoDB models for users, accounts, immutable-style ledger entries, transfers, idempotency keys, and audit events.
- Replica-set MongoDB transactions for atomic double-entry transfers; integer minor-unit balances; optimistic sufficient-funds condition; idempotency key; compound/unique/TTL indexes.
- Cursor-paginated ledger history and aggregation-based monthly cash-flow summary.

## Requirements
Node.js 20+, npm, and Docker (or MongoDB 7 configured as a replica set). MongoDB multi-document transactions require a replica set, including in local development.

## Run locally
1. Start MongoDB as a single-node replica set:
   ```bash
   docker compose up -d mongo
   docker exec northstar-mongo mongosh --quiet --eval 'try { rs.status() } catch(e) { rs.initiate() }'
   ```
2. Copy the root `.env.example` to a root `.env` file. Replace `JWT_SECRET` with a fresh random string (32+ characters). The API loads this root `.env` whether you start it from the project root or the `server` folder.
3. Install and seed the **fictional** demo account:
   ```bash
   npm install
   npm run seed
   ```
4. Start the app:
   ```bash
   npm run dev
   ```
5. Open http://localhost:5173. Demo login: **demo@northstar.test** / **DemoPass123!**

The API runs at `http://localhost:4000`; Vite proxies `/api` to it. For an existing MongoDB replica set, update `MONGODB_URI` accordingly.

## Useful commands
- `npm run build` — build the React client into `client/dist`.
- `npm start` — start the API. For production, serve `client/dist` via a trusted static host/reverse proxy and set `CLIENT_ORIGIN`, `NODE_ENV=production`, a strong `JWT_SECRET`, and a production MongoDB replica set. Configure HTTPS so secure cookies are enabled.
- `npm run seed` — create/update the demo user and its sample accounts/ledger. Do not use this seed account in production.

## Data design notes
- `Account.balanceMinor` stores whole minor currency units, avoiding floating-point money arithmetic.
- A transfer inserts one `Transfer`, two corresponding `LedgerEntry` rows, two account balance changes, and one `IdempotencyRecord` inside a MongoDB session transaction. Repeated request keys return the original transfer rather than charging twice.
- Ledger rows are append-only by application convention; do not expose edit/delete routes. Financial changes are represented by new entries.
- The transfer UI intentionally permits transfers only between the signed-in demo user's own accounts. No external payments or real bank connections exist.
- Audit events exclude passwords, tokens, and financial account numbers; a TTL index removes old events.

## API overview
`POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `GET /api/auth/csrf`, `GET /api/dashboard`, `GET /api/transactions?limit=20&cursor=...`, `POST /api/transfers`.

## Safety
Use only invented details and the seeded demo credentials. This sample is not a regulated financial product, and its safeguards are educational—not a substitute for a security review, compliance program, or production threat model.
