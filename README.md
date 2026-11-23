# HINAYA MARIYAM ERP

A mobile-first retail ERP and billing web application for a single-branch packaged sweets/snacks retail business.

**Stack:** React + Vite + TypeScript + Tailwind CSS | Node.js + Express + TypeScript | MongoDB (replica-set)

---

## Prerequisites

- Node.js ≥ 18 (v22 recommended)
- npm ≥ 10
- MongoDB with replica-set support (required for transactions — see below)

---

## Quick Start (Development)

### 1. Clone / open this workspace

```bash
cd hinaya-mariyam-erp
```

### 2. Install dependencies

```bash
# Install root + all workspaces
npm install
```

### 3. Configure environment

```bash
cp .env.example server/.env
# Edit server/.env — fill in MONGODB_URI and SESSION_SECRET at minimum
```

### 4. Start MongoDB with replica set (local dev)

```bash
# Option A — Docker Compose (recommended for local dev)
docker compose up -d

# Option B — bare mongod (single-node replica set)
mongod --replSet rs0 --dbpath ./data/db --port 27017 --bind_ip 127.0.0.1
# Then in a mongo shell (once only):
#   rs.initiate()
```

### 5. Run development servers

```bash
npm run dev              # starts both client (port 5173) and server (port 3001)
# or individually:
npm run dev:client
npm run dev:server
```

### 6. Verify

- Client: http://localhost:5173
- Server health: http://localhost:3001/api/health

---

## MongoDB Replica-Set Requirement

MongoDB **transactions** (required for atomic invoice + stock operations) only work on a replica-set deployment. A standalone `mongod` will cause Phase 3 (billing) to fail at startup with a clear error message.

**Local single-node replica set setup:**

```bash
# 1. Create data directory
mkdir -p data/db

# 2. Start mongod with replica-set mode
mongod --replSet rs0 --dbpath ./data/db --port 27017 --bind_ip 127.0.0.1

# 3. In another terminal, initialize (run once)
mongosh --eval "rs.initiate({ _id: 'rs0', members: [{ _id: 0, host: '127.0.0.1:27017' }] })"

# 4. Set MONGODB_URI in server/.env:
# MONGODB_URI=mongodb://127.0.0.1:27017/hinaya_mariyam_erp?replicaSet=rs0
```

**Managed option:** MongoDB Atlas free-tier M0 cluster supports replica sets.

---

## Live Demo & Verified Credentials

- **Frontend App:** http://localhost:5173
- **Backend Health:** http://localhost:3001/api/health
- **Demo Store Owner Account:**
  - **Email:** `sivaprakashs127@gmail.com`
  - **Password:** `Siva_6805`
  - **Role:** `admin` (Full store access, gross profit analytics, catalogue management)
- **Admin Mobile:** `9698603288`
- **Admin Email:** `sivaprakashs127@gmail.com`

---

## Database Backup & Restore

```bash
# Perform a full snapshot backup of all collections to ./backups/
npm run backup

# Inspect available backups (Dry-run mode)
npm run restore

# Execute restoration from the latest backup
npm run restore -- --confirm

# Or specify a particular backup directory
npm run restore -- --dir ./backups/backup_20261120131423 --confirm
```

---

## Project Structure

```
hinaya-mariyam-erp/
├── client/              # React + Vite + TypeScript frontend
├── server/              # Node.js + Express + TypeScript backend
├── docs/                # Architecture, data model, API contract, planning
│   └── catalogues/      # Four product catalogue PDFs (source data)
├── scripts/             # CLI utilities (catalogue import, etc.)
├── AGENTS.md            # Agent workspace rules
├── PROJECT_STATUS.md    # Current build status
├── README.md            # This file
└── .env.example         # Environment variable reference
```

---

## Available Scripts

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start client + server in watch mode |
| `npm run dev:client` | Start Vite dev server only |
| `npm run dev:server` | Start Express server in watch mode only |
| `npm run build` | Build client + server for production |
| `npm run type-check` | TypeScript check on client + server |
| `npm run lint` | ESLint on client + server |
| `npm test` | Run test suites |

---

## Environment Variables

See `.env.example` for the full list. Copy it to `server/.env` for local development.

---

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — System design and data flow
- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) — MongoDB collections and indexes
- [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md) — REST endpoint reference
- [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) — Phased build plan
- [`docs/OPEN_QUESTIONS.md`](docs/OPEN_QUESTIONS.md) — Business info still needed

---

## Licence

Private — HINAYA MARIYAM business use only.
