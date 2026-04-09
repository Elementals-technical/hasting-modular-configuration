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
