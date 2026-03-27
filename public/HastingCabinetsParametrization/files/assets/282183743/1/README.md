# LineDimension Module v3 — Documentation

Generic dimension line system for PlayCanvas v2.x 3D configurators.
No external dependencies beyond PlayCanvas core. Reusable across projects.

## Architecture

```
LineDimension.mjs
├── Helpers (formatLabel, normalizeDimValue, parseVec3, mergeSettings)
├── CanvasTextureHelper — canvas text → GPU texture
├── Mesh helpers (createQuadMesh, updateQuad, createEntity)
├── DimensionLine — low-level renderer (line + endcaps + billboard label)
└── DimensionSystem — high-level manager (box + line dimensions)
```

### Two dimension types

| Type | Description | Positioning |
|------|-------------|-------------|
| **BoxDimension** | Global AABB-based dimensions (width/height/depth) computed from a set of entities | Automatic: relative to composition bounding box + camera |
| **LineDimension** | Per-entity or fully custom dimension lines | By entity AABB axis, or explicit start/end coordinates |

---

## API

### Initialization (scene-manager.mjs)

```js
import { DimensionSystem } from '../../../services/dimension/LineDimension.mjs';

const cameraEntity = this.app.root.findComponent("camera").entity;
this.app.dimensionSystem = new DimensionSystem(this.app, cameraEntity);
this.app.on('update', () => this.app.dimensionSystem?.update());
```

### Public methods

```js
dimensionSystem.showDimensions(data)   // Show dimensions
dimensionSystem.hideDimensions()       // Hide and clear
dimensionSystem.toggleDimensions()     // Toggle on/off
dimensionSystem.clear()                // Clear without changing visibility state
dimensionSystem.destroy()              // Full cleanup
```

### Frontend entry point

```js
ConfiguratorAPI.showDimensions(data);
ConfiguratorAPI.hideDimensions();
ConfiguratorAPI.toggleDimensions();
```

---

## Data format

```js
ConfiguratorAPI.showDimensions({

  // ── Box dimensions (AABB of listed entities) ──
  box: {
    nodes: ['EntityName1', 'EntityName2', 'EntityName3'],

    width:  '95 cm',                          // string shorthand
    height: { label: '53 cm', offset: 0.03 }, // object with overrides
    depth:  {
      label: '50.5 cm',
      offset: 0.05,
      offsetX: 0, offsetY: 0, offsetZ: 0,    // per-axis additive offset
      start: [x, y, z],                       // custom start position (overrides auto)
      end:   [x, y, z],                       // custom end position
    },
  },

  // ── Line dimensions (per-entity or custom) ──
  lines: [
    // Entity-based: measures entity AABB along axis
    { node: 'EntityName1', axis: 'x', label: '60 cm', offset: 0.04 },
    { node: 'EntityName2', axis: 'y', label: '35 cm' },

    // Fully custom: explicit start/end world positions
    { label: '20 cm', start: [0, 0, 0], end: [0.2, 0, 0] },

    // Mixed: entity reference + per-axis offsets
    { node: 'EntityName1', axis: 'x', label: '60 cm', offsetY: -0.02 },
  ],

  // ── Global label settings (inherited by all dimensions) ──
  labelSettings: {
    offset: 0.05,              // distance from AABB surface (default: 0.12)
    labelGap: 'auto',          // gap in line for label: 'auto' | number (default: 'auto')
    labelPosition: 'center',   // label position: 'above' | 'center' | 'below' (default: 'above')
    fontSize: 48,              // canvas font size in px (default: 48)
    fontFamily: 'Arial',       // CSS font family
    units: 'cm',               // unit system: 'm' | 'cm' | 'mm' | 'in' | 'ft' (default: 'm')
    decimals: 0,               // decimal places for auto-computed labels (default: 2)
    labelTemplate: '$L',       // template where $L is replaced by formatted value
  },
});
```

---

## Dimension value formats

Each dimension (box width/height/depth, or line) accepts:

| Format | Example | Description |
|--------|---------|-------------|
| **string** | `'95 cm'` | Custom label text, displayed as-is |
| **object** | `{ label: '95 cm', offset: 0.05 }` | Label + per-dimension overrides |

### Object fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `label` | `string` | — | Custom label text. If empty, auto-computed from distance |
| `offset` | `number` | global offset | Distance from AABB surface |
| `offsetX` | `number` | `0` | Additive X offset |
| `offsetY` | `number` | `0` | Additive Y offset |
| `offsetZ` | `number` | `0` | Additive Z offset |
| `start` | `[x,y,z]` or `{x,y,z}` | auto | Custom start position (overrides auto-positioning) |
| `end` | `[x,y,z]` or `{x,y,z}` | auto | Custom end position |

---

## Line dimension fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `node` | `string` | — | Entity name (found via `app.root.findByName`) |
| `axis` | `'x'`\|`'y'`\|`'z'` | `'x'` | Which AABB axis to measure |
| `label` | `string` | auto | Custom label text |
| `offset` | `number` | global | Distance from surface |
| `offsetX/Y/Z` | `number` | `0` | Per-axis additive offset |
| `start/end` | `[x,y,z]` | — | Override auto-positioning completely |
| `fontSize` | `number` | — | Local override for this dimension |
| `labelPosition` | `string` | — | Local override |
| `labelGap` | `'auto'`\|`number` | — | Local override |
| `units` | `string` | — | Local override |
| `decimals` | `number` | — | Local override |

