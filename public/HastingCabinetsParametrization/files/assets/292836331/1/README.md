# Drawer Dividers

Цей документ збирає поточну архітектуру, правила розрахунку, API, UI-інтеграцію, логування та QA-сценарії для divider-досвіду.

## Де лежить код

PlayCanvas:

- `Scripts/app-configuration/services/drawer-divider/` - core divider domain.
- `Scripts/app-configuration/services/OverlaySystem/divider-slot-overlay-system.mjs` - DOM overlay над PlayCanvas сценою.
- `Scripts/app-configuration/bridge/plugins/divider.plugin.mjs` - `ConfiguratorAPI.dividers.*`.
- `Scripts/app-configuration/bridge/helpers/divider-view-guard.mjs` - guard для save/restore divider view під час змін конфігу.
- `Scripts/app-configuration/tests/suites/divider.test.mjs` - divider regression tests.

UI:

- `/Users/personal/Desktop/elementals/hasting/hasting-modular-configuration/src/pages/custom/accessories/index.tsx`
- `/Users/personal/Desktop/elementals/hasting/hasting-modular-configuration/src/pages/prebuilt/accessories/AccessoriesPage.tsx`
- `/Users/personal/Desktop/elementals/hasting/hasting-modular-configuration/src/utils/functions/playcanvas/dividers/`

## Divider типи

Source of truth: `core/divider.constants.mjs`.

| Type | Width, cm |
| --- | ---: |
| `A` | `13.5` |
| `B` | `17.1` |
| `C` | `22.1` |

Базова мінімальна ширина слота дорівнює `A = 13.5`.

## Drawer типи і зони

Source of truth: `DATA_DRAWER_PARAMS` у `core/divider.constants.mjs`.

| Drawer | Config key | Scene point | Zones |
| --- | --- | --- | --- |
| `Top` | `TopDrawerDividers` | `TopDrawer_Point` | `siphon_left`, `siphon_right` |
| `TopFull` | `TopDrawerDividers` | `TopDrawer_Point` | `main` |
| `Bot` | `BotDrawerDividers` | `BotDrawer_Point` | `main` |

Alignment strategies:

- `edges-left` - ліва top siphon зона, рахується від лівого зовнішнього краю до сифона.
- `edges-right` - права top siphon зона, рахується від правого зовнішнього краю до сифона.
- `packed` - звичайна зона без сифона, базова сітка центрується.

## Persisted state

У конфіг зберігається compact state. Він не повинен залежати від UI overlay і не повинен міняти формат при додаванні candidate layer.

```js
{
  zones: {
    siphon_left: {
      slots: [
        {
          key: "slot_0",
          value: "C",
          stateId: "divider_1780114769890_eiscgbp5h",
          zoneIndex: 0
        }
      ]
    }
  }
}
```

Стабільні поля:

- `zoneIndex` - фіксований індекс в engine-сітці, основний ключ для add/remove/update.
- `value` - `A`, `B`, `C`, або empty-подібне значення тільки в transient slot object.
- `stateId` - id конкретного placed divider, використовується для точного remove.
- `key` - допоміжний/legacy ключ. Для placement краще не покладатися тільки на нього.

Persisted state не зберігає `candidate`, `canPlace`, `disabledReason`, `placementType` або позиції.

## Runtime slot shape

Слоти, які віддаються в overlay, мають спільний формат:

```js
{
  key: "candidate:Top:siphon_left:1:C",
  value: "empty",
  width: 22.1,
  position: {
    start: -0.4166,
    center: -0.3061,
    end: -0.1956
  },
  other: {
    type: "candidate",
    zone: "siphon_left",
    strategy: "edges-left",
    zoneIndex: 1,
    placementType: "C",
    availableTypes: ["A", "B", "C"],
    canPlace: true,
    disabledReason: null
  }
}
```

`other.type`:

- `occupied` - divider вже стоїть, overlay показує check button.
- `ghost` - legacy empty slot, overlay показує active `+`.
- `candidate` - selected-type placement slot, overlay може показувати active або disabled `+`.

Disabled reasons:

- `select-divider` - `Customize` активний, але `Option A/B/C` не вибраний.
- `does-not-fit` - вибраний тип не влазить у цю позицію.
- `no-space` - позиція не підтримує жоден divider type.

## Core flow

1. UI вибирає `Customize` і drawer.
2. UI визначає `selectedDividerType` з `Option A/B/C`.
3. UI викликає `showIconDividerSlots(cabinetId, drawerType, { show: true, selectedDividerType, debugRequestId })`.
4. PlayCanvas `DividerPlugin` нормалізує options.
5. `DividerSlotOverlaySystem.activateDrawer()` просить у `DividerFacade` або legacy slots, або placement candidates.
6. `DividerPlacementCandidateEngine` рахує candidate slots під поточний selected type.
7. Overlay рендерить:
   - occupied as check;
   - active candidates as clickable `+`;
   - disabled candidates as disabled `+`.
