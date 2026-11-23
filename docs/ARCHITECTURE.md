# HINAYA MARIYAM ERP — Architecture

> **Status:** Planned — not yet implemented.
> **Last Updated:** 2026-11-20

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                             │
│   React 18 + Vite + TypeScript + Tailwind CSS                   │
│   React Router v6 · React Hook Form · Zod · Recharts           │
│   Lucide Icons · Axios · Vite PWA Plugin                        │
│   (Runs in browser — Android phone primary, desktop secondary)  │
└───────────────────────────┬─────────────────────────────────────┘
                            │  HTTPS REST (JSON)
                            │  HttpOnly session cookie
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Server Layer                              │
│   Node.js + Express + TypeScript                                │
│   Helmet · CORS · express-rate-limit · express-mongo-sanitize   │
│   express-session + connect-mongo · argon2 · Zod               │
│   winston · node-cron · pdfkit · exceljs                        │
│   nodemailer · axios (WhatsApp Cloud API)                       │
└──────────┬────────────────────────────────────┬─────────────────┘
           │  Mongoose ODM                      │  External APIs
           ▼                                    ▼
┌───────────────────────┐         ┌─────────────────────────────┐
│   MongoDB Replica Set  │         │  WhatsApp Business Cloud API │
│   (3-node minimum for  │         │  SMTP Email Provider         │
│    transactions)       │         │  (both optional/env-gated)   │
└───────────────────────┘         └─────────────────────────────┘
```

---

## 2. Monorepo Structure

```
hinaya-mariyam-erp/
├── client/                    # React frontend
│   ├── src/
│   │   ├── assets/            # Brand images
│   │   ├── components/        # Shared UI components
│   │   │   ├── Navigation/    # Sidebar, Drawer, Header
│   │   │   ├── ui/            # Button, Input, Modal, Badge…
│   │   │   └── charts/        # Recharts wrappers
│   │   ├── contexts/          # AuthContext, SettingsContext
│   │   ├── hooks/             # useAuth, useProducts, useInvoice…
│   │   ├── pages/             # Route-level page components
│   │   │   ├── Login.tsx
│   │   │   ├── NewBill.tsx
│   │   │   ├── PastInvoices.tsx
│   │   │   ├── Products.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   └── Settings/
│   │   ├── services/          # Axios API clients
│   │   ├── types/             # Shared TypeScript types
│   │   └── utils/             # Money arithmetic, date helpers
│   ├── public/
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── tsconfig.json
│
├── server/                    # Express backend
│   ├── src/
│   │   ├── config/            # db.ts, session.ts, cors.ts
│   │   ├── models/            # Mongoose models
│   │   ├── routes/            # Express routers
│   │   ├── controllers/       # Route handlers
│   │   ├── services/          # Business logic
│   │   │   ├── invoiceService.ts
│   │   │   ├── stockService.ts
│   │   │   ├── pdfService.ts
│   │   │   ├── reportService.ts
│   │   │   └── deliveryService.ts
│   │   ├── middleware/        # auth, rbac, validate, error
│   │   ├── jobs/              # node-cron scheduled tasks
│   │   ├── utils/             # money.ts, logger.ts, audit.ts
│   │   └── index.ts           # Express app entry
│   ├── tests/
│   └── tsconfig.json
│
├── scripts/                   # CLI tools (catalogue import, seed)
├── docs/                      # Architecture, data model, API docs
│   └── catalogues/            # Four source PDFs
├── AGENTS.md
├── PROJECT_STATUS.md
├── README.md
└── .env.example
```

---

## 3. Data Flow

### 3.1 Billing (Critical Path)

```
Android Phone (Browser)
     │  POST /api/invoices  { idempotencyKey, cart, customer, payment }
     ▼
Express Route → Zod Validate → requireAuth → requireRole(admin | billing_operator)
     │
     ▼
InvoiceService.createInvoice()
  │
  ├─ Open MongoDB Transaction (session)
  │
  ├─ Duplicate check (idempotency key)
  │
  ├─ For each cart line:
  │    └─ Product.findOneAndUpdate({ _id, stock: { $gte: qty } }, { $inc: { stock: -qty } })
  │         └─ If condition fails → throw InsufficientStockError → abort transaction
  │
  ├─ Revalidate prices (compare server price with client-submitted price)
  │
  ├─ InvoiceCounter.findOneAndUpdate → allocate next invoice number
  │
  ├─ Invoice.create (with line snapshots)
  │
  ├─ Payment.create
  │
  ├─ StockMovement.insertMany (one per line)
  │
  ├─ AuditLog.create
  │
  └─ Commit transaction → return { invoice, invoiceNumber }
     │
     ▼
