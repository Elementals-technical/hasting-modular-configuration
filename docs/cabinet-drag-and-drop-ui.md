# Cabinet Drag & Drop UI

`CabinetPlacementDebug` (the name is historical; it is the production control now) renders the
**Drag & Drop** button in the top-right corner of the canvas. It works on top of the cabinet
placement API of the configurator iframe (`cabinetPlacement.*`) and its draft overlay
(`placementOverlay`, PlayCanvas `cabinet/create-new-logic`, 2026-09-29).

## Flow

1. **Drag & Drop** (enabled once a cabinet configuration is selected) calls `beginAdd` with the
   configured cabinet right away. There is no modal: the cabinet appears in the scene next to the
   selected (or last) cabinet and can be dragged at once.
2. While the draft is open the button is replaced by **Cancel**. PlayCanvas tints the cabinet
   **green** on a free spot and **red** when it overlaps another cabinet (and outlines the cabinets
   it overlaps). A red draft cannot be applied: `canApply` is false, the runtime would refuse with
   `PLACEMENT_COLLISION`; the UI disables Apply and shows a hint.
3. The icons follow the cabinet: the **move** icon (`frontCenter`), **Apply** and **discard (x)**
   under its bottom-right corner (`bottomRight`). They are this app's SVGs, placed from the
   overlay frames that PlayCanvas publishes whenever the camera, the drag or the status changes.
4. Apply commits and syncs the composition (`onCompositionCommitted`); Cancel / x discards the draft.

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

`?placementDebug` in the page URL adds the old test panel: Move selected cabinet, add side
(left/right) and Save / Restore JSON. Reposition from the cabinet context menu works without it.