8. Click по active candidate йде в UI callback.
9. UI викликає `placeDividerToSlot(slotInfo, selectedType)`.
10. PlayCanvas `Facade.updateSlot()` мутує compact state, перераховує drawer slots, зберігає конфіг і запускає product rules.
11. UI refresh-ить overlay з тим самим `selectedDividerType`.

Remove flow аналогічний, але click по `occupied` викликає `removeDividerFromSlot(slotInfo)`, а `Facade.updateSlot()` видаляє запис з compact state по `stateId` або `zoneIndex`.

## Public PlayCanvas API

Namespace: `window.ConfiguratorAPI.dividers`.

### showIconDividerSlots

```js
showIconDividerSlots(cabinetId, drawerType, showOrOptions = true)
```

Backward-compatible signatures:

```js
showIconDividerSlots(cabinetId, drawerType, true)
showIconDividerSlots(cabinetId, drawerType, false)
showIconDividerSlots(cabinetId, drawerType, {
  show: true,
  selectedDividerType: "A" | "B" | "C" | null,
  debugRequestId: "ui-overlay-..."
})
```

Якщо передано object з `selectedDividerType`, overlay використовує candidate layer. Якщо передано boolean, працює legacy ghost-slot path.

### placeDividerToSlot

```js
placeDividerToSlot(options, typeDivider)
```

Важливі поля `options`:

```js
{
  cabinetId,
  drawerType,
  zone,
  key,
  zoneIndex,
  placementType,
  availableTypes,
  canPlace,
  disabledReason,
  debugRequestId
}
```

Правила:

- `canPlace === false` одразу reject-иться.
- `zoneIndex` має пріоритет над `key`.
- `placementType` використовується як тип, під який був розрахований candidate.
- `typeDivider` - фактичний тип, який треба поставити.

### removeDividerFromSlot

```js
removeDividerFromSlot({
  cabinetId,
  drawerType,
  zone,
  key,
  zoneIndex,
  stateId,
  dividerType,
  debugRequestId
})
```

Remove resolution:

1. Якщо є `stateId`, шукаємо occupied slot по `stateId`.
2. Якщо є `zoneIndex`, шукаємо occupied slot по `zoneIndex`.
3. Fallback: occupied slot по `key`.

### Debug API

```js
setDebugLogging(enabled, { persist })
getDebugLogging()
getDebugEvents({ limit, level, stageIncludes })
clearDebugEvents()
setDebugMaxEvents(maxEvents)
getDebugSnapshot()
```

## Candidate layer

File: `core/DividerPlacementCandidateEngine.mjs`.

Candidate layer потрібен тому, що legacy ghost-сітка рахується від базового `A`. Для selected `C` це давало зайві плюси: сітка мала 3 `A`-позиції, але фізично в зоні влазить тільки 2 `C`.

Engine робить:

- бере `cabinetWidth`, `drawerType`, compact state, `selectedDividerType`;
- обчислює `innerWidth` і zones через `DividerCalculator`;
- відновлює occupied state через `SlotEngine.initFromCompactState`;
- для кожного empty slot симулює placement selected type через `SlotEngine.setDivider`;
- повертає occupied slots + selected-type candidates;
- для active candidate позиція береться з simulated result selected type, тому `C` має width `22.1`, а не `13.5`.

## Top siphon правила

Top drawer має виріз під сифон. Зліва і справа від вирізу є дві незалежні зони:

- `siphon_left` (`edges-left`) рахується від зовнішнього лівого краю до сифона.
- `siphon_right` (`edges-right`) рахується від зовнішнього правого краю до сифона.

Критично: leftover біля сифона не є реальною позицією для divider, навіть якщо legacy `A` grid там показує empty slot.

Приклад для selected `C`:

- якщо `zoneWidth = 47.51`;
- `C = 22.1`;
- максимум `floor(47.51 / 22.1) = 2` реальні `C` positions;
- третя `A`-позиція біля сифона має бути прихована.

Поточна логіка `_getTopSiphonCandidatePlan()`:

- застосовується тільки для `drawerType === "Top"` і `edges-left|edges-right`;
- сортує слоти від зовнішнього краю до сифона:
  - `edges-left`: `x` ascending;
  - `edges-right`: `x` descending;
- тримає `remainingWidth`;
- показує active candidate тільки доки selected type влазить;
- ховає leftover біля сифона з reason `top-siphon-leftover`;
- для stale/manual click додатково є guard у `DividerFacade`.

## Placement guards

File: `DividerFacade.mjs`.

`updateSlot()` має останню лінію захисту, бо UI/overlay може мати stale click або старий bundle.

