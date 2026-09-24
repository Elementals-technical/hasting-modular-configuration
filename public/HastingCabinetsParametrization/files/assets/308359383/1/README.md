# spatial-manipulation (V2)

A reusable block for moving objects in a plane with a grid, bounds, semantic snapping
and collision observation. A consumer describes **what** moves and **how it relates to
other objects** in a spec; the module owns input, measurement, revisions, snapping,
collision and presentation.

```text
core/        pure algorithms and contracts (no engine, no DOM)
             contracts/  motion/  snapping/  collision/
spec/        defineManipulable, selectors, feature extractors, the spec compiler
runtime/     the manipulation instance (FIFO, gestures, geometry lifecycle) and the World
playcanvas/  engine adapters: input router, projection, scene measurement, entity pose,
             snap guides, screen metric, the PlayCanvas World
index.mjs            engine-free entry
playcanvas/index.mjs PlayCanvas entry
```

## Connecting an object

```js
import { defineManipulable, tag, edges } from '.../spatial-manipulation/index.mjs';
import { getSpatialWorld } from '.../spatial-manipulation/playcanvas/index.mjs';

// 1. Describe the object once.
const moduleSpec = defineManipulable({
  id: 'composition-module',
  frame: { plane: 'xy', origin: ({ host }) => ({ x: 0, y: 0, z: host.frontZ }) },
  motion: { axes: ['u'] },
  snapping: {
    features: {
      self:      { select: 'self',                 extract: edges({ u: ['min', 'center', 'max'] }) },
      neighbour: { select: tag('cabinet'),         extract: edges({ u: ['min', 'center', 'max'] }) }
    },
    rules: [
      { id: 'abut',   from: ['self.u.min', 'self.u.max'], to: ['neighbour.u.max', 'neighbour.u.min'], op: 'align-u', priority: 0 },
      { id: 'center', from: 'self.u.center', to: 'neighbour.u.center', op: 'align-u', priority: 2 }
    ]
  },
  collision: { against: tag('cabinet'), volumes: 'bounds' }
});

// 2. One world per app; the host tells it which bodies exist.
const world = getSpatialWorld(app, { scene: compositionScene });

// 3. Register an instance of the spec for a concrete body.
const handle = await world.register(moduleSpec, { body: productId, host: { frontZ: 0.3 } });
handle.on('change', ({ offsetM, snap, collision }) => { /* … */ });
await handle.setOffset({ u: 0.12 });
world.invalidate();        // the scene changed (composition rebuilt, product added …)
```

Everything is in **metres** and in the spec's frame (`u`, `v`).

### Scene

The host supplies a scene source: which bodies exist and what they are.

```js
const compositionScene = {
  scopeId: () => composition.id,
  bodies: () => [
    { id: 'cab-1', entity, tags: ['cabinet'], meta: { productType: 'Sink-Base' } },
    { id: 'panel-left', entity, tags: ['side-panel', 'side-panel-left'] }
  ]
};
```

The world measures bodies (engine adapter), caches the measurement per scene revision and
invalidates it on `world.invalidate()` — pointer samples never re-measure the scene.

### Spec

| key | meaning |
|---|---|
| `id` | spec id (profile id in reports) |
| `frame` | `{ plane: 'xy' \| 'xz', origin }` or an explicit `{ originM, uAxis, vAxis, normal }` |
| `motion` | `{ axes, boundsM, gridM }` — defaults; the handle can change them live |
| `target` | optional: `entities(ctx)` that physically move (default: the body entity), `pose` override |
| `snapping.features` | named feature groups: `{ select, extract, when? }` |
| `snapping.rules` | pair rules between feature roles (`op`, `priority`, `when`, `bundle`, `onlyWhenFrozen`) |
| `snapping.thresholds` | `{ mouse, touch }` px thresholds |
| `collision` | `{ against, volumes, source?, epsilonM }`; observe-only |

**Selectors**: `'self'`, `tag(name)`, `all(...)`, `any(...)`, `envelope(selector)` (the union
bounds of a selection as one pseudo-body) or a function `(body, ctx) => boolean`.

**Extractors** turn a measured body into features: `edges({ u, v })`, `corners([...])`, or a
custom function `(ctx) => features` for product-specific geometry.

**Volumes**: `'bounds'` (the body AABB) or a proxy strategy (`singleBox`, `opposedBoundarySlabs`,
`componentBoxes`, `activeMemberUnion`) chosen per body by a resolver.
