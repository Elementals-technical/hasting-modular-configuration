## What to build

Prove that the application can move between Urban Standard Height, Urban Low Height, and Class without losing URL identity or retaining local collection data from the previous package. Verify the shared remote-source calls and the partial UI state through the public provider, bridge, routing, and rendered-page seams.

## Acceptance criteria

- [x] Provider/bridge coverage switches from USH to Urban Low Height to Class and observes the correct active ID at every ready state.
- [x] Collection-derived defaults, presets, ProductProfile, runtime bindings, SKU mappings, and state do not leak from USH into either partial collection.
- [x] Both partial collections use only Configurator `4`, Countertop DataTable `438`, and Cabinet DataTable `439` as declared.
- [x] Navigation and entry redirects preserve each explicit collection ID.
- [x] Returning to a URL without `collectionId` resolves Urban Standard Height as before.
- [x] Browser smoke evidence covers both new collection URLs and records any limitation caused by the current remote environment.
- [x] Relevant tests, TypeScript validation, changed-file lint, and production build pass.

## Blocked by

- Blocked by #plans/developer-a-urban-low-height-class-manifests/02-launch-urban-low-height.issue.md
- Blocked by #plans/developer-a-urban-low-height-class-manifests/03-launch-class.issue.md