---

## Settings inheritance

Priority: **local dimension settings → global labelSettings → DEFAULTS**

```
DEFAULTS (hardcoded)
  ↑ overridden by
labelSettings (from data.labelSettings)
  ↑ overridden by
per-dimension fields (inline in box.width / lines[i])
```

Example:
```js
{
  box: {
    nodes: [...],
    width: { label: '95 cm', labelPosition: 'center' },  // ← local override
    height: '53 cm',                                       // ← uses global
  },
  labelSettings: {
    labelPosition: 'above',   // ← global
    units: 'cm',
  }
}
// width → labelPosition: 'center' (local wins)
// height → labelPosition: 'above' (global)
```

---

## Positioning logic

### Box dimensions

| Type | Position | Description |
|------|----------|-------------|
| `box:width` | Top of AABB, **back** side | Horizontal line along X at `y + halfY + offset`, on Z side opposite to camera |
| `box:height` | **Front** side of AABB | Vertical line along Y at `x = frontX`, `z = frontZ` (camera side) |
| `box:depth` | **Bottom front** of AABB | Line along Z at `y - halfY - offset`, camera side X |

### Line dimensions (by axis)

| Axis | Line direction | Vertical position | Depth position |
|------|---------------|-------------------|----------------|
| `x` | Horizontal (entity width) | Below box AABB (or entity) | Front Z (camera side) |
| `y` | Vertical (entity height) | Along entity | Front X + Front Z |
| `z` | Front-to-back (entity depth) | Below box AABB (or entity) | Front X |

When a box exists, line dimensions position relative to the box AABB.
Without a box, they position relative to their own entity AABB.

---

## Rendering details

### Line rendering
- Lines are **quad-strips** (not GL_LINES) — camera-facing rectangles
- Each dimension has **two line segments** (seg0 + seg1) with a gap in the middle for the label
- Gap size: `'auto'` computes from label texture width, or fixed number in world units

### Endcaps
- Perpendicular marks at start and end of each dimension line
- Oriented perpendicular to line direction

### Labels
- Rendered via **Canvas2D → Texture → Billboard quad**
- Transparent background, black text
- Billboard: always faces camera using camera right/up vectors
- Text is **not re-rendered** if label content hasn't changed

### Material
- Unlit (`useLighting: false`)
- Renders through objects (`depthTest: false, depthWrite: false`)
- Uses Immediate layer (renders on top of World)
- Label uses `BLEND_NORMAL` with `opacityMap` for transparency

---

## Examples

### Basic box dimensions
```js
ConfiguratorAPI.showDimensions({
  box: {
    nodes: ['Cabinet1', 'Cabinet2', 'Countertop'],
    width:  '95 cm',
    height: '53 cm',
    depth:  '50.5 cm',
  },
});
```

### Box + per-entity widths
```js
ConfiguratorAPI.showDimensions({
  box: {
    nodes: ['Cabinet1', 'Cabinet2'],
    width: '95 cm',
    height: '53 cm',
  },
  lines: [
    { node: 'Cabinet1', axis: 'x', label: '60 cm' },
    { node: 'Cabinet2', axis: 'x', label: '35 cm' },
  ],
  labelSettings: { offset: 0.05, labelGap: 'auto', labelPosition: 'center' },
});
```

### Only custom lines (no box)
```js
ConfiguratorAPI.showDimensions({
  lines: [
    { label: '1.5m', start: [0, 0, 0], end: [1.5, 0, 0] },
    { label: '2m',   start: [0, 0, 0], end: [0, 2, 0] },
  ],
});
```

### Per-dimension offsets
```js
ConfiguratorAPI.showDimensions({
  box: {
    nodes: ['Entity1'],
    width:  { label: '95 cm', offset: 0.03 },
    height: { label: '53 cm', offset: 0.05, offsetX: -0.02 },
    depth:  { label: '50.5 cm', start: [0.5, -0.1, -0.3], end: [0.5, -0.1, 0.2] },
  },
});
```

---

## File structure

| File | Role |
|------|------|
| `src/Scripts/app-configuration/services/dimension/LineDimension.mjs` | Module (DimensionLine + DimensionSystem) |
| `src/Scripts/app-configuration/bridge/plugins/selection.plugin.mjs` | Exposes API to frontend |
| `src/Scripts/app-configuration/domain/scene/manager/scene-manager.mjs` | Initializes DimensionSystem |

---

## DEFAULTS reference

| Key | Default | Description |
|-----|---------|-------------|
| `color` | `'#000000'` | Line and endcap color |
| `lineWidth` | `0.003` | Line thickness (3mm) |
| `endcapLength` | `0.015` | Perpendicular mark length (15mm) |
| `endcapWidth` | `0.002` | Endcap thickness (2mm) |
| `fontSize` | `48` | Canvas font size (px) |
| `fontFamily` | `'Helvetica Neue', Arial, sans-serif` | CSS font |
| `labelScale` | `0.0008` | World units per canvas pixel |
| `labelOffset` | `0.015` | Label offset from line (above/below) |
| `offset` | `0.12` | Distance from AABB surface |
| `labelPosition` | `'above'` | Label position relative to line |
| `labelGap` | `'auto'` | Gap in line for label |
| `units` | `'m'` | Unit system |
| `decimals` | `2` | Decimal places |
| `labelTemplate` | `'$L'` | Label template ($L = formatted value) |