Guards:

- `canPlace === false` reject у plugin/API.
- unknown divider type або недоступний type reject у `Facade.updateSlot`.
- `_getTopSiphonPlacementGuard()` reject-ить Top siphon stale candidate біля вирізу.
- `_getAlignedWidePlacementGuard()` reject-ить duplicate wide candidate для edge-aligned зон.
- `_hasReachedSiphonZoneCapacity()` reject-ить третій divider у siphon side zone.
- після mutation `Controller.getAllSlots()` може повернути `_conflicts`; тоді update reject-иться і store не оновлюється.

## SlotEngine

File: `core/SlotEngine.mjs`.

Відповідає за низькорівневу сітку:

- `initSlots(W, alignment)` створює базову сітку `N = floor(W / A)`.
- `initFromCompactState(W, occupiedSlots, alignment)` відновлює occupied dividers.
- `setDivider(state, i, newType, W)` симулює встановлення divider і зсув сусідів.
- `getVisibleSlots(state, W)` повертає тільки видимі slots.
- `getAvailableTypesForSlot(state, i, W)` рахує доступні `A/B/C`.

Важлива деталь: SlotEngine все ще базується на `A` grid. Candidate layer поверх нього фільтрує selected-type positions, особливо для Top siphon.

## UI integration

UI має однаковий flow для custom і prebuilt сторінок:

- обчислює `selectedDividerType` з `dividerStyle`;
- викликає `refreshDividerOverlay(cabinetId, drawerType, selectedDividerType)`;
- `refreshDividerOverlay` викликає wrapper `showIconDividerSlots(...)` з object options;
- при зміні `Option A/B/C` одразу перемальовує overlay;
- після add/remove знову викликає refresh з поточним selected type;
- якщо `canPlace === false` або selected type відсутній, UI показує warning і не викликає placement.

UI warning messages:

- без selected option: `Select a Divider option before placing it.`
- selected type не влазить: `Option C does not fit here. Choose one of: Option A, Option B.`

UI wrapper files:

- `showIconDividerSlots.ts`
- `placeDividerToSlot.ts`
- `removeDividerFromSlot.ts`
- `setOnAddSlotClick.ts`
- `setOnOccupiedSlotClick.ts`
- `dividerUiDebug.ts`

## Debug logging

Є два буфери:

1. UI buffer: `window.__HASTING_DIVIDER_UI_DEBUG__`
2. PlayCanvas buffer: `DividerDebugLogger`, доступний через `ConfiguratorAPI.dividers.getDebugEvents()`

У UI можна викликати:

```js
window.dumpDividerUiDebug()
```

Dump містить:

- UI events;
- `playCanvasSnapshot`;
- якщо `includeEvents` увімкнений у `dividerUiDebug.ts`, також PlayCanvas debug events.

Корисні PlayCanvas stages:

- `API.showIconDividerSlots`
- `Overlay.activateDrawer`
- `Overlay.renderSlots`
- `Overlay.createAddButton`
- `Overlay.createOccupiedButton`
- `Overlay.candidateSlotClick`
- `Overlay.occupiedSlotClick`
- `Facade.getPlacementCandidates`
- `CandidateEngine.buildCandidates`
- `CandidateEngine.candidate`
- `TopSiphonCandidates.zone`
- `API.placeDividerToSlot`
- `API.removeDividerFromSlot`
- `Facade.updateSlot`
- `SlotEngine.initSlots`
- `SlotEngine.initFromCompactState`
- `SlotEngine.setDivider`
- `Calculator.getAllPotentialSlots`

Для аналізу зайвих плюсів дивитись:

- `API.showIconDividerSlots.normalizedOptions.selectedDividerType`
- `CandidateEngine.buildCandidates.selectedType`
- `TopSiphonCandidates.zone.activeCandidateZoneIndexes`
- `TopSiphonCandidates.zone.hiddenCandidates`
- `Overlay.renderSlots.counts`
- `Overlay.renderSlots.duplicateSlotPositions`
- `Overlay.createAddButton.widgetId`

Для аналізу remove:

- `Overlay.occupiedSlotClick` payload;
- `API.removeDividerFromSlot` payload;
- `Facade.updateSlot` target resolution;
- `Removed divider from compact state`;
- `Composition store updated`;
- final `getDebugSnapshot()`.

## Manual QA checklist

Custom і prebuilt сторінки мають поводитися однаково.

1. `Customize`, але `Option A/B/C` не вибраний:
   - overlay може показати disabled `+`;
   - click показує warning `Select a Divider option before placing it.`;
   - `placeDividerToSlot` не викликається.

