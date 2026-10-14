# Column rows — the `columns` layout behaviour

Every modular collection is laid out in **rows of places**. This folder adds the case where a place may hold
**two cabinets**: a `top` hanging from the countertop plane over a `bottom` standing on the floor (Urban Duplex first;
a collection opts in with `columns: true` in `../modular-collections.mjs`). A row does not go away — it gains column places. No PlayCanvas here: metres, world X is the row axis, a cabinet
pivot is its bottom centre. Everything that touches the scene lives in `../adapters/` and the bridge runtime.

## Model

```
Row   { id, leftM, bottomM (row floor), topM (countertop plane = bottomM + tierHeightM), zM, places }
Place { full: id }                                   one cabinet as tall as the tier
      { top: id|null, bottom: id|null, bottomOffsetM? }  a column; the shift of the bottom under the top (drag only)
```

Product rules the code encodes (Andriy, 13.10.2026):
- **R1** — a cabinet lower than the tier hangs from the plane (`top`) wherever it is added; one as tall as the tier
  stands on the floor (`full`). The first cabinet of a row is therefore a `top` when it is low.
- **R2** — a shifted column (`bottomOffsetM ≠ 0`) is made only by drag & drop; "+" adds aligned; presets reproduce
  what was saved (`bottom.offsetX` in the compact preset).
- A column is not a second tier: the placement kernel (`../kernel/placement-checks.mjs`) counts a place once.

## Modules

