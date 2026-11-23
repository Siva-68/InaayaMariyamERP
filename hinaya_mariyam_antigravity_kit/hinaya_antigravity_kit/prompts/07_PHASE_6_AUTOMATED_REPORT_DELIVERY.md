Read `AGENTS.md`, the project brief, current dashboard/report code and `PROJECT_STATUS.md`.

Implement PHASE 6 ONLY: scheduled daily PDF report and delivery integrations.

Default schedule: 9:00 PM Asia/Kolkata, configurable by an administrator. Generate a PDF with (1) sales/dashboard summary and a chart image rendered from actual data, (2) a complete active-product inventory table including remaining quantity/unit/selling price/status, and (3) purchases, incoming stock, adjustments and low-stock items. Store report metadata, reporting date, generated file location, generation status and delivery status. Prevent duplicate reports for the same business date and make retries safe.

Add email delivery through a configurable provider and WhatsApp document delivery through the official WhatsApp Business Cloud API only. Use environment variables for credentials. If credentials are absent, leave integrations disabled, provide clear setup documentation and allow manual report download. Never claim a message was delivered without provider confirmation. Do not use unofficial WhatsApp automation.

Keep report delivery separate from database backup. Add tests for schedule/date handling, duplicate prevention, report content, delivery failure and retry. Update `PROJECT_STATUS.md` and report results.
