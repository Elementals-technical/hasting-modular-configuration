# SidePanel API Documentation

## Panel Types

| Type | Description |
|------|-------------|
| `None` | No panel (deletion) |
| `UpperG` | Upper groove variant |
| `CenterG` | Center groove variant |
| `DoubleG` | Double groove variant |
| `NoG` | No groove variant |

## Panel Sides

| Side | Description |
|------|-------------|
| `left` | Left edge panel |
| `right` | Right edge panel |
| `both` | Both sides (default) |

## ULH rows and groups

For a composition containing only ULH cabinets, `SidePanelSide` is a shared choice
for every row. `both` enables a separate left and right panel on every fully exposed,
compatible row edge, including edges facing a gap. Two separated rows can therefore
produce four panel products. Two vertically stacked rows also use separate panels;
their heights are never added together.

The physical edge cabinet supplies each panel's `Height`, `Depth`, `CabinetColor`,
`Handle`, `HandleGrooveColor` and `GrainDirection`. Panels align to that cabinet's X
edge, bottom Y and depth centre Z. Cabinet insertion order does not choose the reference.
Neighbouring cabinets in any group can cover a side. Covered or partially covered
sides produce no panel; shelves without registered side-panel support and sizes outside
the existing ULH geometry tables also produce no panel. The selected type remains saved,
so a panel reappears when its edge becomes fully exposed and compatible.

`None` with `left`, `right` or `both` removes all panels on the selected sides. Each
side can retain its own requested type. Actual ULH appearance still follows the cabinet
handle: PTO uses `NoG`, top-cut uses `UpperG`.

Every actual panel is an individual `addons` product, available through `getConfig`
and composition snapshots with its own ID and actual dimensions/material. Pricing
consumers must enumerate panel products, rather than assume at most one per side.
The registered product types and random product ID format remain
`ULH-SidePanel_Left` / `ULH-SidePanel_Right` and `<productType>-<suffix>`.

Additional panel configuration fields:

| Field | Meaning |
| --- | --- |
| `SidePanelLayout` | `group-edge` for the ULH row lifecycle |
| `SidePanelAnchorCabinetId` | Actual physical edge cabinet |
| `SidePanelEdgeKey` | `<cabinetId>:<side>`; independent of changing row/group IDs |
| `SupportGroupId` | Current support group; updated after regrouping |
| `SidePanelRequestedType` | Shared requested type for this side |

Snapshots persist the shared selection in `features.sidePanelSelection`, including
when no eligible panel products exist. Restore accepts multiple ULH panels on one side
and reuses their product IDs. Old ULH outer panels migrate to the new lifecycle in place.
The basin countertop counts only planned panels of its own support group in the same
rule cycle. Towel bars use the panel at their actual edge cabinet.

Other collections retain the one-left/one-right lifecycle described in the examples below.

---

## Usage Examples

### 1 cabinet — 2 panels (left + right)

```js
// Створити композицію з 1 кабінетом
var ids = await ConfiguratorAPI.presetProducts([{
  name: "Sink-Base",
  CabinetColor: "Pulpis Chiaro TKH",
  CountertopColor: "Noce Sinfonia TKM",
  Width: 60, Depth: 50.5, Height: 53
}]);

// Додати панель зліва
await ConfiguratorAPI.setConfigBatch({}, { SidePanel: 'UpperG', SidePanelSide: 'left' });

// Додати панель справа
await ConfiguratorAPI.setConfigBatch({}, { SidePanel: 'UpperG', SidePanelSide: 'right' });

// Або обидві одразу
await ConfiguratorAPI.setConfigBatch({}, { SidePanel: 'UpperG', SidePanelSide: 'both' });
```

### Multiple cabinets — panels on edges

```js
// Створити композицію з декількох кабінетів
var ids = await ConfiguratorAPI.presetProducts([
  { name: "Sink-Base", Width: 60, Depth: 50.5, Height: 53 },
  { name: "CabinetUniBox", Width: 60, Depth: 50.5, Height: 53 },
  { name: "CabinetUniBox", Width: 40, Depth: 50.5, Height: 53 }
]);

// Панель ставиться на крайній лівий кабінет
await ConfiguratorAPI.setConfigBatch({}, { SidePanel: 'CenterG', SidePanelSide: 'left' });

// Панель ставиться на крайній правий кабінет
await ConfiguratorAPI.setConfigBatch({}, { SidePanel: 'DoubleG', SidePanelSide: 'right' });

// Різні типи на різних сторонах — ОК
// Ліва: CenterG, Права: DoubleG

// Перевірити крайні кабінети
const { leftCabinetId, rightCabinetId } = ConfiguratorAPI.getEdgeCabinets();
console.log('Left edge:', leftCabinetId);   // ids[0]
console.log('Right edge:', rightCabinetId); // ids[2]
```

