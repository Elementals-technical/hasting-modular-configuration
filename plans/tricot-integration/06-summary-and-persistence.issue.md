# Summary, save/restore and undo/redo

Type: AFK. User stories: 37–45, 59, 61–62.

## What to build

Verify both five-page flows through summary and persistence using the prepared contracts and runtime test port. Keep Tricot identity, composition order, semantic selections and pricing completeness consistent across navigation, save/restore and undo/redo.

## Acceptance criteria

- [ ] Both flows follow the agreed five-page order and preserve compatible selections on back navigation.
- [ ] Summary includes cabinet finishes, patterns, groove colors, panels, countertop and basin selections.
- [ ] Partial prices and required missing components are visibly distinguished from a confirmed total.
- [x] Save/restore preserves collection identity, cabinet order, all Tricot selections and basin associations.
- [x] Restoration replays through the normal runtime translator rather than bypassing product validation.
- [x] Undo/redo produces valid states and consistent runtime operations.
- [ ] Loader → UI → commands → scoped state → runtime → persistence behavior has connected coverage in both flows.
- [x] Existing collections and legacy saved configurations pass relevant regression checks.
- [x] No test-port result is presented as real-scene acceptance.

## Blocked by

- Blocked by #plans/tricot-integration/04-countertop-and-basin-selection.issue.md
- Blocked by #plans/tricot-integration/05-side-panels-and-pricing.issue.md

## Execution record — 2026-10-06

Status: Persistence and summary vocabulary prepared; browser/complete-flow acceptance remains open.

Summary now uses the active collection label and UI-defined Cabinet Pattern label without adding collection-specific page branches, and hides undeclared Handle Style. Save/read/restore tests preserve Tricot identity, order, separate per-module patterns/groove colors and basin associations in both flows. History now captures scoped choices, restores them by stable key, rejects another collection before rebuilding, and reports failed replay as partial with saving held for sync. Bound panels replay through the normal port rather than Urban's side-panel wrapper. Invalid or unapproved selections cannot bypass validation during Tricot replay. Unchecked criteria require approved product data and browser/real-scene coverage; no live acceptance is claimed.

## Handoff integration — 2026-10-07

Undo/redo now records the rebuilt scene's actual readback dimensions before replay compatibility checks. The Tricot persistence fixture uses the delivered countertop matrix and a valid top thickness, rather than claiming missing data as supported. Coverage proves stale over-limit dimensions are replaced with scene-reported sizes and separate pattern/groove values replay correctly after a rebuild. Actual Canvas/browser acceptance remains pending.
