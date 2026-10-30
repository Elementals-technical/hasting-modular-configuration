# Tricot staged entry and preset catalog

Type: AFK. User stories: 1–10, 37, 46–49, 54–56, 62.

## What to build

Introduce a source-traceable Tricot package and direct collection entry with the agreed five-step navigation for both flows. Preserve all 42 master model identities, labels, ordering and filters without fabricating compositions or images. Make missing product inputs visible and keep incomplete collection data from mounting an operational scene. Provide a verifiable catalog normalization and preset handoff contract through the existing loader and collection error UI.

## Acceptance criteria

- [x] The collection registry resolves `tricot` without changing the default collection.
- [x] The quoted tab-delimited master is converted by named headers; all 42 distinct models retain stable IDs, source names, labels, size buckets and style filters.
- [x] The normalized catalog retains the supplied option counts and source provenance; production does not depend on Downloads files.
- [x] Both flows describe the agreed five pages with Tricot identity preserved.
- [x] Staged presets contain no guessed BOMs or substitute images and cannot be applied as working presets.
- [x] The loader and entry UI report missing handoff dependencies before mounting a configurable scene, without invented remote IDs.
- [x] Handoff validation detects missing, duplicate and unknown source model mappings and invalid cabinet dimensions/styles.
- [x] Relevant tests, TypeScript and lint are run; existing unrelated failures are recorded separately.

## Blocked by

None - can start immediately.

## Completion boundary

This slice prepares the model catalog and safe entry, not the approved images, compositions or live scene required by issue 7.

## Execution record — 2026-10-06

Status: Complete within the staged completion boundary.

Implemented the registry entry, source archive/importer, normalized catalog, 42 pending preset identities, five-step flows, readiness gate and handoff validator. Tests reproduce the package from the archived TSV, reject premature activation and source-ID disagreement, and prove injected remote data cannot bypass staging. No approved preset compositions or images are claimed.

## Handoff integration — 2026-10-07

Imported all 42 explicit CSV recipes (88 modules) and basin positions, preserving master identities/filters. Archived the CSV, downloaded 41 exact source thumbnails and recorded hash provenance. The source image for `Tricot 79 2DW 1_70` returns 404; only its image is pending, not its recipe. Added CSV conflict/dimension/pattern/drawer-family checks and tests reproducing every delivered recipe and verifying every PNG. Staging remains enforced because actual Canvas products/bindings are not delivered.
