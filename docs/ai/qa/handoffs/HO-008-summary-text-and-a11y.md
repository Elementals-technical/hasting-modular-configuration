# HO-008: Summary text inconsistencies and unnamed undo/redo buttons (minor)

| Field | Value |
|---|---|
| Risk / severity | S3 (presentation / accessibility) |
| Owning boundary | frontend (verified) |
| Environment | staging, `index-B-mLU0_Q.js`, Chrome 156 |
| TC | TC-BASE-USH-PB, TC-USH-UNDO-001 |

## Observed
1. USH Summary cabinet description: "Urban Standard Height **Height** cabinet: … 23.6" W, 20.9" H, **19.9" D**" while the spec line under it says "23.6W-20.9H-**19.7D**" (cabinet depth 50 cm = 19.7"; 19.9" is the countertop depth). ULH and Class are consistent (18.1"/20.5" in both). The "<Collection> Height cabinet" template also yields "Mako Height cabinet", "Class Height cabinet".
2. Undo/redo canvas buttons have no accessible name (icon only; `src/features/bottomCanvasButtons/BottomCanvasButtons.tsx` ≈L314–326), so screen readers and the browser accessibility tree show unnamed buttons.

Evidence: `docs/ai/qa/evidence/2026-10-28/TC-BASE-USH-PB/90-summary.txt`; Chrome snapshot in `…/smoke-chrome/03-snapshot.txt` (unnamed `button disableable disabled`).

## Requested change
Use the cabinet depth in the description (or confirm the intended value with the client), fix the description template, add `aria-label="Undo"` / `"Redo"`.

## Acceptance criteria
- [ ] USH description depth equals the cabinet SKU depth; no doubled words.
- [ ] Undo/redo have accessible names.
