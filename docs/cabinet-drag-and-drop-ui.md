# Cabinet Drag & Drop UI

`CabinetPlacementDebug` (the name is historical; it is the production control now) offers
**Drag to Place** while the cabinet builder shows its "+" buttons, and opens the drafts the cabinet
menu asks for (Reposition ▸ Drag & Drop). It has no button of its own otherwise. It works on top of
the cabinet placement API of the configurator iframe (`cabinetPlacement.*`) and its draft overlay
(`placementOverlay`, PlayCanvas `cabinet/create-new-logic`, 2026-09-29).

## Flow

1. **Drag to Place** shows above the composition (top centre of the canvas) while the style sidebar
   shows the scene's "+" for the cabinet being added (`placementButtonsVisible` of the sidebar slice,
   passed as `offerAdd`). A press calls `beginAdd` with the configured cabinet right away; like any
   press outside the sidebar it also closes the sidebar, so its "+" go away for the drag. There is no
   modal: the cabinet appears in the scene next to the selected (or last) cabinet and can be dragged
   at once. On every other step a cabinet draft opens only from the cabinet menu.
2. While the draft is open the toolbar in the top-right corner shows **Cancel**. PlayCanvas tints the cabinet
   **green** on a free spot and **red** when it overlaps another cabinet (and outlines the cabinets
   it overlaps). A red draft cannot be applied: `canApply` is false, the runtime would refuse with
   `PLACEMENT_COLLISION`; the UI disables Apply and shows a hint.
3. The icons follow the cabinet: the **move** icon (`frontCenter`), **Apply** and **discard (x)**
   under its bottom-right corner (`bottomRight`). They are this app's SVGs, placed from the
   overlay frames that PlayCanvas publishes whenever the camera, the drag or the status changes.
4. Apply commits and syncs the composition (`onCompositionCommitted`); Cancel / x discards the draft.

## History

An applied draft (an added cabinet, or Reposition from the cabinet menu) is one undo step and drops
redo, like any other change.

- The state is read **before** the draft opens (`onBeforeCompositionChange`, awaited first in
  `start()`): with an open draft the scene answers `COMPOSITION_BUSY` to an export, so the layout
  could not be read later. The entry is written when the draft is applied.
- A draft that is cancelled, cancelled by the runtime, or refused by `beginAdd` / `beginMove` writes
  nothing (`onCompositionChangeAbandoned`), and redo stays as it was.
- While a draft is open, Undo and Redo are disabled (`setHistoryBlocked`); while a snapshot is being
  restored, a draft cannot be started.
- `PlayCanvasIntegration` wires the three callbacks to `useDeferredHistorySnapshot`
  (`src/entities/history/lib/`). The component itself knows nothing about the history.

Not covered: a draft applied at the spot it started from still writes an entry, and a draft opened by
anything other than this control (the scene API called directly) writes none.

## Overlay frames

`client.onPlacementOverlay(callback)` subscribes to `ConfiguratorAPI.placementOverlay.on('change')`;
frames are kept in a small external store (`lib/placementOverlayStore.ts`) so that only
`CabinetDraftOverlay` re-renders per frame. Coordinates are CSS px of the iframe viewport; the
overlay layer covers the iframe (`inset: 0`) and ignores pointer input except on its buttons, so
dragging the cabinet goes to the canvas underneath.

On connect the UI calls `setPlacementOverlayPlaceholders(false)` (PlayCanvas draws temporary icons
until then) and turns them back on when it unmounts.

**Fallbacks.** A PlayCanvas build without `placementOverlay`, or a draft that is (partly) behind the
camera (`visible: false`), shows **Apply** next to **Cancel** in the corner.

## Engineering tools

`?placementDebug` in the page URL adds the old test panel: Move selected cabinet, the side Drag to
Place adds on (left/right) and Save / Restore JSON. Reposition from the cabinet context menu works without it.
Restore JSON and Import compact preset replace the composition, so they are announced to the history
the same way as a draft.
