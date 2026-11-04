# HO-010: Urban Duplex OSS keeps 56 cm geometry when Height is 38 cm

Date: 2026-11-03. Status: SOURCE FIX INCLUDED IN INSTALLED v100 — archive integrity, focused tests and embedded visual check PASS; full acceptance below remains open. The baseline diagnosis describes the pre-fix v99 rule.

## Export v100 delivery (2026-11-03)

`public/HastingCabinetsParametrization/` matches all 737 non-metadata files of the user-provided `Hasting-phase-2-stage-v100.zip`, with no missing, different or extra files. ZIP SHA-256: `fca795d7dfd48341c41b37b6c189245ee10d6426dd34a735c0223fac76cbc09b`; config SHA-256: `e6c01e017b01693808299bac6f5a5c56ef52621d41cc18dea230483ebed0c118`; esm SHA-256: `b0ebaa3bada664231f4229e8abf2cf8ef7ebf5c649516340aa1a342d471eb962`. The new bundle includes the 38 cm stretch/move mappings. Five export files differ from v99; no generated file was hand-edited.

Fresh local UI load at `http://localhost:5174/prebuilt/model?collectionId=urban-duplex&preset=16` shows iframe title `Hasting-phase-2-stage-v100`; the in-app browser visual check confirms no OSS protrusion below the neighbour. No local source substitution was used. Numeric WebGL height, full restore/SKU/price acceptance and deployment remain unverified. Local screenshot: `.work/ud-preset-analysis-2026-11-03/fix/v100-oss38.jpg`.

`sceneKeysInExport`, compact depth, compact columns and UD runtime-binding suites pass 45/45; `npm run build` passes. The separate table discrepancies (low-height shelf visibility, 28 cm point move, nominal/physical depth in HO-011) are not closed by this delivery.

## Local source fix (2026-11-03)

Canonical `Scripts/app-configuration/domain/product/rules/CabinetUrbanDuplex/OpenShelvesSide/RuleHeightUDOpenShelvesSide.mjs` now includes 38 in both height breakpoints, wall stretch `y: -0.18` and point move `y: -0.09`; margin remains 0.1. The focused test now asserts all four heights (56/53/38/28), including the previously missed transition 53 → 38. The new assertion failed before the source change and passes afterwards.

Four shelf suites pass 8/8 in the canonical checkout; `node --check` and scoped `git diff --check` pass. The broader five-suite run is 15/16: `urban-duplex-size.test.mjs` also fails against unchanged HEAD because its defaultConfig expectation omits existing `aabbIgnoreNodes`. That test was not weakened.

Visual check: local `http://127.0.0.1:5176/prebuilt/model?collectionId=urban-duplex&preset=16` uses the existing pc-local bridge, canonical source, and v81 non-minified export templates/assets. In the in-app browser the OSS no longer protrudes below the adjacent cabinet. This is not verification of a newly delivered v99 export or a numeric WebGL height measurement. Chrome DevTools connection timed out twice; the fallback visual screenshot is local `.work/ud-preset-analysis-2026-11-03/fix/oss38-local.jpg`.

At the source-fix checkpoint the UI export was still v99; the later v100 delivery is recorded above. Depth transforms (HO-011), backend data, commits and deployment were not part of the OSS source fix.

| Field                  | Value                                                                                                                                           |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Risk / severity        | S3 visual/geometry; deterministic on the observed fresh load                                                                                    |
| Owning boundary        | PlayCanvas scene/export — verified                                                                                                              |
| Environment / build    | Local Vite localhost:5174, frontend HEAD b0401683 with unrelated local changes; Chrome 156, 1920×936                                            |
| Entry                  | `/prebuilt/model?collectionId=urban-duplex&preset=16`, `Urban Duplex · 42" 1-Drawer Slim OSS`                                                   |
| Scene / asset identity | `Hasting-phase-2-stage-v99`; iframe `index.html?v=041`; `js/esm.mjs` SHA-256 `2b47c0839047ecce6dffade1ed7bdae34b0928b29a2b31081782c2daf97bfa91` |
| Product / key          | `UD-open-shelves-side`, `Height: 38`; `UniOpenSideShelves`                                                                                      |
| Test account role      | Anonymous; agent-owned isolated browser context                                                                                                 |
| Frequency              | 1 of 1 measured fresh loads                                                                                                                     |
| Rule                   | R-UD-CAB-002; cabinet matrix 594 permits OSS heights 56/53/38/28                                                                                |

