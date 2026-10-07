# Frozen collection API fixtures

These sanitized fixtures were captured from the public Render Admin API on 2026-09-10:

- `configurator-4.json`: `GET /configurators/4?view=full&serialize=true`; reduced to representative options and variants while retaining response-shaped metadata.
- `datatable-438.json`: `GET /datatables/438`; frozen complete countertop matrix response.
- `datatable-439.json`: `GET /datatables/439`; frozen complete cabinet matrix response.
- `datatable-581.json`: `GET /datatables/581`; frozen complete Mako cabinet matrix response (`matrix-cabinet-mako`), captured 2026-09-22.
- `datatable-579.json`: `GET /datatables/579`; frozen complete Class cabinet matrix response (`matrix-cabinet-class`), captured 2026-09-24.
- `datatable-580.json`: `GET /datatables/580`; frozen complete Urban Low Height cabinet matrix response (`matrix-cabinet-urban-low-height`), captured 2026-09-24.
- `datatable-578.json`: `GET /datatables/578`; frozen complete Class countertop matrix response (`matrix-counter-top-class`), re-captured 2026-09-30 after its glass rows (2026-09-29: Glass GL, Glass MT) and its Solid Surface rows (the SS family names: Solid Surface) were renamed to the configurator's materials.
- `datatable-577.json`: `GET /datatables/577`; frozen complete Mako countertop matrix response (`matrix-counter-top-mako`), re-captured 2026-09-24 after its materials were renamed to the configurator's (Solid Surface, Porcelain, Glass GL, Glass MT, HPL).
- `datatable-589.json`: `GET /datatables/589`; frozen complete Urban Low Height countertop matrix response (`datatable-countertop-ULH`), captured 2026-09-30. It replaces the shared 438 for Urban Low Height.
- `datatable-590.json`: `GET /datatables/590`; frozen complete Urban Freestanding cabinet matrix response (`matrix-cabinet-UFS`), captured 2026-10-06. It replaces the local `cabinet-table.json` the collection read until then.
- `datatable-591.json`: `GET /datatables/591`; frozen complete Urban Freestanding countertop matrix response (`matrix-coutnertop-UFS`), captured 2026-10-06. It replaces Urban Low Height's 589 for Urban Freestanding.
- `datatable-594.json`: `GET /datatables/594`; frozen complete Urban Duplex cabinet matrix response (`matrix-cabinet-duplex`), captured 2026-10-07. Uploaded from `public/collections/urban-duplex/matrix-cabinet-urban-duplex.csv`.
- `datatable-595.json`: `GET /datatables/595`; frozen complete Urban Duplex countertop matrix response (`matrix-coutnertop-duplex`), captured 2026-10-07. Uploaded from `public/collections/urban-duplex/matrix-counter-top-urban-duplex.csv`: Urban Low Height's 589 rows for Tekorlux Rectangular, HPL, Fenix and Porcelain.
- `datatable-596.json`: `GET /datatables/596`; frozen complete Lame cabinet matrix response (`matrix-cabinet-lame`), captured 2026-10-07. Uploaded from `public/collections/lame/matrix-cabinet-lame.csv`.
- `datatable-597.json`: `GET /datatables/597`; frozen complete Lame countertop matrix response (`matrix-coutnertop-lame`), captured 2026-10-07. Uploaded from `public/collections/lame/matrix-counter-top-lame.csv`: the thin GB rows of Mako's 577, with VA030 for SS Texturizzato.
- `configurator-9.json`: `GET /configurators/9?view=full&serialize=true` (`modular-config-phase-2 (Mako)`), captured 2026-09-23; every colour it offers, plus three per section that it does not. Unlike configurator 4 it keeps one option per section and names the material on the variant, and it carries colours of other collections that have no SKU and are not offered. Both traits are kept on purpose: they are what the fixture is for.

Automated tests import these files directly and never call the live API.
