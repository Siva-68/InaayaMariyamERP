# HINAYA MARIYAM ERP — Implementation Plan

> **Status:** Planning complete — awaiting owner approval before any code is written.
> **Last Updated:** 2026-11-20

---

## Overview

HINAYA MARIYAM is a single-branch retail ERP and billing web application built on the MERN stack. It serves a packaged-sweets/snacks retail shop with roughly 20–50 invoices per day and 1–5 concurrent users. Android phones are the primary billing devices; laptops are used for monitoring and reports.

The build is divided into **8 phases**. Each phase is small enough to implement, type-check, lint, test, and review in one working session. No code is written until this plan is approved.

---

## Phase Map

| # | Phase | Key Output |
|---|-------|-----------|
| 0 | Workspace & Repository Setup | Monorepo scaffold, env files, CI skeleton |
| 1 | Foundation | Auth, RBAC, navigation shell, DB connection |
| 2 | Products & Inventory | Catalogue import, product CRUD, stock management |
| 3 | Billing | New Bill screen, GST, invoice creation, payments |
| 4 | Past Invoices | Immutable history, PDF generation, print/share |
| 5 | Dashboard & Reports | Analytics, Recharts, Excel/PDF exports |
| 6 | Scheduled Reports & Integrations | Daily PDF, email, WhatsApp delivery |
| 7 | Tests, Security Hardening & Deployment | Full test suite, audit, backup/restore docs |

---

## Phase 0 — Workspace & Repository Setup

**Goal:** Establish a clean, runnable monorepo that the team can build on. No application logic.

### Tasks

#### 0.1 Directory Structure
```
hinaya-mariyam-erp/
├── client/              # React + Vite + TypeScript
├── server/              # Node.js + Express + TypeScript
├── docs/                # Planning and reference docs
│   └── catalogues/      # Four product PDFs
├── scripts/             # CLI utilities (catalogue import, seed)
├── AGENTS.md
├── PROJECT_STATUS.md
├── README.md
└── .env.example
```

#### 0.2 Client Scaffold
- `pnpm create vite@latest client -- --template react-ts`
- Install: Tailwind CSS, React Router v6, Axios, React Hook Form, Zod, Recharts, Lucide Icons
- Configure `tailwind.config.ts` with the brand palette
- Configure path aliases (`@/`)
- Configure Vite PWA plugin

#### 0.3 Server Scaffold
- `pnpm init` in `server/`, TypeScript strict mode
- Install: Express, Mongoose, Zod, Helmet, cors, express-rate-limit, express-session, connect-mongo, argon2, winston, node-cron, pdfkit/puppeteer, exceljs, nodemailer, axios (WhatsApp SDK)
- Dev tools: ts-node-dev, eslint, jest, supertest
- Compile target: ES2022, module: CommonJS

#### 0.4 Environment & Secrets
- `.env.example` documenting all variables (see Open Questions)
- MongoDB connection string with replica-set option
- Session secret, CORS origin list
- WhatsApp and email credential stubs

#### 0.5 Database Connection Module
- Mongoose connect with replica-set support check
- Graceful shutdown hook
- Connection-failure crash with descriptive message

#### 0.6 Health Check
- `GET /api/health` → `{ status, db, timestamp }`

**Files Changed:** package.json (×2), tsconfig.json (×2), tailwind.config, vite.config, .env.example, README.md, PROJECT_STATUS.md

**Definition of Done:** `pnpm dev` starts both client and server; health endpoint returns 200; TypeScript compiles with zero errors.

---

## Phase 1 — Foundation: Auth, RBAC & Navigation Shell

**Goal:** Secure login, role-based access, and the four-section navigation shell.

### Tasks

#### 1.1 MongoDB: User Model
- Fields: `_id`, `name`, `email`, `passwordHash` (argon2id), `role` (enum: admin | billing_operator | accountant), `isActive`, `createdAt`, `updatedAt`
- Indexes: unique email
- Audit hook: log role changes