### Legacy API (cabinetId)

```js
// Отримати крайні кабінети
const { leftCabinetId, rightCabinetId } = ConfiguratorAPI.getEdgeCabinets();

// Панель на лівий край через cabinetId
await ConfiguratorAPI.setConfigBatch(
  { cabinetId: leftCabinetId },
  { SidePanel: 'UpperG' }
);

// Панель на правий край через cabinetId
await ConfiguratorAPI.setConfigBatch(
  { cabinetId: rightCabinetId },
  { SidePanel: 'CenterG' }
);

// Якщо 1 кабінет (leftCabinetId === rightCabinetId) — ставить на both
await ConfiguratorAPI.setConfigBatch(
  { cabinetId: leftCabinetId },
  { SidePanel: 'UpperG' }
);
// Результат: обидві панелі UpperG

// Видалити панель через legacy
await ConfiguratorAPI.setConfigBatch(
  { cabinetId: leftCabinetId },
  { SidePanel: 'None' }
);
```

**Логіка резолюції сторони (legacy):**
1. Якщо `leftCabinetId === rightCabinetId` (1 кабінет) → `'both'`
2. Якщо `cabinetId === leftCabinetId` → `'left'`
3. Якщо `cabinetId === rightCabinetId` → `'right'`
4. Якщо кабінет не крайній → `'both'` + warning

**Пріоритет:** `config.SidePanelSide` > `options.cabinetId` > default `'both'`

### Remove panels

```js
// Видалити ліву панель
await ConfiguratorAPI.setConfigBatch({}, { SidePanel: 'None', SidePanelSide: 'left' });

// Видалити обидві
await ConfiguratorAPI.setConfigBatch({}, { SidePanel: 'None', SidePanelSide: 'both' });
```

### Panel auto-sync

Панелі автоматично синхронізуються з крайнім кабінетом:
- **Depth** — глибина панелі = глибина крайнього кабінету
- **Height** — висота панелі = висота крайнього кабінету
- **CabinetColor** — колір панелі = колір крайнього кабінету
- **GrainDirection** — напрямок текстури = напрямок крайнього кабінету

При зміні розміру або кольору кабінету — панель оновиться автоматично.

---

## Bridge API (ConfiguratorAPI)

### setConfigBatch — Set/Remove SidePanel

```js
// Set left panel
await ConfiguratorAPI.setConfigBatch({}, { SidePanel: 'UpperG', SidePanelSide: 'left' });

// Set right panel
await ConfiguratorAPI.setConfigBatch({}, { SidePanel: 'CenterG', SidePanelSide: 'right' });

// Set both panels
await ConfiguratorAPI.setConfigBatch({}, { SidePanel: 'DoubleG', SidePanelSide: 'both' });

// Delete left panel
await ConfiguratorAPI.setConfigBatch({}, { SidePanel: 'None', SidePanelSide: 'left' });
```

**Parameters:**
- `options: object` — optional `{ cabinetId }` for legacy API
- `config.SidePanel: string` — panel type
- `config.SidePanelSide: string` — `'left'` | `'right'` | `'both'`

**Returns:** `Promise<boolean>`

### getEdgeCabinets

```js
const { leftCabinetId, rightCabinetId } = ConfiguratorAPI.getEdgeCabinets();
```

### getConfig — Get panel config

```js
const config = ConfiguratorAPI.getConfig('SidePanel_Left-abc123');
// { SidePanelType: 'UpperG', Depth: 50.5, Height: 56, CabinetColor: '...', ... }
```

---

## CompositionManager

### setSidePanelType

```js
await compositionManager.setSidePanelType('UpperG', 'left');
await compositionManager.setSidePanelType('None', 'both');
```

**Parameters:**
- `type: string` — panel type (`'None'` | `'UpperG'` | `'CenterG'` | `'DoubleG'` | `'NoG'`)
- `side: string` — `'left'` | `'right'` | `'both'` (default: `'both'`)

