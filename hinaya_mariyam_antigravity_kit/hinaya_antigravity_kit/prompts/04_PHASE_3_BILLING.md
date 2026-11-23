Read `AGENTS.md`, the project brief, approved data model/API docs and `PROJECT_STATUS.md`.

Implement PHASE 3 ONLY: core billing and payment workflow.

Build the mobile-first New Bill screen, product search, customer name/mobile fields, cart, quantity editing, line totals, configurable GST-inclusive tax calculation, invoice number allocation, cash/UPI/partial/split payments and outstanding balance tracking.

Critical requirements:
- Do not invent or hardcode GST rates. If a product has no confirmed tax configuration, block finalization and explain the missing configuration.
- Use decimal-safe money arithmetic and consistent rounding.
- Snapshot product name, unit, selling price, cost basis if used, GST rate and tax on invoice lines.
- Revalidate stock and price on the server.
- Use MongoDB transactions and atomic stock checks for invoice + payment + stock movement + audit operations.
- Use an idempotency key to prevent duplicate bills.
- Generate unique invoice numbers on the server; never generate them only in React.
- Preserve original invoice data after finalization.

Add automated tests for tax math, rounding, invoice numbering, duplicate submissions, insufficient stock, simultaneous stock deduction and partial/split payments. If MongoDB transaction support is unavailable in the configured environment, fail clearly and document the required replica-set setup rather than silently running an unsafe flow.

Run checks/tests, update `PROJECT_STATUS.md`, and report test evidence. Do not implement automated WhatsApp reporting in this phase.
