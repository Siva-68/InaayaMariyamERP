# Antigravity setup for HINAYA MARIYAM ERP

The previous all-in-one prompt was a detailed specification, but it asked the agent to plan, build, integrate, test and deploy a complete ERP in a single pass. Use this kit as workspace context plus small phase prompts.

## 1. Create/open the workspace
Create an empty folder named `hinaya-mariyam-erp` (or open your existing project folder) in Antigravity.

Copy the contents of this kit into the workspace so the root contains:
- `AGENTS.md`
- `README_FIRST.md`
- `docs/PROJECT_BRIEF.md`
- `prompts/`

If you already have code, copy these files into the existing repository without replacing your source files.

## 2. Add the four catalogues
Create `docs/catalogues/` and copy the four original PDFs into it:
- `NEW MRP UPDATED DEALER PRICE LIST - 2026.pdf`
- `DEPARTMENT STORE PRODUCT LIST.pdf`
- `Premium SM Product List.pdf`
- `Retail Product List.pdf`

The Antigravity agent cannot inspect attachments that remain only in another chat. The PDFs must exist inside the Antigravity workspace for its file tools to read them.

## 3. Start in Plan mode
Open the Antigravity agent panel and run `/plan`. Paste the contents of `prompts/01_START_WITH_PLAN.md` (or use the prompt in that file after `/plan`). Review the architecture and implementation plan before approving any code changes.

Antigravity supports workspace instructions in `AGENTS.md` and planning with `/plan`. Keep the persistent project rules in `AGENTS.md`; use the phase prompts for individual tasks.

## 4. Implement one phase at a time
After approving the plan, paste one phase prompt at a time:
1. `prompts/02_PHASE_1_FOUNDATION.md`
2. `prompts/03_PHASE_2_PRODUCTS_INVENTORY.md`
3. `prompts/04_PHASE_3_BILLING.md`
4. `prompts/05_PHASE_4_INVOICES.md`
5. `prompts/06_PHASE_5_DASHBOARD_REPORTS.md`
6. `prompts/07_PHASE_6_AUTOMATED_REPORT_DELIVERY.md`

Do not paste all phase prompts together. Review the diff and test results after each phase. Do not move on while build/tests are failing.

## 5. Important external requirements
- MongoDB transactions require a replica-set-capable deployment. Use a local replica-set configuration for development or a compatible managed MongoDB deployment.
- Automated WhatsApp PDF delivery requires official WhatsApp Business Platform configuration and credentials.
- Email delivery requires a configured email provider.
- Multi-device internet access requires the backend and database to be hosted and reachable. Free hosting may have limits and is not a production reliability guarantee.
- GST rates, GSTIN, legal business details, stock opening balances and discount rules must be confirmed by the business before live billing.

## 6. If Antigravity still fails
Do not resend the entire project prompt. Ask it to fix only the first visible error. Include the complete error text and the command that produced it. If it refuses or stops, check whether the terminal command, file edit or browser action is waiting for permission approval.
