Read `AGENTS.md`, `docs/PROJECT_BRIEF.md`, `docs/DATA_MODEL.md`, `PROJECT_STATUS.md` and the existing source code.

Implement PHASE 2 ONLY: product catalogue and inventory management.

Build Mongoose models, validated APIs and responsive UI for categories, products, product price history, purchases/incoming stock, inventory movements and low-stock thresholds. Support configurable package/carton conversion per product. Do not require supplier master records. Restrict purchase cost and profit-related fields to authorized roles. Use audit records for price and stock changes. Prefer deactivation over deleting products with transaction history.

Create an import script/template for catalogues in `docs/catalogues/`. If the PDFs are not present in that folder, do not pretend to have extracted them; create the import template and list missing files. Flag ambiguous/conflicting catalogue rows for manual review. Do not invent GST rates or initial stock.

Add tests for product validation, price updates, carton conversion, stock-in and stock adjustment. Run checks and tests, update `PROJECT_STATUS.md`, and report exactly what is complete. Do not implement billing yet.
