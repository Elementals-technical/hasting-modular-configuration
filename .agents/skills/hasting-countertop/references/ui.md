# Стільниця — UI (scope `ui`)

Читай разом із `contract.md`. 3D-деталі тут навмисно відсутні: факт про сцену → `contract.md` («Що 3D вирішує сам»); глибше → `playcanvas-*.md` (scope `both`).

## Сценарії
- **Баг у Position / Drag & Drop** → `useCountertopMovementMode.ts` (режим за товщиною, одна авто-корекція) → `countertopPlacement/*` (chip, stepper, ручки `CountertopResizeHandles`, `CountertopDragOverlay`) → `PlayCanvasIntegration.tsx` (єдиний `on('change')`, `syncCountertopConfig`) → runtime-сховища `countertopRuntimeState` / `countertopRuntimeSize`.
- **Мийка SB↔SC** → `useSinkLanding.ts` (`fits` → `moveSink`/`landSink` одразу; помилка → поза до drag → `resetOffset`; `STALE_COMPOSITION` ×1) → `hostedSinkLanding.ts` → `adoptCommittedCabinetComposition`.
- **Ціна / довжина** → `buildPricingLines.ts:486–495` (закомічена `size.length`, інакше `calcTotalCountertopWidthCm`), кавери з `cabinetCover.getState()` (poll 1 с), hosted sink з `getConfig`; `configurator-rule-core/countertop/{lengthLimits,parse}.ts`.
- **Збереження / пресет** → offset і довжина лише у `sceneLayout` (`captureFreeLayout.ts`, `composition.exportPreset`), лише D&D-колекції; `restoreSnapshot.ts` їх не переграє; compact preset: `CountertopColor`, `Thickness`, `sinkType`.
- **Нова колекція в UI** → `resolveCabinetDebugSelection.ts` (D&D дозволено лише ULH/UD), `ui.json` (`lengthLimitsIn` — ніде не задано, дефолт 23.6″–120″), `runtime-bindings.json` нотатки, `sku-profile`/pricing.
- **Перед комітом** → `npx vitest run src/features/countertopPlacement src/features/configuratorApi src/features/configurator-rule-core/countertop`; `tsc -b`. Зміна того, що шлеться/читається з 3D — scope `both`.

## Інваріанти UI
- Один підписник `on('change')`; стан у модульних сховищах, не в Redux; хуки в плеєрі читають через `useCountertopRuntimeValue(select)`.
- Cancel D&D = `setOffset(start, { validation:'skip' })`; заблокована (4″) CT при цьому опускається на y=0.
- Корекція режиму — одна спроба на порушення, не під час drag.
- `fits` комітиться без діалогу; одночасно один commit; застарілий landing не комітиться.
- UI дублює 3D: крок 0.1″ (`COUNTERTOP_RESIZE_STEP_M`), межі товщин, симетричну довжину ручки, length guard — міняти синхронно.

---

# Стільниця в UI-репо (UI-APP-config-react)

