# HINAYA MARIYAM — Project Brief

## 1. Goal
Build a practical, secure, mobile-first MERN web ERP for a single-branch retail business named **HINAYA MARIYAM**. It sells packaged burfi, balls, snacks, sweets, biscuits, murukku, jars, pickles, oils and related products. Expected load is approximately 20–50 invoices per day and 1–5 users. Several employees may bill simultaneously. Android phones are the primary billing devices; laptops are used mainly for monitoring and reports.

This is a small-business ERP, not a large enterprise suite. Keep the product simple and maintainable.

## 2. Required technology
- Frontend: React, Vite, TypeScript, Tailwind CSS, React Router, Axios, React Hook Form, Zod, Recharts, Lucide icons.
- Backend: Node.js, Express, TypeScript, REST API, Mongoose, Zod.
- Database: MongoDB. Use a replica-set-capable MongoDB deployment for multi-document transactions.
- Supporting: PDF generation, ExcelJS, scheduled jobs, PWA support, email provider and official WhatsApp Business Cloud API integration.
- MongoDB is the authoritative data store. Google Sheets, if added later, is only a reporting/export destination.

## 3. Visual identity
- Brand: HINAYA MARIYAM
- Subtitle: Retail ERP & Billing Management
- Mid green `#2E8B57`; dark green `#206B45`; light green `#E8F5EC`; white `#FFFFFF`; background `#F7FAF7`.
- Clean, professional, minimal, accessible and mobile-first.

## 4. Main navigation
Only four primary sections:
1. **New Bill** — create an invoice, add products and quantities, calculate totals/GST, record payment, generate PDF, print and share.
2. **Past Invoices** — search/filter/view finalized invoices, download PDF, reprint and reshare. Strictly read-only; no edits or deletion.
3. **Products** — add/edit/deactivate products, change purchase/selling prices, record incoming stock, adjust stock with reason, set low-stock threshold, view stock movements.
4. **Dashboard** — daily/weekly/monthly sales, invoice count, collections, outstanding amounts, estimated gross profit, top products, inventory and low-stock alerts, reports.

Mobile: hamburger opens a left slide-out drawer. Desktop: collapsible left sidebar. Profile, settings, user administration, report delivery settings and logout are secondary/admin controls, not extra primary navigation sections.

## 5. Users and permissions
Initial roles:
- Admin/Owner: full access, settings, product and inventory management, purchase cost, profit/GST reports, users and audit logs.
- Billing Operator: new bills, product search, permitted invoice viewing, printing and sharing.
- Accountant: authorized invoice, payment, sales and GST reports and exports.

Support individual logins for approximately 1–5 users. Enforce permissions on the server.

## 6. Product catalogue
There are four source catalogues. They must be copied into `docs/catalogues/` before asking the agent to import them:
- `NEW MRP UPDATED DEALER PRICE LIST - 2026.pdf`
- `DEPARTMENT STORE PRODUCT LIST.pdf`
- `Premium SM Product List.pdf`
- `Retail Product List.pdf`

Extract only information present in the files: serial number, product name, category, SAP/product code, barcode, packaging, pieces/weight, carton conversion, dealer price, shop price and MRP where available. Produce a reviewable CSV/JSON import file and flag possible duplicates, conflicts and missing values. Do not invent missing values. Percentages in catalogue price columns are not automatically GST rates. Do not activate ambiguous entries until reviewed.

Suggested product fields: internal ID, serial number, name, category, SAP code, barcode, pack type, net weight, pieces per pack, units per carton, purchase price, selling price, MRP, GST rate, available stock in the sellable unit, low-stock threshold and active status.

Inventory must support configurable conversions. Example: a carton of 50 packets adds 50 saleable packets; selling two packets subtracts two. Do not assume every product uses the same conversion. Supplier master management is not required initially; purchase entries can record product, quantity, purchase unit, conversion, cost and date.

## 7. Billing and payments
- Capture customer name and mobile number.
- Cart columns: S.No, Description, Quantity, Price; line amount is quantity × unit selling price.
- Revalidate price and stock on the backend during finalization.
- Generate a unique server-side sequential invoice number (format configurable; example `HM/YYYY/000001`). Use idempotency to prevent duplicate submissions.
- Payment methods: cash and UPI. Support partial and split cash/UPI payments, outstanding balance and later payments against an invoice. Preserve payment history.
- Save invoice, payments, stock deduction, inventory movement and audit records consistently in one transaction where required.
- No product return feature until the business confirms its policy.
- Discounts must remain disabled until the owner supplies the thresholds/rules.

## 8. GST and financial correctness
- Product-level GST rate configuration.
- Catalogue percentages must not be mistaken for GST rates.
- GST rates/GSTIN and applicable tax treatment must be confirmed by the business/accountant before production.
- Prices are expected to be GST-inclusive where configured. Extract taxable value correctly, calculate CGST/SGST for applicable intrastate sales and apply consistent rounding.
- Use Decimal128 or a decimal arithmetic library; do not use JavaScript floating-point arithmetic for money.
- Preserve product name, unit, unit price, cost basis where used, GST rate and tax amounts as invoice-line snapshots. Later product changes must not alter previous invoices.
- Distinguish total sales, amount collected, outstanding amounts, cost of goods sold and estimated gross profit. Do not call gross profit net profit.

