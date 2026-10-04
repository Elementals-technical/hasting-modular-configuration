## What to build

Register Class as an independently loadable partial collection through the same public path as Urban Low Height. Its package must use empty defaults, the approved shared remote sources, and a Class-specific UI contract, and must record the confirmed `Class-side-cabinet` runtime API facts without inventing a runtime binding table.

## Acceptance criteria

- [x] The production registry contains `class` while Urban Standard Height remains the default.
- [x] Class has its own folder, valid manifest, and valid customization schema.
- [x] The manifest declares Configurator `4`, Countertop DataTable `438`, and Cabinet DataTable `439` and does not declare presets, ProductProfile, SKU mappings, or runtime bindings.
- [x] The loader reaches `ready` with frozen remote fixtures and calls the three approved remote sources exactly once.
- [x] The loaded result contains Class identity and customization without copied USH local data.
- [x] `/prebuilt?collectionId=class` resolves to the collection-defined entry route, retains the query parameter, and renders a collection-specific identity or empty state.
- [x] The handoff records `Class-side-cabinet`, its supported dimensions, `InnerDrawer`, color fields, and cabinet-ID lifecycle as supplied facts for later runtime work.
- [x] Relevant tests, TypeScript validation, and changed-file lint pass.

## Blocked by

- Blocked by #plans/developer-a-urban-low-height-class-manifests/01-safe-partial-runtime.issue.md
