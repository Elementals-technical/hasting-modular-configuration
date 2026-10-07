# Integrate approved product and scene handoff

Type: HITL. User stories: 4, 6, 9–10, 24, 26–28, 31–36, 51–52, 54–56, 59, 62.

## What to build

Consume the approved 3D/product/API handoff and replace staged dependencies with validated live resources. Complete all 42 presets, product policies, final source IDs and real runtime bindings without authoring the scene or publishing DataTables on the owners' behalf.

## Acceptance criteria

- [x] The product team supplies all 42 ordered nonempty compositions, dimensions, drawer styles and basin positions (received CSV, 88 modules).
- [ ] All 42 models have usable matching images (41 downloaded; `Tricot 79 2DW 1_70` source returns 404).
- [ ] The scene team supplies the complete runtime contract (cabinet product types, cm dimensions, drawer modes and matte lacquer mappings are integrated; remaining visual contracts/readback are tracked in the open-questions file).
- [x] The user approves Accessories placement, per-active-side panel quantities/inheritance/width offsets, drawer-family mixing, attribute scopes and CSV defaults. No default preset is selected; actual geometry is verified under issue 8.
- [ ] The API owner supplies complete source identities and metadata (592/593 and reviewed column mappings are integrated; conditional catalog identity and swatches remain in the open-questions file).
- [ ] Shared countertop/basin compatibility and SKU/thickness mappings are verified against approved evidence.
- [x] Handoff validation rejects missing, duplicate or inconsistent models and unsupported module/filter combinations; all delivered compositions pass.
- [ ] Profile/UI/runtime/core-attribute contracts and manifest source references agree.
- [ ] Both flows can place and customize actual Tricot products using real runtime bindings.
- [ ] Staging blockers are removed only for validated, delivered inputs; any unresolved input remains visible.

## Blocked by

- Blocked by #plans/tricot-integration/01-staged-entry-and-preset-catalog.issue.md
- Blocked by #plans/tricot-integration/02-custom-cabinets-and-pricing.issue.md
- Blocked by #plans/tricot-integration/03-finishes-patterns-and-groove-colors.issue.md
- Blocked by #plans/tricot-integration/04-countertop-and-basin-selection.issue.md
- Blocked by #plans/tricot-integration/05-side-panels-and-pricing.issue.md
- Blocked by #plans/tricot-integration/06-summary-and-persistence.issue.md
- External handoff from the user's 3D/product team and API owner.

## Execution record — 2026-10-06

Status: Waiting for external product/3D/API inputs; not implemented or accepted.

See [handoff checklist](handoff.md) for the exact deliverables. Safe frontend preparation is available from issues 1–6. The production manifest stays staged, all 42 recipes remain pending, and no runtime product/attribute mappings or remote IDs have been fabricated. Integration can resume when the actual handoff is supplied.

## Partial handoff received — 2026-10-07

Integrated explicit recipes, 41 images, defaults, table IDs/responses 592/593, drawer-family restrictions and Accessories/panel inheritance/width policy. The user confirms Canvas module IDs will only arrive after the 3D models are made. Keep staging for that actual runtime contract, one broken image, verified shared pricing and the panel price-SKU question. The Monosnap HTML pages were reachable, but their actual screenshots were not retrieved; do not claim screenshot review. See the revised [handoff checklist](handoff.md); delivered CSV/tables must not be requested again.

## Follow-up handoff — 2026-10-07

Both Monosnap screenshots are now supplied and reviewed; the CAB material/color panel suffix is approved and implemented. No screenshot or suffix question remains. The user will deliver the one missing PNG later and confirms the planned Canvas ID/binding handoff. Staging remains for those actual resources and verified shared GB pricing, not for already-delivered product policy. Actual panel activation remains guarded until its scene keys and side readback are known.

## Partial runtime contract integrated — 2026-10-07

Status: partially implemented; full activation and acceptance remain pending.

- Real SB/SC definitions, cm dimensions, three drawer modes and both matte lacquer palettes are integrated through production runtime bindings.
- Missing wood assets have per-value reasons. Pattern, panels and countertop/basin contracts remain unbound; none is mislabeled state-only.
- Composition/restore preflight blocks incomplete product configs before scene mutation. Command adapter preflight remains atomic. Preset defaults and all recipes are unchanged.
- Remaining external questions are separated in [open-questions.uk.md](open-questions.uk.md). No static instance-ID list is requested: addProduct returns IDs.
- Automated adapter evidence is distinct from issue 8 real-scene/browser acceptance. The manifest remains staged.

Verification: 238 Tricot tests / 287 broader focused tests passed; full regression has 2184 passing tests and no unexpected failure. TypeScript, build, changed-source lint, PNG integrity and diff checks passed. Full lint retains the pre-existing staging baseline of 93 errors and three warnings. Detailed results are recorded in the tracker. No real-scene/browser acceptance or external publication is claimed.