| File | Role | Called by |
|---|---|---|
| `cabinet-columns.mjs` | The engine: `layoutColumnRow` (X/Y of every member), `columnRowFromBoxes` (boxes → row; a pair is a column only when the upper stands on the lower on the row level, else it throws and callers read one row per cabinet), `insertPlace` / `addToColumn` / `removeCabinet` / `findCabinetPlace`, R1 (`isLowerThanTier`, `placeForHeight`), `boxFromPivot`, `columnSlotFor` | `../adapters/cabinet-columns-layout.mjs`, `../compact-preset.mjs`, `../placement-slots.mjs`, the runtime |
| `connect-points.mjs` | A **connect point** is one X face of one node with its Y range (`{ xM, side, node, yMinM, yMaxM }`). Faces of a box are its edges; a cabinet may carry extra faces (the Duplex handle panels). `alignments` / `nearestAlignment` pair a draft face with a target face. | `column-snap.mjs`, `../adapters/connect-points-adapter.mjs` |
| `column-snap.mjs` | Where a dragged cabinet lands: within 3 cm (`COLUMN_SNAP_M`) of a free column slot (centred, on a panel face, or shifted when it rests on ≥ 10 cm — `MIN_OVERLAP_M`), a row end (hanging or on the floor, face to face with the end cabinet's panels when they overlap in Y) or the floor. Returns `{ positionM, kind }`. | runtime `snappedIntoColumn` (every `updateDraft`) |
| `column-plus-anchors.mjs` | The "+" buttons of column rows: kinds `left` / `right` (row ends), `top` / `bottom` (free slots), `left-top` / `right-top`; each probed against obstacles. | `scene-manager._setColumnPlusButtons` |

Related, outside this folder: `../placement-slots.mjs` (the options `getPlacementOptions` returns, with the same kinds),
`../compact-preset.mjs` (format `urban-compact-v2`, `{ top, bottom: { …, offsetX } }`), `../adapters/cabinet-columns-layout.mjs`
(the layout policy, Apply after a drag, "+" placement, support groups `~under`), `../adapters/connect-points-adapter.mjs`
(measures the named nodes on the live entity through an injected `bounds`).

## Boxes: two sources, on purpose

The document layer (rows, places, Apply, presets, slots' rows) works on **config boxes** (`boxFromPivot(positionM, { Width, Height, Depth })`),
so what a drop computes is what the serializer re-reads. **Mesh boxes** (`scene.bounds`) are for collisions and the dragged
cabinet's own box only. Connect points are measured on the mesh of the named nodes (`scene.nodeBounds`, flat panels included).

## Adding connect points to another collection

Declare the nodes and the kind of connection in the product registry; nothing else is wired:

```js
registry.registerProduct('X-side-cabinet', { …, connectPoints: [
    { node: 'X_Panel_Left', kind: 'x-faces' }, { node: 'X_Panel_Right', kind: 'x-faces' }
] });
```

`kind` names how the node connects (`CONNECT_POINT_KINDS` in `connect-points.mjs`): `x-faces` = its left and right
X faces with their Y range — the only kind so far. A new way to connect is a new kind plus its measurement in the
adapter; existing declarations keep working. A node that is missing, hidden or has no X extent is skipped; a product
without `connectPoints` has only its box edges; an unknown kind throws (a registry mistake).

## Tests

`tests/node/cabinet-columns.test.mjs`, `column-snap.test.mjs`, `connect-points.test.mjs`, `column-plus-anchors.test.mjs`;
the adapter and runtime in `cabinet-columns-layout.test.mjs`, `connect-points-adapter.test.mjs`, `ud-columns-runtime.test.mjs`.
Console walkthroughs and presets: `docs/features/ud-columns/demo.md`.

## Future refactor: one row engine (planned, not before the UD release)

Today the two cases run side by side:

| | plain rows (ULH) | rows with columns (UD) |
|---|---|---|
| engine | `../cabinet-rows.mjs` (level bands, several rows, no fixed plane) | `cabinet-columns.mjs` (one tier, places `{ full } \| { top, bottom }`) |
| policy / Apply / "+" | `../adapters/cabinet-rows-layout.mjs` | `../adapters/cabinet-columns-layout.mjs` |
| options "+" | `placement-slots.mjs` level bands | `placement-slots.mjs` `planColumnSlots` |
| switch | `columns: false` | `columns: true` (modular-collections.mjs, `usesColumns()`), 5 forks in `cabinet-local-runtime.mjs` |

Target: **one row engine** where a place is always `{ full } | { top, bottom }` and a plain row is the special case
"every place is `full`"; one layout policy; `placement-slots` and the plus planner read places, never level bands;
the runtime keeps no `usesColumns()` fork (one `documentLayout` object per collection). Steps, each shippable:
1. Make `cabinet-rows.mjs` rows carry `places` (all `{ full }`) and read/write them through `columnRowFromBoxes` /
   `layoutColumnRow` behind the existing `reconcileRows` / `planCabinetDrop` API (ULH tests must stay byte-for-byte).
2. Merge the two policies into one `createRowsLayoutPolicy({ columns })`; delete `cabinet-columns-layout.mjs`.
3. Collapse the runtime forks into a `documentLayout` strategy object (savedLayouts / documentRows / applyRows / arrangeDrop).
4. Make `tierHeightM` required for `columns: true` and delete the "no plane" fallbacks (`withTierPlane`, `tierHeightOrZero`).
5. Feed the column snap targets to the spatial-manipulation profile (see `column-snap.mjs` header) — one snap layer.
Effort: M–L (ULH regression risk in step 1; run the full ULH suite and the manual ULH flows after each step).

## Future refactor: one place to declare how a collection composes (planned)

What a cabinet IS lives in the product registry (`product-config-loader.mjs`: sizes, rules, anchors, connect points).
How cabinets COMPOSE lives nowhere in particular — it is spread over: the collection entry (`modular-collections.mjs`:
`columns: true`), the pack (`collections/*.pack.mjs`: roles SB/SC, traits, tolerances, placement rules, `tierHeightM`),
SKU-like limits hard-coded in tests / Test UI / the UI (widths per height, Drawers per height, HandleStyle per width),
the rules manifest (`docs/rules-manifest.md`), and per-feature switches (cover policy, plus kinds, snap radius).
Adding a collection today means touching all of them and knowing which one owns what.

Target: a **composition matrix** per collection — one declarative entity read by the kernel, the layout policy, the
"+" planner, the snap, the presets and the Test UI:

```js
compositionOf('UD') -> {
  tier: { heightM: 0.56, columns: true },             // rows, and whether a place may hold a column
  roles: { SB: [...], SC: [...] },                      // which product types play which role (today: pack.roles)
  allowed: { widthsByHeight, drawersByHeight, handleStyleByWidth, sinkOnly: ['top'] }, // the permission matrix
  neighbours: { gapM, contactM, snapM, minOverlapM },    // tolerances the layout and the snap share
  plus: ['left', 'right', 'top', 'bottom'],              // kinds this collection offers
  cover: { underCarried: false }, countertop: { … }
}
```

Open questions to settle before building it: where it lives (extend the pack, or a new `collections/<id>.composition.mjs`
next to it; the product registry stays per product), who validates it at load time (fail fast like `rowsCollection`
does today), and how the UI reads the same matrix (export it through the API so SKU limits are not duplicated there).
Effort: M for the matrix + reading it in the placement kernel and the Test UI; the rest migrates piecewise.

