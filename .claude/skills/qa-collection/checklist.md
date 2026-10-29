# Collection checklist

Source: the team's Slack canvas F0CCQ2KLS3G (copied 2026-10-28), regrouped into six groups for parallel runs. Scope here is
desktop Chrome plus Chrome mobile emulation; Safari and real iOS devices are out of scope.

For every finding record the configId (when one exists), the console text, and the exact steps.

## Section 0 — console and network (part of every group)

- No `console.error`.
- No 404 on textures, GLBs or scripts.
- No failed price requests.
- Repeated warnings: record the text and the action that triggers them.

## Group 1 — flow, presets, price (sections 1, 2, 9)

### 1. Steps and navigation
- Steps and section order match the spec's steps table (§3 of the collection spec). A difference from Urban Standard Height is
  a bug unless the spec lists it as expected.
- Forward and back work between all steps, in both prebuilt and create-your-own.
- Prebuilt → create-your-own and back: state survives.
- Browser Back and page reload on every step.
- Values in every section are sorted sensibly: sizes ascending, no duplicates, the same order as in other collections.
- Step and section names have no typos and consistent casing.
- Switching to another collection leaves no state from the previous one.

### 2. Presets (prebuilt)
- Every preset opens.
- Model, colours, height and basin in 3D match the preset thumbnail.
- Every preset has a non-zero price.

### 9. Price and SKU
- A price is shown on every step and changes on every change that should affect it.
- The price is the same before and after undo/redo, and after opening the configuration through Share.
- Summary has no empty SKUs, `undefined`, `NaN` or zeros.
- The SKU changes with the option: colour, handle, side panel with the handle colour code.

## Group 2 — materials and parameters (sections 3, 4)

### 3. Materials and patterns
- Every material in every colour section is applied to its own part: cabinet, front or panel, handle or groove, frame, legs,
  countertop, vessel.
- The swatch matches the 3D and updates on every change.
- No black, pink, transparent or default-grey materials.
- Patterns (Fluting / Cabinet Pattern) switch on every front and combine with every colour.
- Grain Direction works where it exists.
- An unavailable material is hidden. When the selected one becomes unavailable it is reset, with a hint.
- Materials and patterns survive each of: adding a cabinet, removing one, duplicate, resize, reposition, D&D, undo/redo,
  opening a saved configuration.

### 4. Cabinet parameters
- Every value switches and gives whole geometry, with no gaps, floating parts or z-fighting: width, height, depth, drawer
  count, cabinet type and style, handles.
- The value in the UI matches the size in 3D (check through Dimensions).
- Combinations absent from the tables are unavailable rather than giving an empty model.

## Group 3 — countertop, basins, accessories (sections 5, 6)

### 5. Countertop and basins
- Countertop colour, thickness, Countertop Style, Basin Style and Vessel Color all switch.
- Vessel Color is shown only for vessel basins.
- The basin's name and icon match the model (check against the basin table in the spec).
- The basin sits right: no sinking, no gap, the cut-out in place.
- The basin material changes with the selection.
- Faucet Holes: the options match the basin, in 3D and in the SKU.
- Countertop: length and resize, offset, thickness compatibility, thin and thick countertop under D&D.

### 6. Accessories
- Side panels: left, right, both, groove type. The material matches the selection; panels do not float; panels update on resize
  and on adding or removing the neighbouring cabinet.
- Towel bar: placed, not floating, changes colour together with the handles.
- Lateral panel (UD), legs and Leg Color (Mako), Leg Cap (Lame), undertop.
- Dividers are not tested (in development), but the Accessories step in Class, Mako and Lame must open and not break moving on.

## Group 4 — cabinets: add, D&D, validation (section 7)

- Cabinet Builder: add every cabinet type. Ghost and "+" are in place.
- Remove, including the last cabinet.
- Duplicate copies materials, pattern, handles, basin and its material.
- D&D: valid positions highlight; invalid ones go red and snap back; SB ↔ SC switches automatically where it should.
- Limits: maximum cabinets, maximum 2 SB, hints shown.
- The cabinet context menu opens on the selected cabinet and closes after the action: Reposition left and right; Resize
  (Width, Depth, plus Height in ULH and UD); Duplicate; Remove.

## Group 5 — player functions (section 8)

- Zoom and orbit.
- Dimensions: values correct, in inches and centimetres.
- Share: the link opens an identical configuration with the same price.
- Undo/Redo for every action type: material, parameter, add, D&D, resize.
- Image and Quote PDF trigger real downloads: do not click them; list them under Not verified (they need a manual click).

## Group 6 — mobile (section 10, Chrome mobile emulation)

- The collection opens and walks from Model to Summary.
- Menus, swatches and the context menu respond to taps.
- D&D works by touch.
- Landscape orientation shows the placeholder.
- The iOS self-reload after 10–15 minutes is out of scope (no iOS).
