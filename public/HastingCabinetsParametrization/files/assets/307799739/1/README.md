# Countertop

The active composition owns one `Top_Solid` countertop. Horizontal layout, vertical support,
manual movement, custom length, boolean cutouts and presentation are separate concerns that meet
in `RuleCountertopLayout` and `CountertopCompositionAdapter`.

All spatial values are metres. Layout measurements use world space; the adapter ultimately writes
the countertop root's local position.

## Current scope

- `CompositionManager` creates one countertop when the composition gets its first cabinet.
- That countertop is currently declared as `CountertopRole: 'basinTop'`.
- `CountertopRole: 'cabinetCover'` and multiple countertop instances are domain concepts for the
  next layout stage; the current single-countertop lifecycle does not generate them yet.
- Urban Standard Height keeps the legacy height-table positioning.
- ULH, Class and Mako opt into support-plane positioning through product metadata.

## Snapshot data

The composition saves these fields on the countertop product snapshot:

| key | meaning |
|---|---|
| `productType: 'Top_Solid'` | immutable registry identity; do not derive capabilities from the runtime entity name |
| `CountertopPositioning: 'legacy' \| 'support-plane'` | vertical positioning strategy selected when the countertop is created |
| `CountertopPlacement: 'supported' \| 'independent'` | whether layout aligns the countertop to cabinet supports or preserves its base Y |
| `CountertopRole: 'basinTop' \| 'cabinetCover'` | semantic purpose; only `basinTop` is instantiated today |
| `SupportGroupId` | support plane used by this countertop; currently defaults to `group-1` |
| `SpatialOffsetM: { x, y }` | manual offset from the standard X/Y produced by `RuleCountertopLayout` |
| `CountertopLengthM` | custom length, only meaningful while the countertop is moved |

Cabinet snapshots must also preserve their registry `productType`. The positioning profile reads
`snapshot.productType` and then resolves `countertopSupport` from `ProductRegistry_V2`; entity
names are not product capabilities.

## Layout ownership

`RuleCountertopLayout` submits one complete standard layout update containing X, Y and length:

1. `countertop-layout-policy.mjs` calculates horizontal base X and automatic length.
2. `countertop-support-measurement.mjs` reads cabinet support planes and the countertop mount plane
   from the PlayCanvas scene.
3. `countertop-support-resolver.mjs` calculates the supported root world-Y without touching the
   scene.
4. `resolvedRootWorldYToLocalY()` converts the result to the root local Y expected by the adapter.
5. `CountertopCompositionAdapter.updateStandardLayout()` applies the full X/Y/length plan once.
6. `CountertopSpatial` reapplies `SpatialOffsetM`; a manual drag never becomes the new standard
   position.

The vertical formula is:

```text
mountOffsetFromRootM = mountWorldY - currentRootWorldY
resolvedRootWorldY   = supportWorldY - mountOffsetFromRootM
```

For `support-plane + supported`, every support in the selected group must be coplanar within
`0.001 m`. A missing or non-coplanar plane is reported as unresolved and the current base Y is
preserved.

## Resolver results

| status | meaning | typical cases |
|---|---|---|
| `resolved` | a supported root Y was calculated and may be applied | valid mount point and coplanar cabinet supports |
| `passthrough` | Y intentionally stays under its existing owner | legacy positioning or independent placement |
| `unresolved` | support-plane positioning was requested but scene facts are incomplete or incompatible | missing mount/support, unknown placement, non-coplanar supports |

## PlayCanvas authoring contract

### Cabinet support point

Each support-plane collection needs a collection-specific point at the top support plane of the
cabinet. It must be a child of the cabinet template and follow every height change.

| collection | point | required position |
|---|---|---|
| ULH | `ULH_Countertop_Point` | top of the cabinet body; local Y `0.25`, `0.28`, `0.35`, `0.38` for the supported heights |
| Class | `Class_Countertop_Point` | top of the cabinet body; local Y `0.40` or `0.52` |
| Mako | `Mako_Countertop_Point` | top of the cabinet body; local Y `0.26` or `0.52` |

These are absolute local positions from the cabinet root, not movement deltas. The collection's
height rule owns them. Do not reuse a generic `Countertop_Point` across these templates.

When an authored point is missing, measurement may use only the explicitly declared
`fallbackMeshNames`. The top AABB of an arbitrary cabinet subtree is not a valid fallback because
sinks, helpers and cutters may extend above the cabinet.

### Countertop mount point

`Countertop_Mount_Point` represents the countertop installation plane that must touch the cabinet
support plane. For the current `TopSolid` template it is the bottom face of the slab.

- Put it under the `Top_Solid` product root.
- At the baseline `0.5 in` thickness its local Y is `-0.00635 m` because `TopSolid` has a centred
  pivot.
- `RuleChangeCountertopPositionByStrategy` moves this point down by half of the symmetric
  thickness stretch, so it keeps following the bottom face.
- `Top_Solid_Point` remains the legacy/thickness positioning point and is not the support mount.
- If the authored mount is unavailable, the bottom AABB of the declared `TopSolid` fallback mesh
  is used.

