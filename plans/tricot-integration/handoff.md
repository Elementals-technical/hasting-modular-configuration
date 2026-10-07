# Tricot activation handoff

The collection is deliberately staged. This record belongs to issue 7 and documents received inputs and acceptance steps. The sole maintained external request list is [open-questions.uk.md](open-questions.uk.md). Supply approved exports/files or repository paths, not credentials; the frontend integration team does not author the scene or publish product tables on the owners' behalf.

## 3D/product owner

- Received: all 42 ordered recipes / 88 modules, semantic SB/SC types, dimensions, drawer values and basin associations from the supplied Google CSV. Stable model IDs, numbered alternatives and filters are preserved. Do not request that file again.
- Received: 41 exact public 2D model thumbnails, archived with SHA-256 checksums in `sources/model-images.json`. The user will supply a PNG for **Tricot 79 2DW 1_70** later (the source thumbnail returns HTTP 404). Its nonempty recipe is retained with `pending-image` status; no repeat image request is needed now.
- During actual placement acceptance, review asymmetry/physical offsets against the scene; CSV position is module order, not a fabricated geometric offset.
- Received and integrated: `Tricot-sink-cabinet` for SB, `Tricot-side-cabinet` for SC, cm Width/Height/Depth, `1D`/`2D`/`1DWID` drawers and exact CabinetColor/HandleGrooveColor material fields. Production `runtime-bindings.json` is referenced by the manifest. Remaining visual contracts are unbound, not state-only. The `test-tricot-*` bindings remain hypothetical product-rule test fixtures only.
- Received: one-drawer / inner-drawer modules may coexist, but cannot mix with two-drawer modules. Preset defaults are Rovere Oro 932, Cannette, Nero 433 MT, no panels, Matte White and LB440. No default model or additional accessory is inferred. Pattern remains scoped per module under semantic `DrawerPanelFluting`, labelled Cabinet Pattern; actual scene translation is pending.
- Received: panels live in Accessories, inherit cabinet material/color, and add 1 cm per active side to the countertop. Canvas activation/removal keys, side readback and exact visual behavior remain pending. Both Monosnap screenshots have now been supplied and inspected in the conversation. The first establishes the Urban Accessories layout reference; its groove variants, Dividers and Towel Bar are not Tricot catalog approval. The second confirms the archived CSV defaults. No screenshot request remains.
- Confirmed by the user: append `-CAB-{material}-{color}` to `VAN-TRIC-SP-.8W-15.7H-20.5D`. Production panel pricing now uses that suffix and the cabinet's color/material, with quantity equal to the actual active left/right sides. Unknown readback, Yes without an active side or No with a stale active side produces a blocking gap. Read-only API probes on 2026-10-07 returned `price: null` for the bare base, 984 for `-CAB-WDV-933`, and 941 for `-CAB-LACM-433`.

## API owner

- Received: cabinet DataTable 592 (`matrix-cabinet-tricot`) and countertop DataTable 593 (`matrix-countertop-tricot`); real API response fixtures are archived and source identities agree. `Sink-Cabinet` normalizes to semantic Side-Cabinet; the all-drawers forced height column and integrated/inner-drawer exclusion are mapped explicitly.
- Packaged source catalogs contain 23 cabinet colors, five patterns, 20 groove colors, 71 countertop colors and ten basins. This source inventory does not constitute delivery of API swatch metadata or a remote configurator identity.
- Received: compatibility from table 593. Loaded rules filter countertop choices and gate commands using actual module dimensions; material/thickness changes clear incompatible composition-wide and per-Sink-Base basins. Thickness values are 0.5, 0.75, 3.125, 4 and 4.75 inches. Table notes still mention thick-top and glass-hole confirmations; these are not invented additional options.
- Table 593 is a compatibility table, not a complete price contract. Existing Class/workbook references remain the starting evidence; do not reuse Urban pricing as a fallback. Current metadata/pricing requests are maintained only in the open-questions file.

## Activation checks

1. Validate complete model coverage with `validatePresetHandoff`; review placement/asymmetry against the real product export. The validator does not infer geometry or verify image content.
2. Integrate and validate delivered answers from [open-questions.uk.md](open-questions.uk.md). Cabinet IDs, cm/drawer/lacquer bindings, approved recipes/defaults/policies and 592/593 are already integrated; do not request them again.
3. Validate visual readback and pricing against those approved contracts. Do not remove `availability`, missing-activation gaps or the runtime guard merely to bypass the readiness screen.
4. Run collection contract checks, TypeScript, changed-file lint, relevant/full tests and build. Record existing repository failures separately.
5. Execute issue 8 in the actual scene, including single modules, inner drawers, numbered alternatives, asymmetry, double basins, panels, summary prices and save/undo replay in both flows.

The local entry after activation uses `?collectionId=tricot`. Until the approved handoff is integrated, it shows the missing dependency screen and does not mount a working configurator.

## Partial runtime integration — 2026-10-07

The confirmed frontend portion of the developer contract is integrated without a grilling session. All 20 matte lacquer materials and both product registrations are verified against the delivered export. Three exact wood assets are absent and stay pending; no other wood is substituted. The developer's GL example does not expand the approved matte catalogs. Scene fallback defaults do not replace approved CSV defaults. The received contract is archived in `sources/runtime-handoff.json`.

Mapped values can carry explicit pending reasons; Tricot opts into product-config preflight. Add/insert/preset and restore reject invalid or pending visual inputs before scene mutation, and commands reject missing translations atomically. Existing collections retain legacy behavior. Approved semantic and already-translated scene configs restore idempotently; subsequent operations use returned instance IDs.

This is not activation: all 42 recipes retain pending visual defaults, including default wood, pattern and basin choices. Recipes are preserved rather than silently dropping their inputs. Remaining questions are separated in [open-questions.uk.md](open-questions.uk.md). No real-scene/browser acceptance has been performed.