#### 1.2 Auth API
- `POST /api/auth/login` — rate-limited (5/min), validate body with Zod, compare argon2id hash, create session
- `POST /api/auth/logout` — destroy session
- `GET /api/auth/me` — return sanitized user (no hash)
- Cookies: HttpOnly, Secure, SameSite=Strict; session store in MongoDB via connect-mongo
- CSRF: double-submit cookie pattern for state-mutating routes

#### 1.3 RBAC Middleware
- `requireAuth` — rejects unauthenticated requests
- `requireRole(...roles)` — rejects insufficient roles
- Applied at route level, not only in React

#### 1.4 User Management API (Admin only)
- `GET /api/users` — list users (admin)
- `POST /api/users` — create user (admin)
- `PATCH /api/users/:id` — update role/active status (admin)
- Never expose `passwordHash`

#### 1.5 React: Auth Context & Protected Routes
- `AuthProvider` with `useAuth()` hook
- Login page (Zod-validated form, error states)
- `<ProtectedRoute>` wrapper
- Token-less: session cookie drives auth state

#### 1.6 Navigation Shell
- **Mobile:** hamburger → left slide-out drawer
- **Desktop:** collapsible left sidebar
- Four primary links: New Bill, Past Invoices, Products, Dashboard
- Secondary: Admin/Settings (users, business settings, report settings, logout)
- Brand logo/name and color system applied

#### 1.7 Page Shells (Placeholder)
- `/bill/new` — "New Bill coming in Phase 3"
- `/invoices` — "Past Invoices coming in Phase 4"
- `/products` — "Products coming in Phase 2"
- `/dashboard` — "Dashboard coming in Phase 5"

**Files Changed:** `server/src/models/User.ts`, `server/src/routes/auth.ts`, `server/src/routes/users.ts`, `server/src/middleware/auth.ts`, `client/src/contexts/AuthContext.tsx`, `client/src/pages/Login.tsx`, `client/src/components/Navigation/`, `client/src/App.tsx`

**Definition of Done:** Login works; wrong credentials rejected; routes protected; RBAC enforced on backend; TypeScript zero-errors; linting passes.

---

## Phase 2 — Products & Inventory

**Goal:** Product catalogue, pricing, stock management, low-stock alerts, and catalogue import tooling.

### Tasks

#### 2.1 MongoDB: Product Model
See Data Model section. Key highlights:
- `Decimal128` for all monetary fields
- `gstRate` stored as a number (%), nullable — requires admin confirmation
- `isActive` flag for soft-delete
- Unique index on `name` + `category` (or SAP code if present)

#### 2.2 MongoDB: Inventory Models
- `StockMovement` — every change to stock, reason, reference document
- `PurchaseEntry` — incoming stock (no supplier master required)
- `PriceHistory` — append-only log of price changes

#### 2.3 Product API
- `GET /api/products` — paginated, filterable, role-scoped (purchase cost hidden from billing operator)
- `POST /api/products` — admin only
- `PATCH /api/products/:id` — admin; triggers PriceHistory record
- `DELETE /api/products/:id` — blocked if has invoice history; prefer deactivation

#### 2.4 Inventory API
- `POST /api/inventory/stock-in` — admin; PurchaseEntry + StockMovement + audit
- `POST /api/inventory/adjust` — admin; reason required; StockMovement + audit
- `GET /api/inventory/movements/:productId` — paginated movement history

#### 2.5 Catalogue Import Script
- Script: `scripts/import-catalogue.ts`
- Uses pdf-parse to extract text from the four PDFs in `docs/catalogues/`
- Outputs `docs/catalogues/import-preview.json` and `docs/catalogues/import-preview.csv`
- Flags: duplicates, missing fields, conflicting prices
- Does NOT auto-import — requires human review and `--confirm` flag
- GST rates left as `null` — must be set manually

