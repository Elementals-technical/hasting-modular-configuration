# Documentation map

The documents under `docs/`, in the order they are meant to be read, each with what it is for.

**Maintained** documents describe the current product and are kept true. **Records** are
provenance: they say what was true when they were written and are not kept in sync with the
product.

## Maintained

- [`products/`](products/README.md) — The maintained description of the collections.
  - [`products/README.md`](products/README.md) — How the collections are wired into the app; the entry to the product documents.
  - [`products/urban-low-height.md`](products/urban-low-height.md) — Working context for changing Urban Low Height.
  - [`products/urban-standard-height.md`](products/urban-standard-height.md) — Working context for changing Urban Standard Height.
  - [`products/class.md`](products/class.md) — Working context for changing Class.
  - [`products/mako.md`](products/mako.md) — Working context for changing Mako.
- [`parent-configurator-integration.md`](parent-configurator-integration.md) — How a parent site embeds the configurator iframe and shares or restores a configuration by URL.
- [`side-panel-logic.md`](side-panel-logic.md) — How side panels are offered, limited, removed and added to the quote.
- [`cabinet-drag-and-drop-ui.md`](cabinet-drag-and-drop-ui.md) — How the cabinet Drag & Drop control on the canvas behaves.
- [`countertop-position-ui.md`](countertop-position-ui.md) — How the countertop Position control behaves.

## Records

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

### Side-panel refactor

- [`side-panel-reasons-refactor.md`](side-panel-reasons-refactor.md) — Design and status of the side-panel reason-registry refactor.

### Test-mode countertop editor

- [`countertop-placement-ui.md`](countertop-placement-ui.md) — The metre-based Position & Size countertop editor, reachable only in test mode.
