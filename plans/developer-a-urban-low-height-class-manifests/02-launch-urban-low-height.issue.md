## What to build

Register Urban Low Height as an independently loadable partial collection. Its manifest must use the confirmed application ID, empty defaults, the approved shared remote sources, and a collection-specific UI contract. Opening its collection URL must reach a deliberate Urban Low Height view or empty preset state while preserving the collection ID.

## Acceptance criteria

- [x] The production registry contains `urban-low-height` while Urban Standard Height remains the default.
- [x] Urban Low Height has its own folder, valid manifest, and valid customization schema.
- [x] The manifest declares Configurator `4`, Countertop DataTable `438`, and Cabinet DataTable `439` and does not declare presets, ProductProfile, SKU mappings, or runtime bindings.
- [x] The loader reaches `ready` with frozen remote fixtures and calls the three approved remote sources exactly once.
- [x] The loaded result contains Urban Low Height identity and customization without copied USH local data.
- [x] `/prebuilt?collectionId=urban-low-height` resolves to the collection-defined entry route, retains the query parameter, and renders a collection-specific identity or empty state.
- [x] Relevant tests, TypeScript validation, and changed-file lint pass.

## Blocked by

- Blocked by #plans/developer-a-urban-low-height-class-manifests/01-safe-partial-runtime.issue.md

