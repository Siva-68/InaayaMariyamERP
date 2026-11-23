Read `AGENTS.md`, the project brief, existing invoice model and `PROJECT_STATUS.md`.

Implement PHASE 4 ONLY: immutable past invoices and invoice documents.

Create a past-invoice screen with search by invoice number/customer/mobile, date and payment filters, read-only detail view, PDF download, printing and sharing. The API must not expose edit/delete endpoints for finalized invoices. Payment collection against an outstanding invoice must be a separate payment record and must not modify the original invoice snapshot.

Generate a professional A4 PDF using the HINAYA MARIYAM mid-green/white identity. Include shop name/address placeholder, mobile left and GSTIN right, invoice number/date/time, customer details, line-item table, taxable amount, CGST, SGST, discount only if configured, grand total, amount paid, balance, payment method and footer quote. Do not invent missing business details. Support multiple pages and correct print margins.

Test that invoice data cannot be edited/deleted through the API and that PDF contents are derived from the saved invoice. Update `PROJECT_STATUS.md` and report tests.