Client receives invoice → shows success → navigates to PDF/share
```

### 3.2 Report Generation (Scheduled)

```
node-cron (9 PM Asia/Kolkata)
  │
  ├─ Check DailyReport for today's date → skip if already generated
  │
  ├─ Aggregate: sales, collections, outstanding, gross profit, GST
  │
  ├─ Render chart images (chartjs-node-canvas)
  │
  ├─ Generate 3-page PDF (pdfkit)
  │
  ├─ Save file to disk / cloud storage
  │
  ├─ DailyReport.create/update (status: generated)
  │
  ├─ Email delivery (nodemailer) → update status
  │
  └─ WhatsApp delivery (official API) → update status
```

---

## 4. Security Architecture

```
Request
  │
  ├─ Helmet (security headers)
  ├─ CORS (allowlist only)
  ├─ Rate Limiting (express-rate-limit)
  ├─ express-mongo-sanitize (NoSQL injection)
  ├─ Zod body/query validation
  ├─ requireAuth (session check)
  ├─ requireRole (RBAC)
  │
  ▼
Controller / Service
  │
  ├─ AuditLog for all financial/admin actions
  ├─ Winston logger (redacts secrets/tokens/hashes)
  │
  ▼
MongoDB (credentials via env var, no browser access)
```

### Session Management
- `express-session` + `connect-mongo` (sessions in MongoDB)
- Cookie: `HttpOnly=true`, `Secure=true` (HTTPS), `SameSite=Strict`
- CSRF: double-submit cookie on state-mutating endpoints
- Session TTL: 8 hours (configurable)

---

## 5. MongoDB Deployment Requirements

| Requirement | Detail |
|-------------|--------|
| Replica Set | **Mandatory** for multi-document transactions (Phase 3+) |
| Minimum nodes | 1 primary + 1 secondary + 1 arbiter (dev); 3-node PSS (production) |
| Local dev | `mongod --replSet rs0` or Docker Compose with replica set |
| Managed | MongoDB Atlas free-tier M0 supports replica sets |
| Standalone | Phase 3 refuses to run; error message shown at startup |

### Startup Check
```typescript
const isTxCapable = mongoose.connection.db.admin().serverStatus()
  .then(s => s.repl !== undefined)
// If false → log fatal error → process.exit(1) with instructions
```

---

## 6. Frontend Architecture

### State Management
- **Server state:** Axios + React Query (or SWR) for cache and invalidation
- **Form state:** React Hook Form + Zod resolvers
- **Auth/global state:** React Context (AuthContext)
- No Redux — scope does not warrant it

### Routing
```
/                   → redirect to /bill/new (if authenticated) or /login
/login              → Login page
/bill/new           → New Bill (auth: all roles)
/invoices           → Past Invoices list (auth: all roles)
/invoices/:id       → Invoice detail + PDF (auth: all roles)
/products           → Products list (auth: admin | billing_operator)
/products/new       → Add product (auth: admin)
/products/:id       → Edit product (auth: admin)
/dashboard          → Dashboard (auth: all; profit hidden from billing_operator)
/settings           → Admin settings (auth: admin)
/settings/users     → User management (auth: admin)
/settings/reports   → Report delivery settings (auth: admin)
```

### Mobile-First Principles
- Minimum touch target: 44×44 px
- No horizontal overflow on 360 px viewport
- Hamburger drawer on `< lg` breakpoint
- Collapsible sidebar on `≥ lg` breakpoint
- Cart quantities: large +/− buttons, not tiny inputs

---

## 7. Deployment Assumptions (Initial)

| Component | Dev | Production (Recommended) |
|-----------|-----|--------------------------|
| Frontend | `vite dev` on localhost | Static build served by nginx or CDN |
| Backend | `ts-node-dev` on localhost | PM2 / systemd, reverse-proxied by nginx |
| Database | Local Docker replica set | MongoDB Atlas or self-hosted 3-node RS |
| SSL | None (dev) | Let's Encrypt / managed cert |
| File storage | Local `./reports/` | S3-compatible object storage |
| Backups | Manual | Automated `mongodump` cron + cloud upload |

> **Note:** Hosting provider is not yet confirmed. See `docs/OPEN_QUESTIONS.md`.

---

## 8. Package Versions (Planned)

| Package | Version Constraint |
|---------|-------------------|
| React | ^18.x |
| Vite | ^5.x |
| TypeScript | ^5.x |
| Tailwind CSS | ^3.x |
| React Router | ^6.x |
| Axios | ^1.x |
| React Hook Form | ^7.x |
| Zod | ^3.x |
| Recharts | ^2.x |
| Express | ^4.x |
| Mongoose | ^8.x |
| argon2 | ^0.31.x |
| decimal.js | ^10.x |
| pdfkit | ^0.14.x |
| exceljs | ^4.x |
| node-cron | ^3.x |
| nodemailer | ^6.x |
| winston | ^3.x |
| Helmet | ^7.x |
| express-rate-limit | ^7.x |

> All versions confirmed at install time against each other's peer-dependency requirements.