## Starting state and reproduction

1. Open the entry URL with a fresh document and collection package. Do not carry an earlier cabinet configuration.
2. Read `ConfiguratorAPI.cabinets.getState(scope)` from the scene iframe.
3. Find the `UD-open-shelves-side` product beside the 38 cm Sink Base.
4. Measure its enabled `OpenSideShelvesBackWall` and `OpenSideShelvesSideWall` meshes, including `smartStretch.stretchAmount` and world AABB.

## Expected

Both the OSS and neighbouring Sink Base are 38 cm high. The OSS geometry and vertical position must follow its requested height; nominal height must remain 38 in state, SKU and saved layout. Product specification: [Urban Duplex products](../../../products/urban-duplex/products.md), OS/OSS rows; [rules](../../../products/urban-duplex/rules.md), rule 8. Source snapshot: cabinet matrix 594 and R-UD-CAB-002, client sources exported 2026-10-28.

## Actual and frontend evidence

- Preset 16 requests `Side-Shelf { Width: 15, Height: 38, Depth: 46 }` and `Sink-Base { Width: 90, Height: 38, Depth: 46 }` in `public/collections/urban-duplex/presets.json`.
- Runtime confirms both `selection.Height` values are 38; the frontend has not substituted another height.
- OSS back wall height: 56.00004 cm; side wall: 56.00006 cm. Both have `stretchAmount.y = 0`.
- Sink Base body height: 38.00001 cm, `stretchAmount.y = -0.18`.
- Read-only probe: local `.work/ud-preset-analysis-2026-11-03/preset-16.json`. The screenshot was inspected inline; it is not a persisted artifact. The probe is local evidence and is not included in Git.
- The agent tab blocked non-GET/HEAD/OPTIONS fetch/XHR requests; `blockedWrites` was empty. Summary, Save and Share were not opened. Price/SKU and restore were not checked for this handoff.

## Root cause

The shipped `RuleHeightUDOpenShelvesSide` and `UD_OPEN_SHELVES_SIDE_HEIGHT_STRETCH_Y` / `MOVE_Y` use breakpoints `[56, 53, 28]`. Height 38 returns before applying transforms. The current fresh template consequently retains its base 56 cm geometry. The frontend's older note that both 28 and 38 are unsupported is stale: the shipped rule supports 28.

## Why the frontend cannot fix it safely

Changing the requested height to 28 or 56 would alter the model, SKU and layout rather than implement the supported 38 cm product. Scaling the iframe mesh from React would bypass the scene rule and command ownership. Scene/source/export edits are read-only under this checkout's `AGENTS.md`.

## Requested owner change

Implement the 38 cm OSS branch in canonical PlayCanvas height rules, with matching stretch and point movement, and preserve the neighbour/handle alignment behaviour. Derive the transform values from the actual template and its established units; do not use a frontend workaround. Deliver through the normal scene export process rather than hand-editing the generated export.

## Acceptance criteria

- [ ] Preset 16 runtime and visible OSS geometry are both 38 cm, with no protrusion below the neighbouring 38 cm cabinet.
- [ ] Height 28, 53 and 56 still apply their intended geometry and point positions.
- [ ] L/R OSS placement and adjacent handle extension remain correct.
- [ ] Model → Customize and layout export/restore preserve Height 38.
- [ ] The delivered export identity is recorded and the embedded UI scenario is rerun.

## Proposed regression checks

Scene unit/geometry tests for heights 28/38/53/56, both end orientations; browser preset 16 and low OSS controls 44/60, plus a standard-height OSS model. SKU/price verification uses the independent oracle; missing prices remain BLOCKED.
