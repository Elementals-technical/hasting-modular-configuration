# Countertop Position UI (Drag & Drop)

Selected countertop menu: Color, **Resize ▸ Thickness | Length**, Countertop Style, Basin Style,
**Position ▸ Standard | Drag & Drop**.
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
- **Length** (`Resize ▸ Length`, `CountertopDragModeHandle.enterLength`) — the same session and overlay
  without `setDragEnabled(true)`: the end handles change the length, the top's body stays where it is.
  No layout intro. Apply, Cancel and the history are those of Drag & Drop. Offered only for a thick top
  (4″, 5⅛″, 5½″: `isLengthResizableThickness`), and, like Position, only where `CountertopDragMode` runs
  (Urban Low Height, Urban Duplex), in Prebuilt as in Custom. Elsewhere Resize holds Thickness alone.
- Cabinet Drag & Drop and countertop Drag & Drop block each other (`externalBusy` / `disabled`).

## History

One edit of the countertop is one undo step: the state is read when the edit starts
(`onSessionStart`, awaited before `setDragEnabled(true)`) and written when it ends with a change.

| How the edit ends | History |
|---|---|
| **Apply** with another position or length | One entry |
| **Apply** where the top stood (`isSameCountertopPose`) | None |
| **Cancel / ×** | None |
| **Standard**, inside Drag & Drop or from the menu | One entry; none when the top already was standard |
| The top takes, moves or lands the sink (`liftSink` / `moveSink` / `landSink`) | One entry for the whole edit, written when the sink commits |

A sink commit replaces the cabinets under the top, so it writes the entry itself and then closes the
session; the Apply that follows finds nothing left to write. Cancel that lands a hosted sink on the way
back leaves the entry to that landing. While the mode is open, Undo and Redo are disabled; while a
snapshot is being restored, the mode cannot be entered.

Undo and redo put the top back through the layout of the scene (position, custom length, hosted sink),
see `docs/runtime-bindings-migration.md` → Scene restore. The test-mode modal
(`CountertopPlacementControls`) writes no entries.

## Overlay (`CountertopDragOverlay.tsx`)

Anchors come from the frame in iframe px (the layer covers the iframe 1:1): move icon at `center`,
length chip at `lengthLabel` (fallback `topCenter`), depth chip 28 px right of `depthLabel` (fallback
`rightEnd`), handles at `leftEnd` / `rightEnd`, Apply + × under `bottomRight` (clamped into the viewport).
`status: "colliding"` / `canApply: false` disables Apply and shows `reasons[0].message`.

- The ✎ of a chip opens its popover, one at a time (`ui/CountertopDimensionPopover/`: the component,
  its styles, its placement and their tests):
  - **Length**: a length field in inches with a 1″ stepper (↑ / ↓ keys too), Min / Max of the effective
    limits (`getState().lengthLimitsM`, then the frame's `limits`, then the collection's), Align Left /
    Center / Right (Center first), Apply.
  - **Depth**: the depth field and its stepper alone, Apply. The scene publishes no depth limits, so
    there is no Min / Max; the depth only stays above 0.
- The popover is portalled to the body at the popups' level, above the page header that covers the top
  of the canvas on phones, and placed by `dimensionPopoverPlacement.ts`: above the chip, else below,
  else over it; across within the canvas, down within the window. A transparent layer covers the page
  while it is open: a press outside it, ×, Escape or the chip again close it.
- No scene command takes a typed length with an alignment, or a depth, yet: Apply only closes the
  popover, nothing is sent and the session stays open. The chips are disabled while a command runs or
  the top is dragged.
- Handles resize from their own end, the other end fixed: the pointer asks
  `countertopOverlay.lengthAtPointer(side, point, { snap: true })` (rAF-throttled, one request in flight),
  the ghost follows `previewLength`, and release sends `countertop.resizeFrom(side, lengthM)` within
  `getState().resizeBoundsM[side]`. They work on a standard (attached) top too; it then counts as moved.
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
