# Frozen collection API fixtures

These sanitized fixtures were captured from the public Render Admin API on 2026-09-10:

- `configurator-4.json`: `GET /configurators/4?view=full&serialize=true`; reduced to representative options and variants while retaining response-shaped metadata.
- `datatable-438.json`: `GET /datatables/438`; frozen complete countertop matrix response.
- `datatable-439.json`: `GET /datatables/439`; frozen complete cabinet matrix response.
- `datatable-581.json`: `GET /datatables/581`; frozen complete Mako cabinet matrix response (`matrix-cabinet-mako`), captured 2026-09-22.

Automated tests import these files directly and never call the live API.
