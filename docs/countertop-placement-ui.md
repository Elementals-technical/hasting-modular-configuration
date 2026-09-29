# Countertop positioning UI

The canvas exposes **Countertop: Position & Size**, also accessible from the
countertop context menu. This edits the single top exposed by the generic
`window.ConfiguratorAPI.countertop` namespace, not individual cabinet covers.

## Modes and commands

- **Layout** enables pointer dragging of the selected top via
  `setDragEnabled(true)`. X/Y offsets are in metres from the standard position;
  numeric positioning uses `setOffset({ x, y })`.
- **Standard** disables dragging and calls `resetOffset()`, restoring attachment
  and automatic length. It is a layout choice, not a change to the product's
  internal `CountertopPositioning` support-plane strategy.
- Custom length uses `setSize({ length })` in metres and is allowed only while
  `getState().canResize` is true. `length: null` restores automatic length.
  Depth and thickness are displayed read-only: this API cannot resize them.

## Apply / Cancel

The runtime has no countertop draft/commit endpoints. Preview changes are live.
Before editing, the UI captures API identity, composition/product identity,
offset, attachment, custom length (including `null`) and drag-enabled state.

**Apply** disables dragging, waits for `whenSettled()`, and synchronizes the
effective runtime size with the dimension display and pricing input.
**Cancel** restores the captured position and custom length. Restoring a moved
offset may be constrained by the runtime, so the UI verifies the resulting pose
and reports failures instead of claiming a successful rollback.

Cabinet placement and preset commands are disabled during countertop editing.
The rest of the configurator (sidebar, navigation, Quote/Save and player tools)
is temporarily inert, including newly mounted portal surfaces. The canvas and
countertop editor remain interactive; Apply/Cancel restores previous availability.
Leaving/reloading the page while preview is active triggers the browser's unsaved
changes warning.
Changing the bound product/composition invalidates the editor: the UI must not
restore the old snapshot onto a replacement top.

## Files

- `src/features/countertopPlacement/ui/CountertopPlacementControls.tsx`: editor,
  generic API types, snapshot and lifecycle.
- `src/widgets/Player/components/PlayCanvasIntegration/PlayCanvasIntegration.tsx`:
  iframe API resolution, context menu, selection, mutually exclusive editing,
  committed dimensions and pricing synchronization.
- `src/shared/lib/countertopRuntimeSize.ts`: applied top size, separate from
  cabinet dimensions. Preview events do not publish pricing changes.
- `src/shared/hooks/usePricingInput.ts` and pricing builders: use the applied
  length for the top instead of assuming it equals the sum of cabinet widths.

This does not implement a full multi-top/cabinet-cover pricing model, spatial
production validation, or a runtime transaction. Other clients of the runtime
can observe live preview changes before Apply.