## 9. Invoice output
Generate a professional A4 invoice with mid-green accents and clean white background. The requested design places the invoice content toward the right side of the A4 page. Include:
- HINAYA MARIYAM
- Shop address on next line
- Mobile number left aligned and GST number right aligned on the next line
- Invoice number, date and time
- Customer name and phone
- Table: S.No | Description | Quantity | Price
- Taxable amount, CGST, SGST, discount if applicable, grand total, amount paid, outstanding amount and payment method
- Footer quote: “Thank you for choosing HINAYA MARIYAM! Your support means a lot to us. We look forward to serving you again.”

Provide download PDF, print, mobile share sheet/WhatsApp share and reprint. Use real saved invoice data.

## 10. Invoice history integrity
Past invoices are immutable/read-only. No direct editing, deletion or overwriting finalized PDFs. If a correction/cancellation workflow is added later, it must be a separate authorized, reasoned, audited record and must preserve the original invoice.

## 11. Dashboard and daily report
Dashboard should include:
- Today/week/month sales and invoice count.
- Cash and UPI collections.
- Outstanding and partial payments.
- Product sales and top-selling items.
- Remaining stock and low-stock alerts.
- Estimated gross profit based on documented cost method.
- CGST/SGST summary.
- Recharts graphs with date filters.

Automated daily PDF report: default 9:00 PM Asia/Kolkata, configurable. PDF must contain:
- Page 1: business/date, sales, invoice count, cash/UPI, outstanding, estimated gross profit, GST summary, sales/payment charts and top products. Include a chart/dashboard image rendered from actual report data.
- Page 2: complete active product inventory with product name, serial number, remaining stock, unit, selling price and stock status.
- Page 3: purchase entries, incoming stock, adjustments, restocking alerts and generation timestamp.

Generate on backend, prevent duplicate daily reports, save report metadata/status, log failures and retry safely. Owner/admin can manually generate/download a report. Send the same PDF to configured owner/admin WhatsApp and email using official integrations. If API credentials/consent/templates are not configured, leave integration disabled and document setup; never pretend delivery occurred. These reports are not database backups.

## 12. Security and data protection
- Hash passwords with Argon2id or bcrypt.
- Prefer secure server-side sessions with HttpOnly, Secure, SameSite cookies; CSRF controls as needed.
- Rate-limit login and sensitive endpoints.
- Validate all inputs; use Helmet, restricted CORS and NoSQL injection defenses.
- Enforce role permissions on backend routes and services.
- Restrict database credentials and permissions; no direct browser-to-database access.
- Keep secrets in environment variables and provide `.env.example`; never commit real secrets.
- Redact credentials/tokens and unnecessary personal details from logs.
- Maintain append-only audit history for login, product/price/stock changes, purchases, invoices, payments, user changes, report generation and delivery.
- Implement encrypted database backups, separate backup storage, retention, status monitoring and a tested restore procedure.

## 13. Technical invariants
- Use MongoDB transactions for operations requiring multi-document consistency. The deployment must support replica sets/sharded transactions; standalone MongoDB is not sufficient.
- Use atomic stock conditions and safe transaction retry handling to prevent overselling under simultaneous billing.
- Enforce unique invoice numbers and idempotency.
- Do not expose purchase prices/profit to unauthorized users.
- Do not use Google Sheets as the primary database.
- Do not use unofficial WhatsApp automation.
- Do not invent business details, tax data, prices, stock or discount policy.

## 14. Initial delivery scope
Build in phases and keep the code runnable after each phase:
1. Inspect workspace, architecture and repository setup.
2. Foundation: React/Express/MongoDB, auth, security, responsive shell/navigation.
3. Products and inventory: catalogue import tooling, product CRUD, purchases, stock movements and low-stock.
4. Billing: customer/cart, GST calculations, invoice counter, payments and transactional stock deduction.
5. Past invoices: read-only search/view/PDF/print/share.
6. Dashboard and exports.
7. Scheduled PDF reports and WhatsApp/email integrations.
8. Tests, security review, backup/restore and deployment documentation.

Do not attempt all phases in one generation. Use small implementation tasks, run tests and fix defects after each phase.

## 15. Required deliverables
Working React frontend, Express API, MongoDB models/indexes, auth/RBAC, products, inventory, billing, payments, read-only invoice history, A4 PDFs, dashboard, Excel/PDF exports, scheduled PDF reports, integrations, audit logs, backup/restore instructions, tests, README, `.env.example`, API docs and deployment guide.

## 16. Unknown values/placeholders
Do not invent the following: registered legal business name if different, shop address, phone, GSTIN, GST rates, opening stock, purchase prices, discount rules, owner WhatsApp number, owner email, WhatsApp API credentials, SMTP credentials, final hosting provider. Use configuration placeholders and list them in `docs/OPEN_QUESTIONS.md`.
