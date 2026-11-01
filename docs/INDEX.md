# Documentation map

The documents under `docs/`, in the order they are meant to be read, each with what it is for.

**Maintained** documents describe the current product and are kept true. **Records** are
provenance: they say what was true when they were written and are not kept in sync with the
product.

## Workspace context

- [HASTINGS-SOLUTIONS project map](../../../PROJECT-MAP.md) — portfolio boundaries and shared product knowledge.
- [MODULAR project map](../../PROJECT-MAP.md) — component ownership, integration boundaries and documentation routes.
- [Repository instructions](../AGENTS.md) — starting points and scope for work in this checkout.

These links use the current portfolio layout; the maps live outside this Git repository.

## Maintained

- [AI workflow diagrams](../ai/workflow-diagrams.md) — Implementation lifecycle, review loops and runtime permission gates; visual explanation of the [common workflow](../ai/workflow.md).
- [`products/`](products/README.md) — The maintained description of the collections.
  - [`products/README.md`](products/README.md) — How the collections are wired into the app; the entry to the product documents.
  - [`products/urban-low-height/`](products/urban-low-height/README.md) — Urban Low Height specification and code integration.
  - [`products/urban-standard-height.md`](products/urban-standard-height.md) — Working context for changing Urban Standard Height.
  - [`products/class/`](products/class/README.md) — Class specification and code integration.
  - [`products/mako/`](products/mako/README.md) — Mako specification (sections 2–8 as files) and code integration.
  - [`products/urban-duplex/`](products/urban-duplex/README.md) — Urban Duplex specification and code integration.
  - [`products/urban-freestanding/`](products/urban-freestanding/README.md), [`products/tricot/`](products/tricot/README.md), [`products/lame/`](products/lame/README.md) — specifications (no integration page yet).
- [`parent-configurator-integration.md`](parent-configurator-integration.md) — How a parent site embeds the configurator iframe and shares or restores a configuration by URL.
- [`side-panel-logic.md`](side-panel-logic.md) — How side panels are offered, limited, removed and added to the quote.
- [`cabinet-drag-and-drop-ui.md`](cabinet-drag-and-drop-ui.md) — How the cabinet Drag & Drop control on the canvas behaves.
- [`countertop-position-ui.md`](countertop-position-ui.md) — How the countertop Position control behaves.
- [`drawer-organizers-ui.md`](drawer-organizers-ui.md) — How Ph2 drawer organizers (Class, Mako, Lame) are offered, edited, priced and restored.

## Records

- [`records/plans/`](records/plans/) — Closed PRDs kept as decision records; the live rule they produced lives in `ai/rules/*`. First entry: [Lucide icon unification](records/plans/2026-10-12-svg-icon-unification.prd.md) (closed 2026-10-12).

- [Зведення проблем пресетів усіх п’яти колекцій, 31.10.2026](qa/preset-findings-2026-10-31/README.md) — компонування, суттєві та малі розміри, переходи й інші findings; для кожної спільної роботи вказано ефект за колекціями. [Окремий Multi-Level звіт](qa/preset-findings-2026-10-31/multi-level.md) — усі 11 ULH/UD моделей, client matching, rules і статуси.

- [Mako: усі42 пресети, 30–31.10.2026](qa/mako-preset-audit-2026-10-30-01a18e96/gallery.html) — 84 свіжі клієнтські та168 локальних кадрів Prebuilt/Custom v97; №29 зайвий басейн, Dimensions/shape findings; [звіт і межі](qa/mako-preset-audit-2026-10-30-01a18e96/report.uk.md), [критерії](qa/mako-preset-audit-2026-10-30-01a18e96/criteria.csv).

- [Urban Duplex: усі71 пресети, 30–31.10.2026](qa/urban-duplex-preset-audit-2026-10-30-01a18e77/gallery.html) — фактичні Prebuilt/Custom v97, W/H/D71/71, compact/history/OSS/SC findings; [звіт і межі](qa/urban-duplex-preset-audit-2026-10-30-01a18e77/REPORT.md), [матриця](qa/urban-duplex-preset-audit-2026-10-30-01a18e77/criteria.csv).

- [Urban Low Height: усі 59 пресетів, 30–31.10.2026](qa/urban-low-height-preset-audit-2026-10-30-ulh01/index.html) — 177 local і 118 client кадрів, розміри, Custom transfer, A→B→A, history/reset; [знахідки та межі](qa/urban-low-height-preset-audit-2026-10-30-ulh01/report.uk.md).

- [Urban Freestanding: усі54 пресети, 30–31.10.2026](qa/urban-freestanding-preset-audit-2026-10-30-e3d8/index.html) — Prebuilt/Custom v97; [числова дозвірка54/54, UNKNOWN0](qa/urban-freestanding-preset-audit-2026-10-30-e3d8/numeric-results.csv): D54 FAIL, W25 FAIL, H54 PASS; [звіт та інші межі покриття](qa/urban-freestanding-preset-audit-2026-10-30-e3d8/report.uk.md).