## Product declarations

The countertop product declares its mount capability and the rule that maintains it:

```js
registry.registerProduct('Top_Solid', {
  category: 'countertops',
  rules: [
    { rule: RuleChangeCountertopHeight, priority: 25 },
    { rule: RuleChangeCountertopDepth, priority: 30 },
    { rule: RuleChangeCountertopPositionByStrategy, priority: 35 }
  ],
  defaultConfig: {
    Thickness: 0.375,
    CountertopLengthM: null
  },
  countertopMount: {
    anchorName: 'Countertop_Mount_Point',
    fallbackMeshName: 'TopSolid',
    baseLocalYM: -0.00635
  },
  thicknessOffsets: {
    countertop: {
      // Thickness-dependent TopSolid stretch values.
    }
  }
});
```

Every cabinet product that can support this countertop declares the same strategy plus its own
scene point and verified fallback meshes:

```js
registry.registerProduct('ULH-side-cabinet', {
  category: 'cabinets',
  countertopSupport: {
    strategy: 'support-plane',
    anchorName: 'ULH_Countertop_Point',
    fallbackMeshNames: ['ULH_Cabinet_Walls']
  },
  // meshConfig, rules and defaultConfig...
});
```

Declare `countertopSupport` on both sink and side variants of the collection. The support-plane
profile is enabled only when every cabinet in the composition explicitly resolves to the same
non-empty strategy. A mixed or incomplete composition deliberately falls back to `legacy`.

`ProductRegistry_V2.registerProduct()` preserves `countertopSupport` and `countertopMount`, while
`getCountertopSupport()` and `getCountertopMount()` expose them to scene measurement. Keep sink
attachment metadata separate under `sinkMount`; it is not part of the countertop support-plane
contract.

## Adding another support-plane collection

1. Add a collection-specific support point to the PlayCanvas cabinet template.
2. Put it exactly on the cabinet's top support plane and verify every allowed height.
3. Update the collection height rule with absolute local Y values for that point.
4. Add `countertopSupport` to every cabinet product variant in `product-config-loader.mjs`.
5. Declare only verified cabinet-body meshes in `fallbackMeshNames`.
6. Ensure `SceneManager` writes the registry identity to `config.productType` for both individual
   creation and `presetProducts()`.
7. Add anchor, measurement, resolver and complete-layout tests before enabling the collection.

## Length rule (`countertop-layout-policy.mjs`)

- **Attached** (no offset): the length is the composition's length and follows it.
- **Moved** off the composition: a custom length may be set (`setSize`); without one it keeps
  following the composition.
- Moving back onto the composition (offset 0) drops the custom length.

## Files

| file | role |
|---|---|
| `countertop-layout-policy.mjs` | pure standard horizontal layout: composition length and base X |
| `countertop-support-resolver.mjs` | pure vertical support-plane/profile policy |
| `countertop-units.mjs` | inch labels for dimension lines |
| `adapters/countertop-support-measurement.mjs` | PlayCanvas measurement adapter for cabinet supports and countertop mount |
| `adapters/countertop-composition-adapter.mjs` | active countertop state, commands, atomic standard layout, length, booleans and presentation |
| `adapters/countertop-geometry-adapter.mjs` | X length via SmartStretch and boolean rebuild |
| `adapters/countertop-edit-overlay.mjs` | "edit size" button, shown only while moved |
| `adapters/countertop-dimension-adapter.mjs` | length/depth dimension lines |
| `spatial/countertop.manipulable.mjs` | countertop integration with `spatial-manipulation`: motion, snap rules and collision |
| `spatial/countertop-snap-targets.mjs` | composition snap targets: edges, centres, tops, endpoints and joints |
| `spatial/countertop-spatial.mjs` | World registration, drag gating, restored offset and commit on drag end |
| `spatial/countertop-assembly-resolver.mjs` | entities that move with the countertop, including sinks and cutters |
| `../composition/rules/RuleCountertopLayout.mjs` | scene orchestration and the single complete X/Y/length writer call |
| `../product/registry/product-config-loader.mjs` | `Top_Solid` mount and cabinet support capability declarations |

Collision outline is implemented in `composition/spatial/collision-outline.mjs` and shared with the
modules. The colliding countertop and everything it overlaps turn red.

## Tests

The Node suites for this contract are:

- `tests/node/countertop-support-resolver.test.mjs`
- `tests/node/countertop-layout-rule.test.mjs`
- `tests/node/countertop-position-strategy.test.mjs`
- `tests/node/collection-countertop-anchors.test.mjs`
- `tests/node/countertop-manipulation.test.mjs`

## API — `ConfiguratorAPI.countertop`

`getState()`, `isDragEnabled()`, `setDragEnabled(bool)`, `setOffset({ x, y })`, `resetOffset()`,
`setSize({ length })` (moved only; `null` = composition length), `whenSettled()`,
`on('change' | 'action', callback, { emitCurrent })`, `off(event, callback)`.