Гілка `package-3/fix`, HEAD `91257118` (Merge PR #465 `phase-2/production`). Шляхи відносно кореня репо. Read-only зріз 2026-10-20.

## 1. Карта файлів

Найгустіші теки (`rg -l -i countertop`): `src/entities/collection/__tests__` (22), `docs` (20), `src/features/configurator-rule-core/countertop` (13), `src/shared/lib/sku` (12), `src/features/countertopPlacement/lib` (12), `src/widgets/CountertopSections/lib` (10), `src/features/countertopPlacement/__tests__` (10), `src/features/countertopPlacement/ui` (9), `src/shared/lib/pricing` (8).

### Контракт / адаптер до 3D
- `src/features/configuratorApi/types.ts`: типи `CountertopState`, `CountertopApi`, `CountertopOverlayFrame/Api`, `CountertopErrorCode`, `CountertopReasonSlug`, `cabinets.moveSink/liftSink/landSink` (рядки 254–571).
- `src/features/configuratorApi/countertop.ts` (89 р.): єдине місце, де названо коди помилок і slug-и; `COUNTERTOP_RESIZE_STEP_M`, `isStandardCountertop`, `isLiftedCountertop`, `classifyCountertopError`.
- `src/features/configuratorApi/bridge.ts`: обгортки для `countertopOverlay.on/setActive/setPlaceholdersEnabled/setEditSizeButtonEnabled/previewLength/lengthAtPointer`, `countertop.setLengthLimits`, `countertop.resizeFrom`, `cabinetCover.getState` (рядки 51–69, 241–377).
- `src/features/configuratorApi/client.ts`: `moveSink`/`liftSink`/`landSink` (307/316/325), `resizeFrom` (566–567).
- `src/features/playCanvasAdapter/lib/countertopScene.ts`: `fitCountertop` (→ `setSceneProductConfig`, Width/Height/Depth) і `restoreCountertopConfigs` (→ `applySceneConfig({productType}, config)`).
- `src/widgets/Player/components/PlayCanvasIntegration/PlayCanvasIntegration.tsx` (4200 р.): `getCountertopApi` (598–609), єдиний підписник `countertop.on('change')` (644–692), `useCountertopMovementMode` (693), `useSinkLanding` (758–780), `syncCountertopConfig` (1087–1122), length guard (836–838), меню Position, монтування `CountertopDragMode` (`lengthLimitsIn` 3945).

### Контроли (`src/features/countertopPlacement/ui`)
- `CountertopDragMode.tsx` (525 р.): режим Drag & Drop: snapshot на вході, Apply/Cancel, Standard, черга resize, валідація.
- `CountertopDragOverlay.tsx` (261 р.): шар поверх кадру `countertopOverlay`: length/depth chips, ручки, Apply + ×, Size chip, червоний стан при `colliding`/invalid.
- `CountertopResizeHandles.tsx` (187 р.): ручки на кінцях (протилежний кінець фіксований), `lengthAtPointer` з rAF-тротлінгом, мітка snap, стрілки на клавіатурі.
- `CountertopDimensionPopover/CountertopDimensionPopover.tsx`: поле довжини, яке можна вписати, stepper, вирівнювання left/center/right.
- `CountertopEditSizeButton.tsx`: кнопка edit-size, яку малює host.
- `CountertopModeNotice.tsx`, `SinkLandingMessage.tsx`, `CountertopLayoutIntroModal.tsx`: повідомлення / інтро.
- `CountertopPlacementControls.tsx` (472 р.): старий метричний модал «Position & Size», лише з `?countertopSettings`.
- `src/widgets/Player/components/CountertopPopover/CountertopPopover.tsx`: контекстне меню вибраної стільниці.

### Логіка / стан (`src/features/countertopPlacement/lib`)
- `countertopSession.ts`: `CountertopSnapshot`, `restoreCountertopSnapshot` (Cancel), `describeCountertopError`, `describeCountertopValidation`.
- `useCountertopMovementMode.ts`: режим за товщиною → `setVerticalLocked` + автокорекція пози.
- `useSinkLanding.ts`: коміт `moveSink/liftSink/landSink` за подіями `action`.
- `hostedSinkLanding.ts`: коміт `landSink` після опускання через API (3D не шле `sink-landing`).
- `countertopLength.ts`: ліміти в дюймах ↔ метрах, `resizeBoundsLimitsM`, `lengthFromHandleDrag`.
- `handleDrag.ts`: сесія перетягування ручки.
- `positionMenuItems.tsx`: пункти «Position ▸ Standard | Drag & Drop», `isCountertopSettingsMode`.
- `cabinetCoverPublisher.ts`: читає сегменти каверів → `cabinetCoverRuntime`.
- `lockCountertopInteraction.ts`, `countertopOverlayStore.ts`, `countertopLayoutIntroStorage.ts`, `useLowerCountertopDefaultColor.ts`.

### Модульні сховища поза Redux (`src/shared`)
- `lib/countertopRuntimeState.ts`: живий `getState()`, публікує лише підписник у PlayCanvasIntegration; хук `hooks/useCountertopRuntimeState.ts` (`useCountertopRuntimeValue`).
- `lib/countertopRuntimeSize.ts`: закомічена довжина `{productId, compositionId, lengthCm}` для pricing; хук `hooks/useCountertopRuntimeSize.ts`.
- `lib/cabinetCoverRuntime.ts`: `{compositionId, covers[{widthCm, cabinetIds, materialId}]}`; хук `hooks/useCabinetCovers.ts`.
- `hooks/useHostedSink.ts`: `CountertopSinkType`/`VesselColor` хостованої мийки.

### Redux (селектори)
- `src/entities/product/model/store/selectors`: `getActiveCountertopColor`, `getCountertopColorSku`, `getCountertopStyle`, `getActiveCountertopThickness` (імпорт у PlayCanvasIntegration.tsx:35–38).
- `derivedSelectors.selectCountertopCabinetCompositionConstraint` (PlayCanvasIntegration.tsx:58).
- Offset, довжина й валідація в Redux не зберігаються: вони живуть у модульних сховищах вище.

### Правила UI (`src/features/configurator-rule-core/countertop`)
`lengthLimits.ts` (reason-коди `countertop.compositionLengthReached*`, `sidePanelsExceedMaxLength`, 14–16), `rules.ts` (93–99), `materialAvailability.ts`, `prebuiltModelCompatibility.ts`, `sizeFilters.ts`, `basinSelection.ts`, `vesselCompatibility.ts`, `compositionConstraints.ts`, `syntesiOptions.ts`, `parse.ts` (`parseThicknessValue`), `hooks/` (`useCountertopLengthGuard`, `useCountertopRules`, `useDefaultCountertopThickness`).

### Pricing / SKU
`src/shared/lib/pricing/{buildPricingLines,buildCollectionPricingLines,ushCountertopLines,ushVesselLines,priceRequests,summaryLinePrice,buildColorSkuMaps,types}.ts`; `src/shared/lib/sku/{buildCountertopSku,countertopSkuMaps,countertopColorResolution,buildCabinetCoverSku,buildVesselSku,vesselSkuMaps,resolveDefaultBasinByCountertopColor,skuProfile}.ts`; `src/entities/countertop/lib/{calcCountertopWidth,countertopPricingSku,thicknessOptions,sortCountertopOptions,fallbackTextures}.ts`; `src/entities/countertop/api/*` (запити цін); `src/shared/hooks/{usePricingInput,usePriceCalculation}.ts`.

### Сторінки / віджети кольору й басейну
`src/widgets/CountertopSections/{ui,lib}` (колір, рівень кольору, басейн, vessel color, колір кавера, скидання), `src/pages/countertop/CountertopPage.tsx`, Summary-сторінки (`src/pages/custom/summary/index.tsx`, `src/pages/prebuilt/summary/SummaryPage.tsx`).

### Маніфести
- `src/entities/collection/model/customizationSchema.ts:221–229`: `countertop.lengthLimitsIn`, `countertop.lengthPresetsIn`; валідація в `src/entities/collection/lib/customization/validateCustomizationSchema.ts:388–416`.
- `public/collections/<col>/runtime-bindings.json`: прив'язки `CountertopColor`, `Thickness`, `sinkType`, `CountertopStyle`, `CountertopColorSku` (див. §6).
- Жоден `public/collections/*/ui.json` не має `lengthLimitsIn` чи `lengthPresetsIn` (rg порожній), тож скрізь діють дефолти.

## 2. Контракт з 3D

### Доступ
- Пряма ручка: `containerRef.current.contentWindow.ConfiguratorAPI.countertop`. Об'єкт приймається, лише якщо є всі `getState, setDragEnabled, setSize, setOffset, resetOffset, whenSettled, on` (PlayCanvasIntegration.tsx:598–609).
- Overlay, ліміти, `resizeFrom`, кавери йдуть через `createConfiguratorBridge()` з feature-detect (bridge.ts:241–377).

### `CountertopApi` (types.ts:453–468)
| Метод | Аргументи | Де викликає UI |
|---|---|---|
| `getState()` | sync або Promise | скрізь; `Promise.resolve(api.getState())` |
| `setDragEnabled(bool)` | | CountertopDragMode.tsx:214/266/282/316/351; countertopSession.ts:71/97; CountertopPlacementControls.tsx:227/250/265/284 |
| `setOffset({x,y}, {validation?: 'guard'\|'skip'})` | `guard` за замовчуванням: невалідна поза відкочується з `COUNTERTOP_POSE_INVALID` (types.ts:452) | Cancel з `skip` (countertopSession.ts:81/86); автокорекція (useCountertopMovementMode.ts:71); відкат мийки (useSinkLanding.ts:93) |
| `resetOffset()` | «Back to Standard (drops the custom length); not validated» (types.ts:457–458) | CountertopDragMode.tsx:352; countertopSession.ts:78; useCountertopMovementMode.ts:82; useSinkLanding.ts:101 |
| `setSize({length\|null})` | лише зсунута стільниця (types.ts:459–460) | Cancel (countertopSession.ts:93); fallback resize (CountertopDragMode.tsx:430); модал (CountertopPlacementControls.tsx:254/300/413) |
| `resizeFrom?(side, lengthM, opts)` | один кінець, обмежено `resizeBoundsM[side]` (types.ts:461–462) | CountertopDragMode.tsx:420 → `bridge.resizeCountertopFrom` (bridge.ts:329–341) → `setSize`, лише для нестандартної |
| `setVerticalLocked?(bool)` | newer builds (types.ts:463–464) | useCountertopMovementMode.ts:138–143 |
| `whenSettled()` | | CountertopDragMode.tsx:243/353; CountertopPlacementControls.tsx:236 |
| `on('change'\|'action', cb, {emitCurrent})` → unsubscribe | (types.ts:466–467) | PlayCanvasIntegration.tsx:665; useSinkLanding.ts:209 |

На `ConfiguratorApi.countertop` (types.ts:568–572) лежать `setLengthLimits?(CountertopLengthLimitsM|null)` і `resizeFrom?`. UI шле `setLengthLimits(limitsInToMetres(lengthLimitsIn))` при вході в D&D (CountertopDragMode.tsx:267).

`countertopOverlay` (types.ts:333–352): `setActive`, `getState`, `on('change')`, `setPlaceholdersEnabled`, `setEditSizeButtonEnabled?`, `previewLength?({side,lengthM}|null)`, `lengthAtPointer?(side, point, {snap})` → `{lengthM, rawLengthM, snappedTo, limits}`. Виклики: CountertopDragMode.tsx:164–196/269–276/389/438/447; handleDrag.ts:93–95.

У UI немає жодного виклику `isDragEnabled`, `off`, `setLengthM`: rg порожній. Відписка лише через функцію, яку повертає `on()`.

### Що UI читає з `getState()` (`CountertopState`, types.ts:398–432)
`readiness`, `productId`, `compositionId`, `placementState`, `attached`, `moved`, `canResize`, `offset{x,y}`, `customLength`, `autoLength`, `size.length/depth`, `thickness`, `dragEnabled`, `dragging`, `moving`, `lengthLimitsM{minLengthM,maxLengthM,requested*,basinMinLengthM}`, `resizeBoundsM{left,right}` (`anchorXM`, `min/maxLengthM`, `basinMinLengthM`, `supportMinLengthM`), `validation{status,reasons,warnings}`, `sink{owner,shiftM,landing,pending,hosted?}`, `verticalLocked`, `verticalLockViolated`.

Хто що використовує:
- `isStandardCountertop`: `customLength===null`, `|offset| < 1e-5` (countertop.ts:30–34).
- `isLiftedCountertop`: `offset.y > 0.01` (countertop.ts:39–40).
- Snapshot для Cancel: productId, compositionId, offset, attached, customLength, dragEnabled (countertopSession.ts:14–39).
- Ліміти ручок: `resizeBoundsM[side]`, потім `frame.limits`, потім `lengthLimitsIn` колекції (CountertopDragMode.tsx:366–373).
- Pricing: `size.length * 100` → `lengthCm` (PlayCanvasIntegration.tsx:626–642).
- `frame.preview` описано в types.ts:294–295. Як UI читає `frame.preview`, не перевірено.

### Події
- `change`: payload `{reason?, type?, state}` (types.ts:447). Reasons: `current, selection, reset, layout, restored, offset, length, length-settled, length-limits, validation, vertical-lock, sink-landing` (types.ts:433–446).
- Єдиний підписник бере лише `state`: `api.on("change", ({ state }) => update(state), { emitCurrent: true })` (PlayCanvasIntegration.tsx:665). `reason` не розгалужується.
- `update` пише `setCountertopRuntimeState(state)` завжди. `publishCountertopSize` (pricing) викликається лише поза редагуванням або при `readiness !== 'ready'` (PlayCanvasIntegration.tsx:653–664).
- Кавери опитуються `setInterval` кожні 1000 мс, бо в `cabinetCover` немає change-події (668–676).
- `action` (types.ts:448–451):
  - `edit-size`: UI вимикає 3D-кнопку через `setEditSizeButtonEnabled(false)` (CountertopDragMode.tsx:173) і малює свою (`CountertopEditSizeButton.tsx`).
  - `sink-landing {landing}`: обробляється лише при `status: 'fits'`.
  - `sink-lift {fromCabinetId, sinkLocalM}`.
  - Обробник: useSinkLanding.ts:205–224.

### Коди помилок
- UI `CountertopErrorCode` (types.ts:470–477): `COUNTERTOP_POSE_INVALID`, `COUNTERTOP_VERTICAL_LOCKED`, `COUNTERTOP_ATTACHED`, `COUNTERTOP_INVALID_INPUT`, `COUNTERTOP_NOT_READY`, `COUNTERTOP_DESTROYED`, `LEGACY_WRITERS_BUSY`.
- Класифікація (countertop.ts:64–72):

  | Код | kind |
  |---|---|
  | `POSE_INVALID` | `pose-invalid` |
  | `VERTICAL_LOCKED` | `vertical-locked` |
  | `NOT_READY`, `DESTROYED` | `not-ready` |
  | `ATTACHED` | `attached` |
  | `INVALID_INPUT` | `invalid-input` |
  | `LEGACY_WRITERS_BUSY` | `busy` |

  Інші коди, що збігаються з `/BUSY$|TEARDOWN/` (`COMPOSITION_BUSY`, teardown під час імпорту пресета), теж стають `busy` (countertop.ts:83–84).
- `CountertopReasonSlug` (types.ts:478–487 і `COUNTERTOP_REASON_SLUGS`, countertop.ts:18–27): `TRAP_KEEPOUT`, `BASIN_EDGE_TOO_CLOSE`, `SINK_BASE_NOT_COVERED`, `SINK_LANDING_GAP`, `SINK_LANDING_UNFIT`, `COUNTERTOP_COLLISION`, `COUNTERTOP_VERTICAL_LOCKED`, `COUNTERTOP_BELOW_COVER`.
- Тексти помилок (countertopSession.ts:101–147):
  - `pose-invalid`: по рядку на slug, fallback «This countertop position is not allowed.»
  - `not-ready`: «The countertop is not ready yet.»
  - `busy`: «The scene is busy. Try again in a moment.»
  - `invalid-input` / `attached`: `console.error` + «The countertop could not be changed.»
- Копії 3D-списку `COUNTERTOP_ERROR_CODE` в UI-репо немає. UI-список лише заявлено як «the only place that names the runtime's error codes» (countertop.ts:4–5).

### Відомі дрейфи (з коду)
- `LEGACY_WRITERS_BUSY` присутній в UI (types.ts:477; countertop.ts:71). Чи є він у 3D `COUNTERTOP_ERROR_CODE`, з UI не видно.
- `COUNTERTOP_RESIZE_STEP_M = 0.0254/10` продубльовано з runtime `domain/countertop/countertop-resize-snap.mjs`, бо `ConfiguratorAPI` його не віддає (countertop.ts:8–13).
- `COUNTERTOP_STANDARD_EPSILON_M = 1e-5`: runtime дає дрейф ±2e-6 м після першого one-end resize (countertop.ts:15–16).
- Тип `CountertopApi` не містить `setLengthLimits`, `previewLength`, `lengthAtPointer`: вони рознесені по `ConfiguratorApi.countertop` / `countertopOverlay` і проходять через bridge.

### `cabinets.moveSink/liftSink/landSink` (types.ts:488–511; client.ts:307–325)
- Аргументи:
  - `moveSink({fromCabinetId, toCabinetId})` → `{idMap, sinkHostId}`.
  - `liftSink({fromCabinetId, sinkLocalM{x,y,z}})` → `{idMap, sideCabinetId}`.
  - `landSink({toCabinetId})` → `{idMap, sinkHostId}`.
  - Усі з `ConfiguratorCommandMetadata` (`requestId`, `expectedCompositionRevision`).
- Після коміту: `getCabinetsState()`, далі `onCommitted` з `selectedCabinetId = sinkHostId` (useSinkLanding.ts:145–148).
- У PlayCanvasIntegration (762–779): `deferredSnapshot.commit("countertop")`, перенесення власних значень кабінетів за `idMap` (`selectOwnCabinetValues`), `adoptCommittedCabinetComposition`, закриття D&D-сесії через `countertopDragRef.current?.apply()`.

## 3. Режими в UI

- **Колекції з D&D**: лише `urban-low-height` і `urban-duplex` (`DRAG_DROP_COLLECTION_IDS`, src/features/cabinetPlacementDebug/lib/resolveCabinetDebugSelection.ts:5). Решта колекцій лишаються на класичному меню (PlayCanvasIntegration.tsx:527–528). Коли D&D вимикається, статуси D&D скидаються (550–557).
- **Меню Position** (positionMenuItems.tsx:9–36): «Position ▸ Standard | Drag & Drop», показується лише при `status.supported && mode !== 'none'`. Standard вимкнено при `!available && !active`, Drag & Drop при `!available || active`.
- **Standard у D&D** (CountertopDragMode.tsx:345–360): snapshot (сесійний або новий), `setDragEnabled(false)`, `resetOffset()`, `whenSettled()`, `onCommitted`.
- **Drag & Drop** (CountertopDragMode.tsx:255–290):
  - вхід: `captureCountertopSnapshot`, `setDragEnabled(true)`, `setLengthLimits`, підписка на overlay, `setCountertopOverlayActive(true)`, `setPlaceholdersEnabled(false)`;
  - Apply (≈316–320): `setDragEnabled(false)`, settle, `onCommitted` → `commitCountertopEdit` → `deferredSnapshot.commit` + `syncCommittedCountertop` (PlayCanvasIntegration.tsx:1064–1084);
  - Cancel: `restoreCountertopSnapshot` (countertopSession.ts:66–99) — `setOffset(..., {validation:'skip'})`; на `vertical-locked` повтор з `y=0`; точна перевірка offset і `customLength`, інакше throw.
- **Кнопка Apply** вимкнена при `pending || !frame.canApply || frame.dragging || invalid` (CountertopDragOverlay.tsx:218). Червоний стан: `frame.status==='colliding'` або `validation` invalid (94). Причина: `frame.reasons[0].message` (104).
- **Live-валідація**: `describeCountertopValidation`. `invalid` показується червоним `role="alert"`, warnings (`COUNTERTOP_COLLISION`) бурштиновою підказкою без блокування, `unknown` не показується (countertopSession.ts:155–170; CountertopDragMode.tsx:135, 513–519).
- **Старі білди без `countertopOverlay`**: Apply/Cancel стають «пігулками» в правому верхньому куті (CountertopDragMode.tsx:99–102, 497–505).
- **Режим за товщиною** (`resolveMovementMode`, useCountertopMovementMode.ts:20–53). Джерело товщини: Redux `Thickness`, інакше runtime `state.thickness` (м); допуск 0.25″.
  - `< 1″` → `none`;
  - `≈4″` → `offset`;
  - `≈2.4 / 5.125 / 5.5″` → `free`;
  - інакше `null`.
- **Наслідки режиму**:
  - `offset` → `setVerticalLocked(true)`, `free` → `false` (129–153). Перехідні помилки (`not-ready`/`busy`) повторюються, інші блокують ключ із `console.warn`.
  - Автокорекція (155–181), одна спроба на порушення і ніколи посеред drag:
    - `offset` + піднята → `setOffset({x, y:0})`;
    - якщо після цього `sink.pending` = `fits`, то `commitHostedSinkLanding`, інакше `resetOffset`;
    - `none` + нестандартна → `resetOffset`.
  - Повідомлення з кодами `countertop.mode.none|offset|free|lowered|reset` (28–32, 171), лише при перемиканні на тій самій стільниці (120–126).
- **Sink landing без confirm-модалки**: кожна `sink-landing` зі статусом `fits` одразу комітить `moveSink` (SB→SC) або `landSink` (hosted, `fromCabinetId: null`) (useSinkLanding.ts:44–50, 215–222). `sink-lift` → `liftSink` (210–213).
  - Помилка коміту: «The sink could not be moved.» і відкат до пози на початку drag (`setOffset(before)`, інакше `resetOffset`) (88–106, 141–142).
  - `STALE_COMPOSITION`: один повтор (133–135).
  - Немає `liftSink`: одне попередження, пропуск (138).
  - Одночасно один коміт; landing, що прийшов під час коміту, дає `resetOffset` (161–185).
  - `ready` потребує D&D-колекції та `countertopDragStatus.supported` (PlayCanvasIntegration.tsx:760).
- **Опускання хостованої мийки через API**: 3D шле `sink-landing` лише на drag-end, тому після Standard / reset / Cancel / setOffset UI сам читає `sink.pending` і запускає `landSink` (hostedSinkLanding.ts:14–25; використано в useCountertopMovementMode.ts:76 і CountertopPlacementControls.tsx:5).
- **Блокування**: під час редагування `lockCountertopInteraction(placementHostRef)` (PlayCanvasIntegration.tsx:568–572). Undo/redo чекають, поки `isSceneEditOpen` (559–560).
- **Тестовий модал**: `?countertopSettings` вмикає метричний «Position & Size» (positionMenuItems.tsx:38–39; PlayCanvasIntegration.tsx:539–540).
- **Інструменти налагодження**: `?placementDebug` (529–530).
- **Popover довжини в оверлеї**: «No scene command takes a typed length with an alignment, or a depth, yet: a popover's Apply only closes it, nothing is sent» (CountertopDragOverlay.tsx:85–87).
- **Кроки**: stepper у popover 1″ (`STEP_IN = 1`, CountertopDimensionPopover.tsx:33). Ручки зі стрілками: 0.1″, Shift 1″ (CountertopResizeHandles.tsx:65–67). Ліміти за замовчуванням 60/2.54 ≈ 23.6″ … 120″ (countertopLength.ts:9–12).

## 4. Pricing / SKU

- **Довжина для ціни** (buildPricingLines.ts:486–495): закомічена runtime-довжина `committedCountertopLengthCm` (з `countertopRuntimeSize`, usePricingInput.ts:65/139), інакше `calcTotalCountertopWidthCm(sum(cabinet widths), sidePanelLeft, sidePanelRight)`.
- **`calcTotalCountertopWidthCm`**: сума кабінетів + `SIDE_PANEL_WIDTH_CM` × кількість активних боків (лише `"active"`) (calcCountertopWidth.ts:4–27). JSDoc каже «+1 cm offset for each active side panel» (8–9); значення константи не перевірено.
- **Ширина в Summary**: `countertopTopLine?.widthCm ?? calcTotalCountertopWidthCm(...)` (src/pages/custom/summary/index.tsx:1092; src/pages/prebuilt/summary/SummaryPage.tsx:1087).
- **Інші споживачі тієї ж формули**: `countertopCompatibility.ts:123`, `useSceneTotalWidthWithSidePanels.ts:15`.
- **Ціна за довжиною**: рядки груп `countertop` і `cabinetCover` з `widthCm` йдуть у `triggerCountertopTopPriceBySku({sku, widthCm})` (usePriceCalculation.ts:78, 86–87, 149).
- **USH-рядки** (ushCountertopLines.ts):
  - товщина = `countertopThickness || sceneConfigs[0].Thickness || defaultThickness` (104);
  - `isVessel` за style (162);
  - `widthCm` лише на рядку 0 (185);
  - другий рядок — integrated basin SKU, якщо не vessel (167).
- **Кавери (ULH)**: `bridge.getCabinetCovers()` → `cabinetCover.getState()` сегменти (bridge.ts:370–377) → `cabinetCoverPublisher` (widthM→widthCm, cabinetIds, materialId; cabinetCoverPublisher.ts:31–41) → `cabinetCoverRuntime` → `useCabinetCovers` → `buildCollectionPricingLines.ts:481–545`:
  - SKU з `buildCabinetCoverSku({prefix, style, widthCm, depthCm(номінальна глибина кабінетів під ним), thicknessIn, materialSku, colorCode})`;
  - для UD колір кавера пишеться як у стільниці (`pricedAs`);
  - без `skuProfile.cabinetCover.prefix/thicknessIn` з'являється gap `UNCONFIRMED_CABINET_COVER_SKU`, який блокує total (483–485).
- **`uncovered`**: у `src` не трапляється (rg порожній). UI читає лише сегменти каверів.
- **Hosted sink**:
  - `useHostedSink` при `sink.hosted` читає `getConfig(productId)` → `{sinkType: CountertopSinkType, vesselColor: VesselColor}` (useHostedSink.ts:12–37);
  - `buildPricingLines.ts:72–73` віддає перевагу hosted над глобальними значеннями;
  - `buildCollectionPricingLines.ts:344–379`: якщо sink bases немає, то basinCount = 1 і sink base `{id:"hosted"}`.
- **Колір / матеріал**: селектори `getActiveCountertopColor` / `getCountertopColorSku` (PlayCanvasIntegration.tsx:821–824). Матеріальні токени з груп API `countertop` (1168–1236), SKU-мапи в `src/shared/lib/sku/countertopSkuMaps.ts`, `countertopColorResolution.ts`.

## 5. Пресети / збереження / undo-redo

- **Save payload** (src/features/saveConfiguration/lib/selectSavePayload.ts:35–43): `sinkType`, `CountertopColor`, `CountertopColorSku`, `CountertopStyle` (+ інші опції). Метадані: `buildConfigurationMetadata.ts:27–35, 72–90` (`sceneLayout?`).
- **Offset і довжина** зберігаються лише як `sceneLayout`:
  - `captureFreeLayout` лише для D&D-колекцій (captureFreeLayout.ts:11), через `composition.exportPreset` (sceneLayout.ts:118);
  - документ охоплює «the countertop's position and length, and what the top carries» (sceneLayout.ts:8–10);
  - відновлення: `buildRestorePlan.ts:119–120` → `restoreSavedConfiguration.ts:97`.
- **Undo/redo**:
  - `deferredSnapshot.capture("countertop")` на старті, `discard` при «нічого не змінилось», `commit` на Apply і на коміт мийки (PlayCanvasIntegration.tsx:470–481, 764, 1081);
  - `restoreSnapshot` повторно шле лише опції `CabinetColor, CountertopColor, HandleGrooveColor, sinkType, CountertopStyle, GrainDirection, DrawerPanelFluting, Thickness, TowelBarColor, VesselColor…` (restoreSnapshot.ts:51–62); offset і customLength серед них немає;
  - після history-restore запускається `syncCountertopConfig` (PlayCanvasIntegration.tsx:1953).
- **Відновлення конфігів `Top_*`** у CabinetBuilder: `restoreCountertopConfigs` (CabinetBuilderPage.tsx:1449–1462).
- **Compact preset**:
  - `COUNTERTOP_KEYS = ["CountertopColor","Thickness","sinkType"]` (columnsCompactPreset.ts:103);
  - для UD `countertopProductType: "Top_Solid"` (32);
  - top = `{productType, ...countertopOf(...)}` (232–233);
  - `applyCompactPreset.ts:41` (shared: `CabinetColor`, `HandleGrooveColor`, `CountertopColor`), 98 (стільниця сама записує колір і басейн; приклад з `top {CountertopColor, sinkType}` у 72–78).
  - Полів offset чи довжини в compact preset немає.
  - Зміна пресета, коментар хука (useCountertopMovementMode.ts:120, 158): інша стільниця, композиція чи пресет — це не «перемикання», повідомлення немає; поза, відновлена пресетом, отримує нову спробу автокорекції.
- **`syncCountertopConfig`** (PlayCanvasIntegration.tsx:1087–1122): `fitCountertop(id, {Width,Height,Depth})` з різницею ≥ 0.01. Тригери: 1785, 1899 (кількість кабінетів, глибина, висота), 1953 (history), 1960 (side panels).

## 6. Розбіжності / stale

### Нотатки про стільницю в `runtime-bindings.json`
- **USH**:
  - :167 — Syntesi використовує сценні матеріали Tekorlux (TAL/TAM, а не TAN/TAP);
  - :180 — `Thickness` шлеться рядком (ключ `thicknessOffsets.countertop[thickness]`), але «PlayCanvasIntegration.tsx:3066 sends a number» (8 з 9 викликів шлють рядок);
  - :195 — басейн шлеться на кожен Sink-Base, `"Vessel"` — сценний плейсхолдер;
  - :209 — `""` очищає колір (CountertopPage.tsx).
- **ULH**:
  - :109 — стільниця на рівні композиції (глобальний `RuleChangeCountertopColor`), кабінети ULH ігнорують ключ; у Sahara Noir Silky Matte немає TR8 у назві;
  - :122 — `Thickness` читають і стільниця, і кріплення басейну Sink Base;
  - :137 — басейни USH, ULH-sink-cabinet міняє sub-product за `sinkType`;
  - :156 — `CountertopStyle` у сценному експорті відсутній.
- **UF**:
  - :114 — composition-level;
  - :127 — пропонується лише 0.5, UF-sink-cabinet не має basin offsets за товщиною;
  - :142 — немає `RuleChangeSinkType` (зміна sinkType після розміщення не міняє басейн; текст обрізано);
  - :203 — `CountertopStyle` не в сцені.
- **UD**: :204 composition-level + override-и USH; :217 товщину читає стільниця; :232 басейни та vessels USH, ULH-sink-cabinet, «scene v62…» (обрізано); :251 `CountertopStyle` не в сцені.
- **Tricot**: :413 як Class/Mako, composition-level; :426 «Export v44 gives Tricot-sink-cabinet no RuleSinkMountPosition, so the basin mount does not follow a thick top yet»; :491 style = басейн sink base.

### Документи vs код
- `docs/countertop-position-ui.md:66–69` описує пресети `▾` (`countertop.lengthPresetsIn` або дефолт `23.6, 48, 60, 72, 84, 96, 120`) і пігулку `Set …″`. У `src/features/countertopPlacement` (без тестів) немає жодного «preset»: `lengthPresetsIn` лише оголошено (customizationSchema.ts:223–229) і провалідовано (validateCustomizationSchema.ts:405–416). Споживача в контролах не знайдено. Popover в оверлеї не надсилає довжину (CountertopDragOverlay.tsx:85–87).
- `docs/countertop-position-ui.md` (Standard): «The custom length is kept». Коментар типу `resetOffset` каже «Back to Standard (drops the custom length)» (types.ts:457). `isStandardCountertop` вимагає `customLength === null` (countertop.ts:30–34).
- Дати й індекс:
  - `docs/countertop-position-ui.md` (83 р., останній коміт 2026-10-16 «feat: add CountertopDimensionPopover…») — актуальний опис D&D;
  - `docs/countertop-placement-ui.md` (54 р., 2026-09-29) описує модал, у `docs/INDEX.md:58–60` позначений як «Test-mode countertop editor»;
  - `docs/INDEX.md:20` посилається на position-ui.

### Дублювання 3D-логіки в UI
- `COUNTERTOP_RESIZE_STEP_M` (countertop.ts:13).
- Межі товщин режимів руху (useCountertopMovementMode.ts:20–26).
- Ліміти довжини за замовчуванням (countertopLength.ts:9–12).
- Симетричний розрахунок довжини при перетягуванні ручки (`lengthFromHandleDrag`, countertopLength.ts:81–98).
- `calcTotalCountertopWidthCm` (ширина з side panels) як fallback для pricing і Summary, коли runtime-довжини немає.
- Length guard / `maxCountertopLength` фільтрує ширини кабінетів (PlayCanvasIntegration.tsx:836–838, 1253–1325).
- Reason-коди `countertop.*` у configurator-rule-core (lengthLimits.ts:14–16, rules.ts:93–99).

## 7. Тести і запуск

- **`package.json` scripts**: `dev` (vite), `tsc` (`tsc -b`), `build` (`tsc -b && vite build`), `lint` (`eslint .`), `start`/`preview` (vite preview), `test` (`vitest run`).
- **Тести стільниці** (кількість `it/test`):

  | Група | Файли (кількість) |
  |---|---|
  | `src/features/countertopPlacement/__tests__/` | `CountertopDragMode.test.tsx` (37), `CountertopDragOverlay.test.tsx` (12), `CountertopPlacementControls.test.tsx` (15), `CountertopResizeHandles.test.tsx` (13), `cabinetCoverPublisher.test.ts` (5), `countertopSession.test.ts` (5), `lockCountertopInteraction.test.ts` (1), `useCountertopMovementMode.test.tsx` (9), `useLowerCountertopDefaultColor.test.tsx` (4), `useSinkLanding.test.ts` (7) |
  | `src/features/countertopPlacement/ui/CountertopDimensionPopover/__tests__/` | `CountertopDimensionPopover.test.tsx` (10), `dimensionPopoverPlacement.test.ts` (4) |
  | `src/features/configuratorApi/__tests__/` | `countertopContract.test.ts` (6), `countertopBridge.test.ts` (4), `cabinetCover.test.ts` (8), `client.test.ts` (22), `bridge.test.ts` (5) |
  | `src/features/configurator-rule-core/countertop/__tests__/` | `lengthLimits` (6), `countertopProductRules` (10), `countertopFallbacksVs438` (5), `materialAliases` (6), `findCountertopSkuByColorName` (2), `prebuiltModelCompatibility` (1) |
  | Pricing / SKU | `src/shared/lib/pricing/__tests__/` (`buildPricingLines` 8, `tricotCountertopPricing` 3, `priceRequests` 7, `summaryLinePrice` 3, `regressionPrices`, `regressionLines`, `collectionPricing`, `recordPriceFixtures`; фікстури `fixtures/pricingScenarios.ts`, `fixtures/collectionPricingScenarios.ts`, `fixtures/prices/README.md`); `src/shared/lib/sku/__tests__/` (`buildCountertopSku` 10, `buildCabinetCoverSku` 2, `tricotCountertopSkus` 5 та ін.) |
  | Entity / сторінки | `src/entities/countertop/**/__tests__/` (`calcCountertopWidth` 1, `countertopPricingSku` 2, `countertopApi` 4); `src/shared/lib/__tests__/countertopRuntimeSize.test.ts` (2); `src/shared/hooks/__tests__/useCabinetCovers.test.tsx` (1); `src/pages/prebuilt/model/__tests__/ModelPage.countertopState.test.tsx` (7); `src/widgets/CountertopSections/__tests__/*` (3 файли); `src/entities/history/__tests__/useDeferredHistorySnapshot.test.tsx` (10) |

- **Що фіксує `countertopContract.test.ts`**: `pose-invalid` з рядковими reasons (:8), `COUNTERTOP_DESTROYED` → `not-ready` (:27), невідомий код → `unknown` (:31), standard у межах дрейфу ±2e-6 (:36), UI-текст для кожного slug (:41).
- **Фікстури колекцій**: `src/entities/collection/__tests__/fixtures/collections/fixture-rules/{product-profile,countertop-table,runtime-bindings}.json`, `fixture-ui/{product-profile,manifest,static-options,runtime-bindings}.json`, `fixtures/remote/configurator-*.json`, `datatable-589/593.json`.

## Не перевірено / суперечності

- 3D-список `COUNTERTOP_ERROR_CODE`: копії в UI-репо немає, тож чи є там `LEGACY_WRITERS_BUSY`, з UI не підтвердити.
- Звідки береться `customizationSchema.countertop` (файл маніфесту): у `public/collections/*/ui.json` ключів `lengthLimitsIn`/`lengthPresetsIn` немає; інші джерела не перевірялись.
- Чи взагалі UI читає `frame.preview` і `lengthLimitsM.basinMinLengthM` (поза `resizeBoundsM`) — не перевірено.
- Обробку `action: 'edit-size'` (де саме відкривається popover розміру) не простежено.
- Значення `SIDE_PANEL_WIDTH_CM` не перевірено (JSDoc каже +1 см на бік).
- Рядки PlayCanvasIntegration.tsx 1785/1899/1953/1960 (тригери `syncCountertopConfig`) взято з rg без читання контексту.
- Суперечність «Standard зберігає custom length» (docs) vs «drops the custom length» (types.ts:457).
- Суперечність «presets ▾ / Set …″» (docs:66–69) vs відсутність споживача `lengthPresetsIn` у контролах.
- Нотатки runtime-bindings UF:142 і UD:232 обрізані при виводі (cut -c260).
- Рядки 3D-боку (PlayCanvas `docs/countertop/ui-integration-phase1.md`) лише згадані в коментарях types.ts:358 / useSinkLanding.ts:45; сам документ не відкривався.
