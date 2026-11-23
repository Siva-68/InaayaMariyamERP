# HINAYA MARIYAM ERP — Open Questions

> These items must be confirmed by the business owner, accountant, or IT team before the relevant features can go live. Placeholders are used in the application until these are resolved.
> **Last Updated:** 2026-11-20

---

## 🔴 Blocking — Required Before Live Billing

These items block production use of the billing system.

| # | Item | Why Needed | Who Provides |
|---|------|-----------|-------------|
| OQ-01 | **GSTIN** (GST Identification Number) | Printed on every invoice; required for GST compliance | Business owner / accountant |
| OQ-02 | **GST rates per product** | Each product's GST % (5%, 12%, 18%, 0%, etc.); cannot be inferred from catalogue discount/margin percentages | Accountant |
| OQ-03 | **GST treatment** (GST-inclusive or GST-exclusive selling prices) | Determines how tax is decomposed from selling price | Accountant |
| OQ-04 | **Registered legal business name** (if different from "HINAYA MARIYAM") | May be required on tax invoices | Business owner |
| OQ-05 | **Shop address** (complete, with PIN code) | Printed on invoices and reports | Business owner |
| OQ-06 | **Business phone number** | Printed on invoices | Business owner |
| OQ-07 | **Opening stock quantities** | Required to initialize inventory accurately | Business owner |
| OQ-08 | **Purchase prices** (per product, to enable gross profit estimation) | Needed for dashboard profit calculations | Business owner |

---

## 🟠 Required Before Report Delivery Goes Live

| # | Item | Why Needed | Who Provides |
|---|------|-----------|-------------|
| OQ-09 | **Owner's WhatsApp number** (for report delivery) | Recipient of nightly PDF report | Business owner |
| OQ-10 | **WhatsApp Business Account** (verified phone number registered with Meta) | Required for official WhatsApp Business Cloud API | Business owner / IT |
| OQ-11 | **WhatsApp Business Cloud API credentials**: `WA_PHONE_NUMBER_ID`, `WA_ACCESS_TOKEN`, `WA_BUSINESS_ACCOUNT_ID` | Server-to-API authentication for WhatsApp delivery | Business owner / IT |
| OQ-12 | **WhatsApp message template** (pre-approved by Meta for document delivery) | Required for Business-initiated messages; must be approved before first send | Business owner / IT |
| OQ-13 | **Email address(es)** for report delivery | Report recipients | Business owner |
| OQ-14 | **SMTP credentials**: host, port, username, password (or OAuth2 for Gmail/Google Workspace) | Email delivery provider | Business owner / IT |

---

## 🟡 Required Before Production Deployment

| # | Item | Why Needed | Who Provides |
|---|------|-----------|-------------|
| OQ-15 | **Hosting server / provider** (VPS, managed hosting, cloud, etc.) | Deployment target for backend and database | Business owner / IT |
| OQ-16 | **Domain name** (if any) | Public URL and SSL certificate setup | Business owner / IT |
| OQ-17 | **MongoDB deployment** (replica set capable): Atlas cluster URL or self-hosted | Transactions require replica set; standalone MongoDB is not supported | IT |
| OQ-18 | **Backup storage destination** (e.g. S3, Google Drive, local path) | Encrypted database backups | Business owner / IT |
| OQ-19 | **Session secret** (long random string) | Express session encryption | IT generates |
| OQ-20 | **Initial admin user credentials** (name, email, password) | First login to system | Business owner |

---

## 🟢 Business Policy — Required Before Feature Activation

| # | Item | Why Needed | Who Provides |
|---|------|-----------|-------------|
| OQ-21 | **Discount policy** (if any): thresholds, amounts, who approves | Discount feature is currently disabled; needs explicit policy | Business owner |
| OQ-22 | **Return/exchange policy**: conditions, approval workflow, refund method | Returns feature is not implemented; policy needed first | Business owner |
| OQ-23 | **Invoice number format preference** (default: `HM/YYYY/000001`) | Configurable; confirm format and starting number | Business owner |
| OQ-24 | **Report delivery time** (default: 9:00 PM Asia/Kolkata) | Nightly automated report schedule | Business owner |
| OQ-25 | **Low-stock threshold** (default per product, global default if any) | Alert configuration | Business owner |
| OQ-26 | **Outstanding payment follow-up workflow** | How to handle unpaid balances | Business owner |

---

## 📋 Product Catalogue — Pending Review

| # | Item | Why Needed | Who Provides |
|---|------|-----------|-------------|
| OQ-27 | **Catalogue import review** | Automated import will flag duplicates, conflicts, and missing values; a human must approve each product before activation | Business owner |
| OQ-28 | **Barcode / SAP code mapping** | Some products may appear in multiple catalogues with different codes; deduplication needed | Business owner |
| OQ-29 | **Category taxonomy** | Final agreed list of product categories | Business owner |

---

## How These Are Handled in the Application

1. **GST rates (OQ-02):** Stored as `null` in the database. The billing screen will display a warning and **block invoice finalization** until confirmed.
2. **Business details (OQ-01, OQ-04–06):** Rendered as `[PLACEHOLDER]` on invoices and reports. Admin settings panel allows updating without code changes.
3. **WhatsApp/Email (OQ-09–14):** Integrations are disabled when env vars are absent. The application logs a warning and allows manual report download. Never fabricates delivery status.
4. **Discount/Return (OQ-21–22):** Features are commented/disabled in code with `// DISABLED: requires OQ-21 approval` annotation.
5. **Opening stock (OQ-07):** System starts with zero stock. Admin can record stock-in entries to set opening quantities.

---

## Tracking Status

Update this table as items are confirmed:

| OQ # | Confirmed | Date | Confirmed By | Notes |
|------|-----------|------|-------------|-------|
| OQ-01 | ☐ | | | |
| OQ-02 | ☐ | | | |
| OQ-03 | ☐ | | | |
| OQ-04 | ☐ | | | |
| OQ-05 | ☐ | | | |
| OQ-06 | ☐ | | | |
| OQ-07 | ☐ | | | |
| OQ-08 | ☐ | | | |
| OQ-09 | ☐ | | | |
| OQ-10 | ☐ | | | |
| OQ-11 | ☐ | | | |
| OQ-12 | ☐ | | | |
| OQ-13 | ☐ | | | |
| OQ-14 | ☐ | | | |
| OQ-15 | ☐ | | | |
| OQ-16 | ☐ | | | |
| OQ-17 | ☐ | | | |
| OQ-18 | ☐ | | | |
| OQ-19 | ☐ | | | |
| OQ-20 | ☐ | | | |
| OQ-21 | ☐ | | | |
| OQ-22 | ☐ | | | |
| OQ-23 | ☐ | | | |
| OQ-24 | ☐ | | | |
| OQ-25 | ☐ | | | |
| OQ-26 | ☐ | | | |
| OQ-27 | ☐ | | | |
| OQ-28 | ☐ | | | |
| OQ-29 | ☐ | | | |