#### 2.6 React: Products Page
- List with search, filter, pagination
- Add/Edit product form (admin only)
- Price history drawer
- Stock-in form
- Stock adjustment form with reason
- Low-stock badge and threshold setting

**Definition of Done:** Product CRUD works; price changes recorded; stock-in and adjust create movement records; catalogue import produces reviewable output; role restrictions enforced; tests pass.

---

## Phase 3 — Billing & Payments

**Goal:** Mobile-first New Bill screen with GST-safe arithmetic, transactional invoice creation, and payment recording.

### Tasks

#### 3.1 MongoDB: Invoice & Payment Models
- `Invoice` — immutable after finalization; line-item snapshots; `status` (draft | finalized)
- `InvoiceLine` — embedded; snapshot of name, unit, sellingPrice, gstRate, taxableAmount, cgst, sgst, lineTotal
- `Payment` — separate collection; references invoiceId; payment method, amount, timestamp
- `InvoiceCounter` — single document per year (or format config) for sequential numbering

#### 3.2 Invoice Number Service
- Server-side only; uses `findOneAndUpdate` with `$inc` inside a transaction
- Format: `HM/YYYY/000001` (configurable via settings)
- Idempotency key: client sends UUID on `POST /api/invoices`; server deduplicates within 24h

#### 3.3 Billing API
- `POST /api/invoices` — full transaction: validate stock/price → allocate invoice number → deduct stock → create StockMovement → create Payment → create AuditLog → commit
- If any step fails → rollback; return structured error
- `POST /api/invoices/:id/payments` — record additional payment against outstanding; does not modify invoice snapshot
- Server rejects if product has `gstRate === null`

#### 3.4 GST & Money Arithmetic
- Use `decimal.js` (or `big.js`) throughout; never `Number` for monetary values
- GST-inclusive price decomposition: `taxableValue = price / (1 + gstRate/100)`
- CGST = SGST = `taxableValue × gstRate/2 / 100`
- Round to 2 decimal places consistently
- Provide utility functions with unit tests

#### 3.5 React: New Bill Screen
- Mobile-first (large touch targets, no horizontal scroll)
- Product search/autocomplete
- Cart: S.No, Description, Qty (editable), Price, Line Total
- GST summary panel
- Customer name + mobile fields
- Payment panel: Cash / UPI / Split with partial support
- Submit with idempotency UUID
- Loading, error, and success states

#### 3.6 Concurrent Stock Safety
- Transaction uses `findOneAndUpdate` with `{ stock: { $gte: requiredQty } }` condition
- If condition fails → transaction aborted → structured "insufficient stock" error returned to client
- Replica-set required; if standalone detected → refuse and show setup instructions

**Definition of Done:** Invoice created atomically; stock deducted; simultaneous billing tested; duplicate submission rejected; GST math unit-tested; TypeScript zero-errors.

---

## Phase 4 — Past Invoices & PDF Generation

**Goal:** Immutable invoice history with professional A4 PDF.

### Tasks

#### 4.1 Read-Only Invoice API
- `GET /api/invoices` — search by number, customer name/mobile, date range, payment status; paginated
- `GET /api/invoices/:id` — single invoice with payment history
- `GET /api/invoices/:id/pdf` — stream generated PDF
- NO `PUT`, `PATCH`, `DELETE` on finalized invoices
- Payment collection: `POST /api/invoices/:id/payments` only (new record, no mutation of invoice)

#### 4.2 PDF Generation Service
- Use `pdfkit` for server-side generation (or `puppeteer` if HTML layout is preferred)
- Layout: A4, content right-biased, mid-green/white identity
- Header: HINAYA MARIYAM, address placeholder, mobile (left) + GSTIN (right)
- Body: invoice number/date/time, customer, line-item table (S.No | Description | Qty | Price)
- Footer: taxable amount, CGST, SGST, grand total, amount paid, outstanding, payment method
- Quote: "Thank you for choosing HINAYA MARIYAM! Your support means a lot to us. We look forward to serving you again."
- Address/GSTIN rendered from business settings (config placeholder if unset)
- PDFs derived from saved invoice data only — never re-computed on the fly from current prices

