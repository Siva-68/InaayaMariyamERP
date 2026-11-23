# HINAYA MARIYAM ERP — Workspace Rules

These rules apply to every task in this repository.

## Product and scope
- Build HINAYA MARIYAM, a small-retail ERP and billing web application.
- The primary navigation has exactly four sections: New Bill, Past Invoices, Products, Dashboard.
- Keep the UX mobile-first, with a left hamburger drawer on mobile and collapsible sidebar on desktop.
- Use a mid-green and white visual system: primary `#2E8B57`, dark green `#206B45`, light green `#E8F5EC`, white `#FFFFFF`, background `#F7FAF7`.
- Business context: one branch, around 20–50 bills/day, approximately 1–5 users, packaged sweets/snacks and related retail goods.

## Required stack
- MERN only: React + Vite + TypeScript, Node.js + Express + TypeScript, MongoDB + Mongoose.
- Use REST APIs. Keep frontend, backend, database, validation and business logic separated.
- Do not substitute PostgreSQL, Firebase, Supabase or Google Sheets for MongoDB.
- Use maintained compatible package versions; inspect the existing project before installing or upgrading packages.

## Business invariants
- Past/finalized invoices are read-only. Never edit or delete finalized invoice data or silently overwrite invoice PDFs.
- Corrections, if later approved, must be separate, permission-controlled, auditable adjustment records.
- Generate invoice numbers on the server. Enforce uniqueness and idempotency.
- Validate current prices and stock on the server at checkout.
- Invoice, payment, stock deduction, stock movement and audit records must be committed atomically where multi-document consistency is required. Use a MongoDB replica set for transactions.
- Prevent overselling under simultaneous billing using transactions and atomic stock checks.
- Store a snapshot of product description, unit, price, purchase cost where appropriate, GST rate and tax amounts on each invoice line. Later product edits must not change historical invoices.
- Use decimal-safe monetary calculations. Never use ordinary JavaScript floating-point arithmetic for financial totals.
- Do not invent GST rates, GSTIN, business address, contact details, opening stock, purchase prices, or discount rules. Use clearly marked configuration placeholders until confirmed.
- Do not infer GST rates from catalogue discount/margin percentages. Treat unverified tax values as requiring administrator/accountant confirmation.
- Product return policy is unconfirmed; do not implement returns without explicit approval.
- Supplier master management is out of scope for the initial release. Record purchase/stock-in entries without requiring supplier records.
- Support cash, UPI, partial payment and split cash/UPI payments. Preserve payment history separately from invoice snapshots.

## UI and navigation
- Primary sections only: New Bill, Past Invoices, Products, Dashboard.
- Put profile, users, business settings, report settings and logout in an admin/settings area, not as extra primary navigation items.
- Billing must be easy to operate on an Android phone, with large touch targets and no horizontal overflow.
- Use actual backend data. Never leave mock/demo data in production paths.
- Provide loading, error, empty and success states.

## Security
- Enforce authorization on the backend, not only in the React UI.
- Hash passwords with Argon2id or bcrypt. Prefer secure server-side sessions with HttpOnly, Secure and SameSite cookies; implement CSRF protection when needed.
- Validate all request bodies and query parameters. Add rate limiting, Helmet, restricted CORS, safe error handling and NoSQL injection protections.
- Keep secrets in environment variables; never commit credentials or real `.env` files.
- Restrict database credentials and permissions. Never connect to MongoDB directly from the browser.
- Redact credentials, session tokens and unnecessary customer data from logs.
- Record important administrative and financial actions in append-only audit logs.

## Reports and integrations
- Dashboard data and reports must be derived from persisted records, not fabricated values.
- Daily PDF report should include sales KPIs, invoice count, cash/UPI collections, outstanding amounts, estimated gross profit (clearly labelled), GST summary, charts rendered from real data, and a complete active-product stock report.
- Default report time is 9:00 PM Asia/Kolkata, configurable by the administrator.
- WhatsApp automated delivery must use the official WhatsApp Business Cloud API. Do not use unofficial WhatsApp automation. If credentials are missing, implement a disabled/configurable integration and document setup; do not pretend messages were sent.
- Email delivery must use a configured provider. Track sent/failed status.
- WhatsApp/email reports are not database backups. Implement backup and restore separately.
- Do not make external services a hard dependency for local development or core billing.

## Engineering workflow
- First inspect the repository and report what already exists. Do not overwrite working code blindly.
- Work in small, reviewable phases. Before each phase, state its goal and files likely to change.
- Do not attempt to build the entire ERP in one response or one giant code-generation pass.
- Implement real functionality, not just mock screens. After each change, run relevant type checks, linting and tests; fix errors before marking the phase complete.
- Keep `PROJECT_STATUS.md` current with completed work, pending work, known defects, required environment variables and test results.
- Add or update README and `.env.example` when configuration changes.
- Do not claim a feature is complete unless it has been implemented and verified.
- Do not deploy, delete data, rotate credentials, or perform irreversible actions without explicit user approval.
