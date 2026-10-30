# UI regression gate (UI, 3D, configurator, SKU/price)

Mandatory acceptance for UI/3D/configurator tasks. Browser mechanics: `docs/ai/qa/browser-validation.md`. Test design and recording: `docs/ai/qa/ui-test-matrix.csv` (one row per TC; status `NOT_RUN | PASS | FAIL | BLOCKED | UNKNOWN`).

1. **Intake** — ticket id; fresh backlog row and comment thread (`docs/ai/hastings/comments-ledger.csv`, live source if the ledger is stale); rule rows with source revision; expected vs actual; environment. Missing conditions are written as `unknown`.
2. **Reproduce before fix** — deterministic steps from a fresh load: family (`?collectionId=`), flow (prebuilt/custom), selections; capture screenshot, scene state (read-only), console, network. Confirm the bug is not closed/superseded.
3. **Blast radius** — from `docs/ai/hastings/dependency-graph.md`: affected invariants, near neighbours, changed-state transitions, negative cases, unaffected baselines → TC ids.
4. **Fix** in the owning frontend boundary only; foreign owner → handoff.
5. **Focused automated test** — the narrow commands in `verify-frontend.md`.
6. **Browser run** — Chrome first, same profile; primary scenario, then derived critical paths. Compare before/after; same camera, viewport and loaded assets for 3D; check mesh, position, materials, z-fighting, clipping, texture/scene loads, console and network — not only the DOM. Pixel diff is never the only oracle.
7. **Stateful and negative regression** — repeat material/family/size/style/basin switches; drag, resize, offset/remote; undo/redo; multi-level; remove/add; reset; prebuilt↔custom; reload/restore; forbidden options and their exact messages.
8. **Independent oracle** — SKU/price against `docs/ai/hastings/sku-price-oracle-map.md`: UI selection → request (no tokens) → scene state → SKU → price. No oracle → `BLOCKED`.
9. **Report** — browser + URL class + scenario + TC id + actual + evidence; not-run items with reason; source revisions; deviations with owner; commands.

Cross-browser risk (layout, pointer/drag, WebGL) → repeat the critical TCs in Firefox.