- [Tricot: новий workflow QA усіх 42 пресетів, 30.10.2026](qa/tricot-workflow-2026-10-30-fresh-a7c2/index.html) — 168 нових кадрів Prebuilt/Custom у runtime v97, scene getters, A→B→A та history; [звіт і відкриті Dimensions-зауваження](qa/tricot-workflow-2026-10-30-fresh-a7c2/report.uk.md).

- [Tricot: pattern targeting, config 15758](qa/tricot-pattern-15758-2026-10-30/report.md) — shared pattern choice, individual override and Apply to all cabinets; browser evidence and validation limits.

- [Drawer animation: Tricot, Lame, Class, Mako — local source checks, 2026-10-30](qa/drawer-animation-2026-10-30.md) — embedded 2 Drawer and 1 Drawer checks PASSED; Class/Tricot + Inner main-drawer checks PASSED; inner controls and earlier failures documented.

- [Tricot: Custom3D и размеры всех42 пресетов30.10.2026](qa/tricot-custom-dimensions-2026-10-30-140425Z/index.html) —84 новых кадра,93 модуля, порядок и чаши; [таблица размеров](qa/tricot-custom-dimensions-2026-10-30-140425Z/comparison.csv), [отчет](qa/tricot-custom-dimensions-2026-10-30-140425Z/test-record.ru.md).
- [Tricot: актуальные42 пресета30.10.2026](qa/tricot-current-2026-10-30-135150Z/index.html) — runtime v93, новые3D-кадры, сохраненный Hastings и замечания Dimensions; [отчет](qa/tricot-current-2026-10-30-135150Z/test-record.ru.md).

- [Lamè: Side Panels UI, SKU, pricing та history](qa/lame-ui-side-panels-2026-10-29/index.html) — нові знімки prebuilt/custom; [звіт](qa/lame-ui-side-panels-2026-10-29/test-record.uk.md).

- [`ecosystem-map.md`](ecosystem-map.md) — Карта чотирьох робочих папок Hastings: відповідальність, інтеграції, передача даних, runtime/export boundaries та підтверджені розбіжності версій. Знімок локального стану на 2026-10-22.

### Collection-data migration

- [`collection-data-migration-status-v1.md`](collection-data-migration-status-v1.md) — First handoff of moving consumers to the active collection.
- [`collection-data-migration-status-v2.md`](collection-data-migration-status-v2.md) — Second handoff of that migration; continues v1.
- [`collection-data-migration-status-v3.md`](collection-data-migration-status-v3.md) — Third handoff of that migration; continues v2.
- [`collection-data-migration-status-v4.md`](collection-data-migration-status-v4.md) — Fourth handoff of that migration; continues v3.

### Partial launch of Urban Low Height and Class

- [`urban-low-height-class-readiness.md`](urban-low-height-class-readiness.md) — Handoff for the partial launch of Urban Low Height and Class.
- [`urban-low-height-class-browser-smoke.md`](urban-low-height-class-browser-smoke.md) — Evidence of the browser smoke run on that launch.
- [`class-collection-runtime-facts.md`](class-collection-runtime-facts.md) — Confirmed Class scene facts, used as input to the Class runtime bindings.
- [`new-collections-manifest-readiness.csv`](new-collections-manifest-readiness.csv) — Checklist of the manifest data missing for Urban Low Height and Class.
- [`new-collections-manifest-readiness.pdf`](new-collections-manifest-readiness.pdf) — The same checklist as a PDF.

### Product profile and runtime bindings

- [`product-profile-migration.md`](product-profile-migration.md) — Handoff of the product-profile boundary.
- [`runtime-bindings-migration.md`](runtime-bindings-migration.md) — Handoff of the runtime-bindings boundary.
- [`b06-profile-options-handoff.md`](b06-profile-options-handoff.md) — Handoff of the option lists moved into the profile.
- [`c12-state-acceptance.md`](c12-state-acceptance.md) — Acceptance of the configuration state, commands and Save/restore.
- [`dev-residue-report.md`](dev-residue-report.md) — Report of the product knowledge and scene calls outside the collection path.
- [`class-profile.md`](class-profile.md) — Provenance of the Class profile.
- [`mako-profile.md`](mako-profile.md) — Provenance of the Mako collection and its profile.
- [`urban-low-height-profile.md`](urban-low-height-profile.md) — Provenance of the Urban Low Height profile.

### Urban Freestanding short cabinet

- [`urban-freestanding-short-cabinet.md`](urban-freestanding-short-cabinet.md) — How the 1DW Floor-Mount Short Cabinet was added (data path, decision, changes, checks) and the questions left to the client.

### Side-panel refactor

- [`side-panel-reasons-refactor.md`](side-panel-reasons-refactor.md) — Design and status of the side-panel reason-registry refactor.

### Test-mode countertop editor

- [`countertop-placement-ui.md`](countertop-placement-ui.md) — The metre-based Position & Size countertop editor, reachable only in test mode.
