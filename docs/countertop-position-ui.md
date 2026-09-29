# Countertop Position UI (Drag & Drop)

Selected countertop menu: Color, Thickness, Countertop Style, Basin Style, **Position ▸ Standard | Drag & Drop**.
The metre-based "Position & Size" modal (`CountertopPlacementControls`) is test mode only: it and its
menu item render only with `?countertopSettings`.

## Modes

- **Standard** — `countertop.setDragEnabled(false)`, `countertop.resetOffset()`, `whenSettled()`, then the
  committed-countertop sync. Leaves Drag & Drop mode if it is open. The custom length is kept.
- **Drag & Drop** (`src/features/countertopPlacement/ui/CountertopDragMode.tsx`) — captures the before-state
  (`captureCountertopSnapshot`), `setDragEnabled(true)`, `countertop.setLengthLimits({ minM, maxM })`,
  subscribes to `countertopOverlay`, `setActive(true)`, `setPlaceholdersEnabled(false)`.
  - **Apply** — `setDragEnabled(false)`, `whenSettled()`, sync (`syncCommittedCountertop`), overlay off.
  - **Cancel / ×** — `restoreCountertopSnapshot` (shared with the modal): offset (or attached position),
    custom length, drag flag; each step verified. Overlay off.
- Cabinet Drag & Drop and countertop Drag & Drop block each other (`externalBusy` / `disabled`).

## Overlay (`CountertopDragOverlay.tsx`)

Anchors come from the frame in iframe px (the layer covers the iframe 1:1): move icon at `center`,
length chip at `lengthLabel` (fallback `topCenter`), read-only depth chip at `depthLabel` (fallback
`rightEnd`), handles at `leftEnd` / `rightEnd`, Apply + × under `bottomRight` (clamped into the viewport).
`status: "colliding"` / `canApply: false` disables Apply and shows `reasons[0].message`.

- Length chip opens a popover: number input in inches (step 0.5, min/max of the effective limits), Apply
  clamps and calls `setSize({ length })` in metres.
- Handles resize symmetrically: `newLength = startLength ± 2·(pointer delta · axiŝ)/pxPerMetre`
  (`+` right handle, `−` left), where `lengthAxisPx` is the screen vector of one metre along the length
  axis (fallback: `(rightEnd − leftEnd) / lengthM`). rAF-throttled, clamped to the limits.
- Displayed inches are rounded to 0.1 without a trailing `.0` (1 in = 0.0254 m): 0.6 m → `23.6″`,
  1.2192 m → `48″`, 1.651 m → `65″`. Chip, presets, `Set …″` pill, popover Min/Max and the handle
  tooltip all use `metresToDisplayInches` + `formatInches` from `lib/countertopLength.ts`.
- Presets (`▾`): `countertop.lengthPresetsIn` or the default `23.6, 48, 60, 72, 84, 96, 120` in (23.6 =
  one 60 cm cabinet). Only presets inside the effective limits are listed, with a 0.05 in tolerance so
  23.6 stays when the minimum is 23.622 in; a picked preset is clamped, so 23.6 sends exactly 0.6 m.

## Limits

`ui.json` → `countertop.lengthLimitsIn: { min, max }` (inches, optional). Default: one 60 cm cabinet
(`60 / 2.54` ≈ 23.622 in, sent to PlayCanvas as exactly 0.6 m) to 120 in. The frame's `limits`
(runtime-effective) win over the collection's when present.

## Older PlayCanvas builds

Everything is feature-detected in the bridge (`subscribeCountertopOverlay`, `setCountertopOverlayActive`,
`setCountertopOverlayPlaceholders`, `setCountertopLengthLimits` resolve `null` / `false`). Without
`countertopOverlay` the mode shows Apply / Cancel pills in the top-right (like the cabinet toolbar) and no
chips or handles.