2. Select `C` у `Top` drawer з siphon:
   - `siphon_left` має показувати candidates від лівого краю до сифона;
   - `siphon_right` має показувати candidates від правого краю до сифона;
   - leftover біля сифона не має показувати активний `+`;
   - для 47.2"/120 cabinet side zone з `zoneWidth ~= 47.51` має бути максимум 2 active `C` candidates на сторону.

3. Switch `A -> C -> B`:
   - overlay positions перераховуються;
   - старі `+` не накладаються;
   - `Overlay.renderSlots.previousWidgetCount` і `widgetCount` мають відповідати новому render;
   - `duplicateSlotPositions` має бути empty або пояснюваний occupied/candidate overlap.

4. Add divider:
   - click active `+`;
   - UI log `AddSlot` має `selectedDividerType`, `zoneIndex`, `placementType`, `canPlace`;
   - PlayCanvas log `Facade.updateSlot` має `Added divider to compact state`;
   - snapshot показує occupied slot з правильним `value` і `zoneIndex`.

5. Remove divider:
   - click occupied check;
   - payload має `stateId` і `zoneIndex`;
   - PlayCanvas log має `Removed divider from compact state`;
   - snapshot більше не містить цей `stateId`.

6. `A + C` і `B + C` у Top siphon:
   - valid, якщо сумарно влазить від зовнішнього краю до сифона;
   - третя позиція біля сифона не має ставати active candidate.

7. Bot/TopFull `main`:
   - працює через `packed`;
   - candidate width відповідає selected type;
   - add/remove refresh зберігає поточний selected type.

## Automated checks

Syntax checks:

```sh
node --check Scripts/app-configuration/services/drawer-divider/core/DividerPlacementCandidateEngine.mjs
node --check Scripts/app-configuration/services/drawer-divider/DividerFacade.mjs
node --check Scripts/app-configuration/tests/suites/divider.test.mjs
```

Focused diff whitespace:

```sh
git diff --check -- Scripts/app-configuration/services/drawer-divider/core/DividerPlacementCandidateEngine.mjs Scripts/app-configuration/services/drawer-divider/DividerFacade.mjs Scripts/app-configuration/tests/suites/divider.test.mjs
```

Manual candidate sanity check:

```sh
node --input-type=module -e "import { DividerPlacementCandidateEngine } from './Scripts/app-configuration/services/drawer-divider/core/DividerPlacementCandidateEngine.mjs'; const e=new DividerPlacementCandidateEngine(); const top=e.getPlacementSlots(120,'Top',{zones:{}},'C','verify'); const li=top.zones.siphon_left.slots.filter(s=>s.other?.type==='candidate').map(s=>s.other.zoneIndex); const ri=top.zones.siphon_right.slots.filter(s=>s.other?.type==='candidate').map(s=>s.other.zoneIndex); console.log(JSON.stringify({left:li,right:ri}));"
```

Expected selected `C` for 120 Top:

```js
{ "left": [0, 1], "right": [1, 2] }
```

## Known constraints

- PlayCanvas local player may not be runnable locally; practical verification is: keep PlayCanvas changes, export bundle, connect it in UI, then test through UI.
- Candidate layer currently fixes selected-type placement for Top siphon without migrating persisted state.
- SlotEngine still uses `A` as base grid. Full architectural cleanup would require a separate dynamic grid model per selected type.
- `Bot` and `TopFull` still use `packed` rules; Top siphon edge-to-center rules are handled separately.
- Future divider types, for example `S`, should first be added to divider definitions. Candidate layer should then work with minimal changes if widths are defined.

## Common failure signatures

Extra pluses with selected `C`:

- Check `TopSiphonCandidates.zone.activeCandidateZoneIndexes`.
- If a cutout-side index appears active (`siphon_left` high index or `siphon_right` low index), candidate filtering is wrong.

Remove does not work:

- Check whether `Overlay.occupiedSlotClick` includes `stateId`.
- Check `API.removeDividerFromSlot.payload`.
- Check `Facade.updateSlot` target slot resolution.
- If target is resolved by stale `key` only, `stateId`/`zoneIndex` is missing in overlay payload.

Drawer reopens or view resets after add/remove:

- Check `DividerViewGuard.withSuspendedView`.
- Check whether refresh calls `activateDrawer` with active overlay options.
- Check drawer animation logs around `closeAllImmediate`, `showTopView`, `openDrawer`.

PlayCanvas renderer crash like `_aabbVer` null:

- Usually means scene render components were mutated while divider top view had isolated/disabled entities.
- Relevant code path: `DividerViewGuard.withSuspendedView`.

## Commit scope guidance

When committing divider fixes, keep PlayCanvas and UI changes separate when possible:

- PlayCanvas candidate/guard/logging/tests in the PlayCanvas repo.
- UI wrappers/pages/debug changes in the UI repo.

Avoid staging unrelated dirty files from product rules, other tests, or bridge plugins unless the change explicitly needs them.
