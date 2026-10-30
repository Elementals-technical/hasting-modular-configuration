# Real-scene acceptance and regression checks

Type: AFK. User stories: 59–62.

## What to build

Exercise both complete Tricot flows in the delivered scene and verify pricing, persistence and existing collections before declaring full acceptance. Record automated, browser and visual evidence separately from any remaining product defects or baseline failures.

## Acceptance criteria

- [ ] Browser checks include a single-module preset, distinct numbered layouts, an inner drawer, asymmetry and double basins.
- [ ] Material/pattern changes, groove colors and panel changes visibly affect the correct scene products.
- [ ] A custom composition supports the approved modules and constraints through the five-page flow.
- [ ] Summary prices include all required parts with correct quantities and no unresolved required gaps.
- [ ] Save/restore and undo/redo reproduce the intended real-scene state in both flows.
- [ ] All 42 approved presets are placeable with correct composition order and usable images.
- [ ] TypeScript, lint, relevant/full tests and production build are run and results are recorded honestly.
- [ ] Relevant existing collection and legacy-save regression checks pass, or unrelated baseline failures are separately identified.
- [ ] Acceptance evidence states whether the integration is fully ready; no deployment or external publication is performed.

## Blocked by

- Blocked by #plans/tricot-integration/07-product-and-scene-handoff.issue.md

## Execution record — 2026-10-06

Status: Blocked by issue 7; no real-scene/browser acceptance performed.

Automated source/contract preparation and repository checks are recorded in the tracker, but they do not prove placement, geometry, materials, images or visual restore against a delivered Tricot scene.
