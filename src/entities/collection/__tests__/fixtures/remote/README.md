# Frozen collection API fixtures

These sanitized fixtures were captured from the public Render Admin API on 2026-09-10:

- `configurator-4.json`: `GET /configurators/4?view=full&serialize=true`; reduced to representative options and variants while retaining response-shaped metadata.
- `datatable-438.json`: `GET /datatables/438`; frozen complete countertop matrix response.
- `datatable-439.json`: `GET /datatables/439`; frozen complete cabinet matrix response.
- `datatable-581.json`: `GET /datatables/581`; frozen complete Mako cabinet matrix response (`matrix-cabinet-mako`), captured 2026-09-22.
- `datatable-579.json`: `GET /datatables/579`; frozen complete Class cabinet matrix response (`matrix-cabinet-class`), captured 2026-09-24.
- `configurator-9.json`: `GET /configurators/9?view=full&serialize=true` (`modular-config-phase-2 (Mako)`), captured 2026-09-23; every colour it offers, plus three per section that it does not. Unlike configurator 4 it keeps one option per section and names the material on the variant, and it carries colours of other collections that have no SKU and are not offered. Both traits are kept on purpose: they are what the fixture is for.

Automated tests import these files directly and never call the live API.
