/plan

You are working on the HINAYA MARIYAM Retail ERP project.

First read `AGENTS.md` and `docs/PROJECT_BRIEF.md`. Inspect the current workspace and report the files and project structure that already exist. Do not start implementing the complete ERP yet.

Create these planning artifacts:
1. `docs/IMPLEMENTATION_PLAN.md` — phased tasks small enough to implement and test independently.
2. `docs/ARCHITECTURE.md` — MERN architecture, deployment assumptions and data flow.
3. `docs/DATA_MODEL.md` — MongoDB collections, important fields, indexes and transaction boundaries.
4. `docs/API_CONTRACT.md` — initial REST endpoint list with request/response shapes and authorization.
5. `docs/OPEN_QUESTIONS.md` — all business data and external credentials still missing; do not invent answers.
6. `PROJECT_STATUS.md` — mark everything as planned/not implemented and record the current workspace status.

Prioritize a small, testable MVP. Identify technical risks including MongoDB replica-set transactions, concurrent stock deduction, immutable invoices, GST configuration, scheduled jobs and WhatsApp/email credentials.

Do not install packages, modify application source files, create fake business data or deploy anything during this planning task. If the workspace already contains code, do not overwrite it. Finish by summarizing the plan and wait for my approval before implementing Phase 1.
