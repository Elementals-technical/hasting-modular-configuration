# Countertop Position UI (Drag & Drop)

Selected countertop menu: Color, **Resize ▸ Thickness | Length**, Countertop Style, Basin Style,
**Position ▸ Standard | Drag & Drop**.
While no Sink Base stands under the basin (`isSinkOffSinkBase`: the top hosts the sink after `liftSink`, or
carries it anywhere but back home), only a top that lifts is offered (client rule 22.10, integrated or
vessel): a `Thickness` option with `capabilities.countertopLifts`, 5⅛″ or 5½″ in Urban Low Height and Urban
Duplex (`canThicknessFloat`). Resize ▸ Thickness lists the one the matrix gives the colour; the Countertop
step's swatches show only that one (they hide the disabled thin and 4″ tops), and `autoSelect` moves the top
to it (5½″ after a Porcelain colour). A colour whose material has no such row is refused with
`countertop.materialNotAvailableOffSinkBase` ("Not available when the basin is not over a sink base"): a material
that lifts at no depth (Glass, Mineralmarmo, Syntesi) gets it before the depth and width checks, so Glass at 46 cm
says the floating top, not the depth; one that lifts at another depth only (Tekorund at 46 cm) keeps the depth
reason. Each refused colour of the Countertop step says its own reason (`FieldAvailability.optionReason`).
The metre-based "Position & Size" modal (`CountertopPlacementControls`) is test mode only: it and its
menu item render only with `?countertopSettings`.

## What a thickness may do

Each `Thickness` option of the collection's profile says it (`capabilities`); no thickness is named in code.
`useCountertopMovementMode` finds the top's option (the selected value, else the scene's metres within ±0.25″):

| Capability | Effect |
|---|---|
| none | The top stays in the standard position (mode `none`): no Position item; a moved top is reset |
| `countertopSlides` | Position ▸ Drag & Drop slides it left or right, vertically locked (mode `offset`); a lifted top is lowered |
| `countertopLifts` | It also lifts (mode `free`), so only it may carry the basin off its Sink Base |
| `countertopLengthResize` | Resize ▸ Length |

Urban Low Height and Urban Duplex: 0.375–0.5″ declare none; 2.4″ slides (a floating top is 5⅛″ or 5½″, client
rule 22.10); 4″ slides and has Length; 5⅛″ and 5½″ slide, lift and have Length.

## A remote top: the Sink Base becomes a Side Cabinet

Client item "Thick Countertop Placement | Cabinet Type Auto Change" (23.10): when the top is remotely positioned
(its basin is not over a Sink Base, `isSinkOffSinkBase`), the Sink Base it took the basin from becomes a Side
Cabinet. A Sink Base added while the top is remote is not refused.

- **Lift.** Only a lift carries the basin; a resting slide keeps it in its Sink Base. The scene announces
  `sink-lift` once the top owns the sink, and `useSinkLanding` commits `cabinets.liftSink`: the Sink Base becomes
  the Side Cabinet of its pair under a new id, with its size, handle and colours, and the top hosts the basin.
- **Lowered in the same drag.** The scene also announces the lift for a top lowered again beside the row, but
  `liftSink` takes a lifted top only (`SpatialOffsetM.y` above 0.01 m, `INVALID_INPUT` otherwise). The UI then
  lifts the top 2 cm (`setOffset(…, { validation: "skip" })`), commits the lift and lowers the top back. Once
  the scene accepts a resting top, the first call goes through and this step never runs.
- **Never half done.** A lift that fails, or that waited for another sink commit, puts the top back where its
  drag started, or to Standard while it would still carry the sink, with `countertop.sinkLiftFailed`.
- **Two Sink Bases.** The scene lifts one sink off one Sink Base and announces no lift over two: a lifted top
  carries both basins and both cabinets stay Sink Bases, as before this rule, until the scene can lift both
  sinks (then both cabinets become Side Cabinets).
- **Back.** Standard, or the basin lowered over a Side Cabinet, lands it (`landSink`): that cabinet becomes the
  Sink Base again.

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
  without `setDragEnabled(true)`: the end handles change the length, the top's body stays where it is,
  so the overlay draws no move icon.
  No layout intro. Apply, Cancel and the history are those of Drag & Drop. Offered only for a top whose
  option declares `countertopLengthResize` (`isLengthResizableThickness`), and, like Position, only where
  `CountertopDragMode` runs (a collection with `ruleData.dragDrop`), in Prebuilt as in Custom. Elsewhere Resize
  holds Thickness alone.
- Cabinet Drag & Drop and countertop Drag & Drop block each other (`externalBusy` / `disabled`).

## Drag & Drop for a collection

1. `"ruleData": { "dragDrop": { "enabled": true } }` in its `product-profile.json` (`isDragDropEnabled`): the
   cabinet and countertop Drag & Drop widgets, the column "+", the movement modes, sink landing and the free
   layout that undo and saves capture (`captureFreeLayout`). Urban Low Height and Urban Duplex today.
2. `capabilities` on its `Thickness` options (above).
3. The scene must place the collection's cabinets freely as well: it keeps its own list of modular collections
   (`MODULAR_COLLECTIONS` in `public/HastingCabinetsParametrization/js/esm.mjs`: ULH in rows, UD in columns).
   With the flag on and no scene entry the cabinet widget never connects and a sink landing fails; with a scene
   entry and the flag off, the rows are not captured for undo or saves.

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

Anchors come from the frame in iframe px (the layer covers the iframe 1:1): move icon at `center` (Drag & Drop only),
length chip at `lengthLabel` (fallback `topCenter`), depth chip 28 px right of `depthLabel` (fallback
`rightEnd`), handles at `leftEnd` / `rightEnd`, Apply + × under `bottomRight` (clamped into the viewport).
`status: "colliding"` / `canApply: false` disables Apply and shows `reasons[0].message`.

- The hint "Drag the ends to change the length" is centred under the top's lower edge, clear of the move
  marker (`lib/lengthHintPlacement.ts`). The top's box is the frame's `bounds`, else the box around its
  `hull`, else the box around its `points`. The hint goes below the Apply / × / reason row when it would
  overlap that row, left of the row when the viewport has no room below it, and always inside the viewport.
- While the top is lifted (`canResize` in the runtime state), the scene draws its own "Edit size" button
  over the top. The overlay reads that button's rect from the scene document
  (`lib/readEditSizeButtonRect.ts`) and keeps clear of it (`lib/editSizeButtonClearance.ts`): the length
  chip moves right above the button and the move marker right below it, both at the same `x`. The length
  popover and the hint follow the moved points. Without the button the elements stay at their anchors.
  The click on the button does nothing in the normal flow.

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