#### 4.3 React: Past Invoices Screen
- Search bar + date/status filters
- Paginated invoice list cards
- Detail modal/page (read-only)
- Download PDF button
- Print button (opens print dialog)
- Share button: Web Share API → WhatsApp on Android
- Outstanding payment collection form (separate record)

**Definition of Done:** Invoices read-only via API; PDF matches saved data; editing blocked at API level; tests confirm immutability; mobile share works on Android.

---

## Phase 5 — Dashboard & Reports

**Goal:** Real-data analytics dashboard with role-gated exports.

### Tasks

#### 5.1 Aggregation API Endpoints
- `GET /api/reports/summary` — today/week/month: totalSales, invoiceCount, cashCollected, upiCollected, outstanding, estimatedGrossProfit (admin/accountant only)
- `GET /api/reports/product-sales` — product-wise sales, top-N
- `GET /api/reports/inventory` — current stock, low-stock list
- `GET /api/reports/gst-summary` — CGST/SGST totals by period
- All use Asia/Kolkata day boundaries
- Gross profit formula clearly documented; labelled "Estimated" always

#### 5.2 Dashboard React Page
- KPI cards: sales, invoice count, cash/UPI, outstanding
- Recharts line/bar charts with date range filters
- Top products table
- Low-stock alert list with threshold indicator
- GST summary section
- Role-gated: gross profit and cost data hidden from billing_operator

#### 5.3 Exports
- Excel export (ExcelJS): invoices, product sales, inventory
- PDF export (pdfkit): same data, branded

**Definition of Done:** All dashboard data sourced from DB aggregations; role restrictions enforced; exports tested; gross profit labelled correctly; Asia/Kolkata boundaries verified.

---

## Phase 6 — Scheduled Reports & Delivery Integrations

**Goal:** Automated nightly PDF report with email and WhatsApp delivery.

### Tasks

#### 6.1 Daily Report PDF (Server-generated)
- Page 1: Sales KPIs, invoice count, cash/UPI, outstanding, estimated gross profit, GST summary, Recharts chart exported as image
- Page 2: Complete active-product inventory (name, serial, stock, unit, price, status)
- Page 3: Purchase entries, incoming stock, adjustments, low-stock alerts, generation timestamp
- Chart image: rendered server-side using `chartjs-node-canvas` or `puppeteer`

#### 6.2 Report Scheduler
- `node-cron` job: default `0 21 * * *` Asia/Kolkata (9 PM)
- Admin-configurable time stored in `Settings` collection
- Idempotent: check for existing report for same business date before generating
- Save report metadata: `reportDate`, `generatedAt`, `filePath`, `status` (pending | generated | delivered | failed)
- Log failures with full error; retry once after 10 minutes

#### 6.3 Email Delivery
- `nodemailer` with configurable SMTP provider
- Send same PDF as attachment
- Track sent/failed status in report metadata
- If `SMTP_*` env vars absent → integration disabled; skip silently; log warning

#### 6.4 WhatsApp Delivery
- Official WhatsApp Business Cloud API (`graph.facebook.com/v18.0/...`)
- Send PDF as document message
- If `WA_*` env vars absent → integration disabled
- Never use unofficial automation
- Record delivery receipt from API response

#### 6.5 Manual Download
- Admin UI: "Generate Report" button for any past date
- Download link for any generated report
- Status indicator per report

**Definition of Done:** Scheduled job fires at configured time; duplicate prevention tested; delivery status tracked; credentials-absent path gracefully disabled; tests cover schedule, content, and retry logic.

---

## Phase 7 — Testing, Security Hardening & Deployment

**Goal:** Production-readiness.

### Tasks

