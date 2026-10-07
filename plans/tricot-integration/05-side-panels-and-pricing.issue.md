# Side panels and dedicated pricing

Type: AFK. User stories: 25–28, 40–41, 53–54, 57.

## What to build

Integrate the Tricot Yes/No panel choice with a reusable own-panel SKU/pricing contract. Require declared topology, material inheritance, dimensions and quantities before treating selected panels as a complete ordered component. Exercise the full selection-to-pricing path with an explicit test contract without inventing production panel behavior.

## Acceptance criteria

- [x] The Accessories page declares Yes/No without reusing Urban groove-specific panel values.
- [x] Shared SKU schemas and pricing builders support an own-panel contract while preserving existing `pricedAs` behavior.
- [x] The source panel base is `VAN-TRIC-SP-.8W-15.7H-20.5D`; the user confirmed final suffix `-CAB-{material}-{color}`.
- [x] Quantity, placement and inheritance come from declared product input, never a hardcoded assumption of two panels.
- [x] Missing panel rules produce an explicit pricing/runtime gap rather than a zero-cost or silently omitted part.
- [x] Tests cover activation/removal, provided quantities, material/color spelling, missing inputs and the audited WDV/LACM prices.
- [ ] Geometry effects and visual operations use supplied policy contracts; real Tricot verification remains dependent on issue 7.

## Blocked by

- Blocked by #plans/tricot-integration/03-finishes-patterns-and-groove-colors.issue.md

## Execution record — 2026-10-06

Status: Reusable panel SKU/pricing path prepared; real topology/visual policy remains open.

Implemented Yes/None vocabulary and an own-panel contract with explicit quantity, color inheritance and suffix requirements. Tests exercise declared quantities 1/2/3, invalid/missing quantities, removal and workbook material prices (WDV 984; LACM 941). Those confirmed test contracts are not production approval. The production contract remains unconfirmed, and selecting panels yields a blocking gap without a guessed SKU or default quantity. Geometry and scene operations require issue 7.

## Handoff integration — 2026-10-07

The user confirmed Accessories placement, cabinet material/color inheritance and +1 cm countertop width per active side (+2 cm both sides), matching the existing shared width calculation. Renamed the step label in both flows and recorded the received policy. Yes/No must still be mapped to actual Canvas panel operations rather than Urban groove values. Read-only price probes return null for the supplied bare base, 984 for the WDV-933-suffixed SKU and 941 for the LACM-433-suffixed SKU. Requested confirmation before overriding the user's literal final SKU. Production panel pricing and activation remain guarded pending that clarification and runtime bindings.

## Follow-up approval and implementation — 2026-10-07

The user confirmed the CAB material/color suffix and supplied both screenshots. Production SKU data now confirms cabinet color/material inheritance, active-side quantity and +1 cm per active side. Shared width and quantity use one active-side counter, with own-countertop width changes opt-in to preserve Class/Mako behavior. A scene-committed top length is not extended twice. Pending or contradictory side activation produces a blocking pricing gap; actual Canvas activation/removal remains guarded, not guessed from Yes/No. The Urban screenshot establishes section placement only, so no extra groove variants, Dividers or Towel Bar were added. Tests cover left/right/both/auto-removed sides, inherited source colors, committed global color, missing legacy readback, removal disagreement, widths and committed-length precedence. No real-scene acceptance is claimed.