**Returns:** `Promise<boolean>`

### Shortcuts

```js
compositionManager.sidePanelAddon   // → SidePanelAddon instance
compositionManager.sidePanelsService // → same (backward compat)
```

---

## SidePanelAddon

**File:** `src/Scripts/app-configuration/domain/addons/side-panel-addon.mjs`

### setType(type, side)

Sets or removes panel. Triggers state machine transitions.

```js
await sidePanelAddon.setType('UpperG', 'left');
```

### getState(side)

```js
const state = sidePanelAddon.getState('left');
// { state: 'ACTIVE', type: 'UpperG', entityName: 'SidePanel_Left-abc123' }
```

### getGlobalTypes()

```js
const types = sidePanelAddon.getGlobalTypes();
// { left: 'UpperG', right: null }
```

### setGlobalTypes(types)

```js
sidePanelAddon.setGlobalTypes({ left: 'CenterG', right: 'NoG' });
```

### calculateCountertopOffset(listSidePanel)

```js
const offset = sidePanelAddon.calculateCountertopOffset(panels);
// -0.005 (left only), +0.005 (right only), 0 (both/neither)
```

### syncPanelWithCabinet(panelId, cabinetConfig)

```js
await sidePanelAddon.syncPanelWithCabinet('SidePanel_Left-abc', {
  Depth: 50.5,
  Height: 56,
  CabinetColor: 'Pulpis Chiaro TKH',
  HandleGrooveColor: null
});
```

### buildConfig(side, type, composition)

Returns initial config for new panel, synced from reference cabinet:

```js
// Returns:
{
  SidePanelType: 'UpperG',
  Depth: 50.5,
  Height: 56,
  CabinetColor: 'Pulpis Chiaro TKH',
  GrainDirection: 'None',
  HandleGrooveColor: null
}
```

---

## AddonManager

**File:** `src/Scripts/app-configuration/domain/addons/addon-manager.mjs`

```js
addonManager.sidePanel          // → SidePanelAddon instance
addonManager.get('SidePanel')   // → same
addonManager.list()             // → ['SidePanel', 'TowelBar']
await addonManager.ensureAll(composition)  // Recreate all addons
addonManager.removeAll(composition)        // Remove all addons
```

---

## Configuration Object

```js
{
  productType: 'SidePanel_Left' | 'SidePanel_Right',
  category: 'addons',
  entityName: string,
  SidePanelType: 'UpperG' | 'CenterG' | 'DoubleG' | 'NoG',
  side: 'left' | 'right',
  Depth: number,               // mm (46, 50.5)
  Height: number,              // mm (56)
  CabinetColor: string,
  GrainDirection: string,
  HandleGrooveColor: string | null
}
```

---

## State Machine

```
IDLE → CREATING → ACTIVE → UPDATING → ACTIVE
                         → REMOVING → IDLE
```

- Cannot transition during `CREATING` or `REMOVING` (race protection)
- Global types persist across cabinet add/remove cycles
- Panels auto-recreated when cabinets are added back

---

## Internal Rules (not called directly)

| Rule | File | Watches | Behavior |
|------|------|---------|----------|
| `RuleSidePanels` | `rules/RuleSidePanels.mjs` | Width, Height, Depth, SidePanelType | Positions panels at edges, syncs config |
| `RuleChangeSidePanelVariant` | `rules/SidePanel/` | SidePanelType | Swaps mesh geometry |
| `RuleChangeSidePanelDepth` | `rules/SidePanel/` | Depth | Enables/disables depth meshes |
| `RuleChangeCabinetColorSidePanel` | `rules/SidePanel/` | CabinetColor | Applies material |

---

## Files

| File | Description |
|------|-------------|
| `domain/addons/side-panel-addon.mjs` | SidePanelAddon class |
| `domain/addons/addon-state-machine.mjs` | Base state machine |
| `domain/addons/addon-manager.mjs` | Addon registry |
| `domain/composition/rules/RuleSidePanels.mjs` | Positioning rule |
| `domain/product/rules/SidePanel/` | Product-level rules |
| `services/side-panels/side-panels-service.mjs` | Legacy service |
| `bridge/plugins/product-config.plugin.mjs` | Bridge API entry |