#### 7.1 Backend Tests (Jest + Supertest)
- Auth: login, logout, session, rate limit, CSRF
- RBAC: each role's access to each route
- Invoice: GST math, invoice numbering, idempotency, duplicate rejection, concurrent stock
- Payments: partial, split, outstanding tracking
- Inventory: stock-in, adjustment, movement history
- Reports: aggregation, date boundaries, gross profit formula

#### 7.2 Frontend Tests (Vitest + React Testing Library)
- Login form validation
- Cart arithmetic display
- Role-gated UI elements

#### 7.3 Security Checklist
- [ ] Helmet headers configured
- [ ] CORS restricted to configured origins
- [ ] Rate limiting on auth and sensitive endpoints
- [ ] NoSQL injection: `express-mongo-sanitize`
- [ ] Input validation: Zod on every route
- [ ] Session: HttpOnly, Secure, SameSite=Strict
- [ ] CSRF: double-submit cookie
- [ ] Argon2id password hashing
- [ ] Purchase cost/profit hidden from unauthorized roles
- [ ] Audit log for all administrative and financial actions
- [ ] Secrets in env vars; `.env` in `.gitignore`
- [ ] Error responses do not leak stack traces or internal paths

#### 7.4 Backup & Restore
- `mongodump` cron job → encrypted archive → configurable backup destination
- Retention policy: configurable (default 30 days)
- Restore procedure documented and tested in staging
- Backup separate from report delivery

#### 7.5 Deployment Documentation
- `README.md`: prerequisites, local dev setup, MongoDB replica-set setup, environment variables
- `docs/DEPLOYMENT.md`: production checklist, reverse proxy (nginx), PM2/systemd, SSL, backup schedule
- `docs/WHATSAPP_SETUP.md`: WhatsApp Business Cloud API setup steps
- `docs/EMAIL_SETUP.md`: SMTP provider setup steps

**Definition of Done:** Test suite passes; security checklist signed off; backup/restore procedure tested; deployment guide reviewed.

---

## Cross-Cutting Concerns (all phases)

| Concern | Approach |
|---------|----------|
| Money arithmetic | `decimal.js` throughout; no `Number` for financial values |
| Transactions | MongoDB replica-set required; Phase 3 fails fast if standalone |
| Audit log | Append-only `AuditLog` collection; every admin/financial action |
| Invoice immutability | No `PUT`/`DELETE` on finalized invoices at API level |
| GST rates | `null` until confirmed by accountant; block finalization if null |
| Business details | Config placeholders; never invent values |
| Error handling | Structured JSON errors; no stack traces in production |
| Logging | Winston; redact tokens, hashes, PII |
| Timezone | All business-day logic in `Asia/Kolkata` |
| PWA | Service worker via Vite PWA plugin; offline shell |

---

## Technical Risk Register

| Risk | Severity | Mitigation |
|------|----------|-----------|
| MongoDB standalone (no transactions) | 🔴 High | Detect at startup; refuse Phase 3+ until replica-set confirmed |
| Concurrent overselling | 🔴 High | Atomic `findOneAndUpdate` with `$gte` stock condition inside transaction |
| Floating-point money errors | 🔴 High | `decimal.js` enforced; lint rule to catch `+` on financial values |
| GST rate ambiguity | 🟠 Medium | Store `null`; block invoice finalization; log to OPEN_QUESTIONS |
| WhatsApp unofficial automation | 🟠 Medium | Only official Business Cloud API; env-gated; never fake delivery |
| Duplicate invoice submission | 🟠 Medium | Client UUID idempotency key; server deduplication within 24h |
| PDF generation memory/timeout | 🟡 Low | Stream PDFs; set pdfkit/puppeteer timeouts; async job for reports |
| Catalogue import data quality | 🟡 Low | Import script flags conflicts; human review required before activation |

---

## Phase Sequencing Rules

1. Each phase must compile, lint, and pass tests before the next begins.
2. `PROJECT_STATUS.md` is updated at the end of every phase.
3. No real business data is invented at any stage.
4. No irreversible production actions without explicit owner approval.
5. Owner reviews and approves this plan before Phase 0 begins.
