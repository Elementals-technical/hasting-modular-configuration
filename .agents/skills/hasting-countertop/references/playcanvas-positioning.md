# Стільниця — позиціонування, режими, довжина, мийка в русі (scope `playcanvas` › `positioning`)

Читай разом із `contract.md` і `rules-and-decisions.md` (режими клієнта ↔ код). Коли сюди: offset/standard/remote, `SpatialOffsetM`/`CountertopLengthM`/`CountertopSinkShiftM`, ресайз з торця, restore/rebase, `_anchorRemoteOffset`, `_placeSinks`/landing/snapDx, vertical lock. Чому поза червона → `playcanvas-validation.md`; як працює сам жест → `playcanvas-dnd.md`.

## Сценарії
- **CT після relayout «стрибає» або змінює довжину** → remote у модульній композиції: `_anchorRemoteOffset`, `CountertopLengthM` фіксується при detach; `rebase` накладає offset на нову базу.
- **Мийка їде окремо від CT / повертається в SB не тоді** → `_placeSinks` (lift > 1 см, `shift = −offset.x`), `_sinkLanding` (home/fits/gap/unfit, `snapDxM`), `_snapLanding`/`_snapHome`; hosted sink — owner завжди countertop.
- **Ресайз зсуває не той торець / CT «прилипла» до standard** → `resizeFromM`: центр ±Δ/2, 2e-6 від standard; clamp `resizeBoundsM[side]`; снап/крок робить `snapCountertopLengthM` в overlay, не адаптер.
- **CT мерехтить / «закріплений» торець стрибає, коли відпускаєш ручку** → `resizeFromM` пише позу (центр ±Δ/2) одразу, тож меш має перебудуватись у тому ж кадрі: `_syncLength(…, { immediate: true })`. Зі звичайним розкладом MeshBoolean (120 мс + 2 кадри) старий меш рендериться на новому центрі (виправлено 23.10.2026).
- **`resetOffset` не повертає в Standard** → відомий кейс carried shift ≠ 0 → x = −shift.
- **Режим не той (offset/free/none)** → це UI за товщиною (`contract.md`); у 3D лише `verticalLocked`.

## Інваріанти
- `SpatialOffsetM` — зсув від стандартної пози, метри, world XY; drag ніколи не пише стандартну позу.
- Resting: |y| ≤ 1 см + перекриття X; lift: y > 1 см; підхоплення мийки при виході з rest-смуги, повернення додому лише точно вдома (|snapDx| ≤ 1e-4).
- Restore і rebase не валідуються і не снапляться (`bypass`).
- Snap-back: спершу стан мийки, потім поза.
- Поза і геометрія CT комітяться в одному кадрі: коміт, що разом зі зміною довжини зсуває CT (`resizeFromM` і його revert), перебудовує виріз `immediate`. Затримка MeshBoolean лишається тільки для потоку змін довжини; layout — `debounceMs: 0`, але з чеканням кадрів.
- Опущена (y < 0) CT мийку не підхоплює; beside/lowered — landing `none`, поза валідна.

---

# Позиціонування стільниці (PlayCanvas) — standard / offset / remote, довжина, ресайз, ресторація, sink у русі

Репо `playcanvas-hasting`, гілка `feture/part-2`. Шляхи від `src/Scripts/app-configuration/` (далі `AC/`), документи — від `src/docs/`.
Скорочення: **adapter** = `AC/domain/countertop/adapters/countertop-composition-adapter.mjs`, **spatial** = `AC/domain/countertop/spatial/countertop-spatial.mjs`, **policy** = `AC/domain/countertop/countertop-layout-policy.mjs`, **rule** = `AC/domain/composition/rules/RuleCountertopLayout.mjs`.
Номери рядків з позначкою `~` пораховано по діапазону виводу, похибка ±1–2.

Чужі частини: жести, снап-цілі, колізії — `spatial/countertop.manipulable.mjs`, `spatial/countertop-snap-targets.mjs`, `domain/spatial-manipulation/**` (агент D&D). Коди причин, guard, overlay — `countertop-length-limits.mjs::evaluateCountertopOverlay`, `trap/trap-keepout.mjs`, `adapters/countertop-drag-overlay.mjs` (агент валідації).

---

## 1. Режими standard / offset / remote

### 1.1 Хто класифікує
- **У коді немає** `COUNTERTOP_POSITION_MODE`, `classifyCountertopPosition`, `_positionMode` і `getState().mode`. Пошук `rg` по `AC/**/*.mjs` нічого не знайшов. 3D віддає лише сирі ознаки:
  - `placementState` = `waiting | attached | moved` — `AC/domain/countertop/countertop-contract.mjs:8-12`; рахується в adapter `getState()` ~351;
  - `attached = isCountertopAttached(offset)`, тобто |x| і |y| ≤ `COUNTERTOP_ATTACHED_EPSILON_M = 1e-6` — policy:157-164; adapter ~336;
  - `offset {x,y}`, `customLength` (null, коли attached), `verticalLocked` / `verticalLockViolated`, `sink.{owner,shiftM,landing,pending,hosted}` — adapter `getState()` 332-375.
- Режими Standard / Offset / Remote визначені в документі `docs/features/counttop/relocation and remote positions/README.md:19-23`:

| Режим | Поза (`offset`, м від стандартної) | Рух |
|---|---|---|
| Standard | `{0,0}` | лежить на тумбах, довжина = ряд |
| Offset (relocation, «connected») | `x ≠ 0, y = 0` | лише L/R, на тумбах (R1.1) |
| Remote | `y > 0` | L/R + підйом (R1.2) |

- Як визначено «Standard»: `customLength === null && |offset| ≈ 0` (README:60). Одного `placementState` не вистачає: після першого `resizeFrom` стандартна стільниця має `offset.x ≈ ±2e-6` (adapter ~539).
- Вибір режиму за товщиною робить **UI**, не 3D (README:79-85):
  - 0.375 / 0.4 / 0.5″ → `none` (зсунута повертається в Standard);
  - 4″ → `offset` (`setVerticalLocked(true)`; піднята сідає на тумбу, якщо не може — Standard);
  - 2.4 / 5.125 / 5.5″ → `free`.
- Слово «remote» у коді має **два значення**:
  1. стільниця, зсунута в модульній (free-layout) композиції, де `compositionManager.preserveCabinetPositions === true`. У неї фіксована довжина і світова поза — adapter `_remoteTopsFixed()` 1448-1450, док-коментар класу ~141-147;
  2. «remote sink» — виріз поза рядом. Landing у цьому разі `none` з `reason: 'DETACHED'`, і поза валідна (adapter ~718-721).

### 1.2 Осі руху
- Площина: світова XY композиції на глибині стільниці; `u = x`, `v = y`, Z фіксована (`host.fixedZ = root.getPosition().z`) — `spatial/countertop.manipulable.mjs:4, 87-88`; spatial ~159.
- За замовчуванням `motion.axes = ['u','v']` (manipulable:88).
- **Vertical lock** (`setVerticalLocked`, adapter 445-451 → spatial `setVerticalLocked` / `_applyAxes`, spatial 90-107):
  - drag тільки по `['u']`, `v` заморожено;
  - явні записи (`setOffsetM`, restore) на час свого запису тимчасово повертають осі `['u','v']`: spatial 251, 256 (у `finally`);
  - якщо lock перемкнули під час жесту, він застосовується після snap-back (`_axesStale`, spatial 104, 214).
- API-перевірка lock: `setOffsetM` кидає `COUNTERTOP_VERTICAL_LOCKED`, лише якщо `y > max(0.01, поточний y + 1e-6)` (adapter ~458-460). Отже, збережену підняту позу можна рухати по X і опускати; її не відхиляють, лише показують `verticalLockViolated = verticalLocked && offset.y > 0.01` (adapter ~373).

### 1.3 Зони за висотою (adapter)
- **lifted**: `offset.y > COUNTERTOP_REST_TOLERANCE_M (0.01)` — `_placeSinks` ~1310.
- **resting**: `|offset.y| ≤ 0.01` **і** X-діапазон меша стільниці перекриває бокс хоч однієї тумби (з допуском 1e-3) — `_isResting` 749-755. Якщо виміряти не вдалося, resting = `sinkOwner !== 'countertop'`, щоб не скинути винесену раковину навмання (~753).
- **lowered**: `offset.y < −0.01` — `getHeightReasons` ~822.
- **beside the row**: будь-яка висота без перекриття з тумбами. Це не resting; landing = NONE (~1338).

### 1.4 Переходи і sink owner
- **Standard → Offset/Remote** (drag або `setOffset`, x ≠ 0 чи y ≠ 0): `_commitOffset` 1245-1270 пише `SpatialOffsetM`.
  - Legacy-композиція: довжина лишається авто (`resolveCountertopLengthM`, policy:172-177).
  - Модульна: якщо `CountertopLengthM` ще немає, поточна застосована довжина заморожується в `CountertopLengthM` (adapter 1253-1258).
- **Offset/Remote → Standard** (`resetOffset` або `setOffset({0,0})`): `_offsetPatch` для attached пише `CountertopLengthM: null` (adapter 1457-1468, рядок ~1460). Див. пастку з `resetOffset` у §4.4.
- **Підйом (lift, y > 1 см)**: owner `cabinet → countertop`. Під час підхоплення `sinkShiftM = −offset.x`, тож раковина зберігає світовий X (adapter ~1315-1318). Після drag-end або API `setOffset` йде одноразовий `action {type:'sink-lift', fromCabinetId, sinkLocalM}` (`_announceSinkLift` 787-808).
  - Умови: є рівно одна SB-раковина, sink не hosted, і стільниця не resting. Виняток: resting із landing `DETACHED` теж вважається підйомом (~792).
  - Флаг перевзводиться, коли раковина повертається додому (`owner === 'cabinet'`, ~1355) або при `reset` (~1146).
- **Посадка (resting із винесеною раковиною)**: `_sinkLanding()` 687-747 повертає `home | fits | gap | unfit | none`; деталі в §5.
  - Раковина повертається на SB лише тоді, коли вона **точно вдома**: `home` і `|snapDxM| ≤ 1e-4` (~1344-1348).
  - Інакше owner лишається `countertop` («the sink never leaves the top», ~1312-1314).
- **Опускання (lowered, y < −1 см)**: раковину не підхоплює — owner, що був `cabinet`, таким і лишається (коментар ~1314: «it would sink the SB's sink into the cabinet»). Landing = NONE, бо стільниця не resting і не lifted (~1338).
  - Висотні причини: над тумбою → `COUNTERTOP_BELOW_COVER`. Поза рядом → та сама причина, якщо `topBox.maxY < (верх крайньої тумби ряду + cover thickness) − 1 мм` (`getHeightReasons` 821-833; `_coverThicknessM` 835-840).
- **Hosted sink** (HR-CT-02, `CountertopSinkType` на стільниці): owner завжди `countertop`, shift = 0, раковину ніхто не «пінить» (дочірня стільниці) — adapter ~1290-1291, ~1315-1316; `countertop-hosted-sink.mjs:7-20`.
- «B1 lift» — у прочитаних файлах такого позначення немає (див. §8).

---

## 2. Локальні параметри стільниці (конфіг продукту `Top_Solid`)

### 2.1 Поля

| Поле | Тип / одиниці | Хто пише | Хто читає | Snapshot / preset |
|---|---|---|---|---|
| `SpatialOffsetM` (`SPATIAL_OFFSET_KEY`, `AC/domain/composition/spatial/composition-spatial.mjs:15`) | `{x,y}`, м від стандартної пози | adapter `_offsetPatch` → `_commitOffset`, `resizeFromM`, `_anchorRemoteOffset` | `readSpatialOffsetM` (composition-spatial:23-26; `{0,0}`, якщо не задано) → `spatial.register({savedOffsetM})` у `_bind` ~1198; `_syncLength`; watchParams правил: rule:54, `RuleCountertopBooleanCutouts.mjs:25`, `RuleCountertopCollisionRefresh.mjs:11`, `RuleSidePanels.mjs:29` | у snapshot продукту; compact preset — лише якщо offset ≠ 0 (>1e-9), з округленням `m9` (`AC/domain/cabinet-placement/compact-preset.mjs:488-493`), інакше видаляється (`DROPPED_TOP`, :36) |
| `CountertopLengthM` (`COUNTERTOP_LENGTH_KEY`, adapter:44) | м або `null` (null = довжина композиції) | `setLengthM`, `resizeFromM`, `_offsetPatch` (null при attach), заморожування remote у `_commitOffset` / `_anchorRemoteOffset`; default `null` (`product-config-loader.mjs:~293`; `composition-manager.mjs:~522`) | `_syncLength` → `resolveCountertopLengthM`; `getState().customLength` (null, коли attached, ~340) | snapshot; compact — лише коли є offset (compact-preset:491) |
| `CountertopSinkShiftM` (`COUNTERTOP_SINK_SHIFT_KEY`, adapter:48) | м або `null`: X раковини відносно sink point + `offset.x`, поки її несе піднята стільниця | `_commitOffset` ~1251, `resizeFromM` ~554, `_anchorRemoteOffset` ~1495 через `_sinkShiftToWrite` (778-781: лише owner `countertop` і не hosted, інакше `null`) | `_bind().then` ~1225-1228: є скінченне значення → owner = `countertop`, shift = значення | snapshot; compact — лише коли є offset (compact-preset:492) |
| `positionX` / `positionY` | м, **стандартна** світова позиція, від якої міряється offset | `_offsetPatch`, лише remote у модульній композиції: `base + parentShift(root)` (~1462-1466) | `_anchorRemoteOffset`, коли немає `previousBaseM` (~1484-1489) | формат експорту (`exportAllCompositions`); compact — видаляється (`DROPPED_TOP`) |
| `CountertopPositioning` | `'legacy' \| 'support-plane'` (`countertop-support-resolver.mjs:8-11`) | `composition-manager.mjs:~529` при створенні top (`resolveCountertopPositioningProfile` за `countertopSupport.strategy` тумб, support-resolver:42-56); compact import бере defaults (compact-preset:366) | rule ~281 (fallback — профіль тумб) | snapshot |
| `CountertopPlacement` | `'supported' \| 'independent'` (support-resolver:13-16) | `composition-manager.mjs:~531` = `SUPPORTED` | rule ~283 → `resolveCountertopSupportBase` | snapshot |
| `CountertopRole` | `'basinTop' \| 'cabinetCover'` | default `'basinTop'` (product-config-loader:~294; composition-manager:~530) | `countertop-role.mjs:2-18` (`resolveBasinTopProduct` обирає єдиний basinTop) | snapshot |
| `SupportGroupId` | рядок, default `'group-1'` (support-resolver:18) | composition-manager:~532 | rule (група опор і, у free layout, склад ряду під top) | compact — видаляється |
| `CountertopSinkType` / `CountertopSinkLocalM` | рядок / `{x,y,z}` м у локальному фреймі root стільниці | UI `cabinets.liftSink` (README:92) | Top_Solid scene rule, assembly resolver, adapter `_isHostedSink` | — (позиційно: hosted sink — дочірній, shift = null) |

- Запис snapshot «тихий», без агрегації: `_writeProductSnapshot` (adapter 1583-1597) фільтрує незмінені ключі, далі `createNext` + `composition.addProduct`.
- `_notifyCoverSourceChanged(patch)` (1522-1540) після кожного запису пози чи довжини повідомляє покриття тумб.

### 2.2 «Стандартна» позиція (base)
Її рахує rule, а spatial застосовує як `basePositionM`.
- **X** = центр групи тумб − `intrinsicPivotCorrectionXM` + `sidePanelOffsetM`:
  - формула — policy:101-119;
  - `intrinsicPivotCorrectionXM` = центр AABB стільниці − її світовий X (rule ~258-259);
  - `sidePanelOffsetM` = −0.005 (лише ліва бокова панель), +0.005 (лише права), 0 (дві або жодної) — policy:66-73.
- **Довжина (auto)**:
  - legacy: Σ ширин тумб (side shelf = 15 см) + (n−1)·`CABINET_LAYOUT_GAP_METERS` + 1 см на кожну бокову панель (policy:82-96);
  - free layout: `groupMaxX − groupMinX + 0.01·sidePanels` (rule ~270-274);
  - `stretchXM = autoLength − 0.6` (intrinsic довжина меша, policy:11, :147).
- **Y**:
  - `positioning === 'support-plane'` і `placement === 'supported'` → `rootWorldY = avg(support.worldY) − (mountWorldY − currentRootWorldY)` (support-resolver:72-118):
    - mount = якір `Countertop_Mount_Point` у стільниці (fallback — низ меша `TopSolid`), `baseLocalYM −0.00635` (`product-config-loader.mjs:~297-302`; `adapters/countertop-support-measurement.mjs:70-85`);
    - supports = факти опор тумб тієї ж `SupportGroupId` (якорі тумб `ULH_/Class_/Mako_/Lame_/UF_/Tricot_Countertop_Point`, product-config-loader:205-210; `UD_Countertop_Point` :847, :900);
    - опори мають бути копланарні в межах 1 мм, інакше `unresolved`.
  - `'legacy'` або `'independent'` → passthrough поточного Y. Його виставляють локальні правила Top_Solid: `RuleChangeCountertopHeight` (25), `RuleChangeCountertopPositionByStrategy` (35) — product-config-loader:~284-287.
  - Перетворення world→local: `resolvedRootWorldYToLocalY` (support-measurement:88-94).
  - Fallback, якщо не розв'язалося: у free layout для того самого root — попередній `binding.basePositionM.y`, інакше поточний local Y (rule ~301-302).
- **Z** = поточний local Z стільниці (rule ~320).
- Передача: rule ~313-323 робить один виклик `compositionAdapter.updateStandardLayout({ composition, entities, layout, basePositionM:{x,y,z} })`; коментар там: «Spatial re-applies the manual offset».
- spatial `beforeCapture` (~162-172) перед захопленням пози ставить root у `setLocalPosition(base.x, base.y, local.z)`. Коментар: «The layout owns the countertop's standard X/Y; the drag owns only the offset from it».

### 2.3 Як offset зберігається відносно standard
- `SpatialOffsetM` — це зсув від `basePositionM` у метрах (u = x, v = y): spatial `getOffsetM` 117-120 (`handle.getState().offsetM.{u,v}`).
- Світова поза = base + offset. Тому legacy-експорт віднімає offset від світової позиції (`composition-manager.mjs:99-108 liveStandardPosition`), а `AC/domain/composition/operations/legacy-scene-checkpoint.mjs:38` попереджає: «World positions already include SpatialOffsetM: never add that offset a second time».
- Remote у модульній композиції: коли base зсувається (тумби змінили розмір, видалені чи переміщені), offset переписується так, щоб **світова поза не змінилась**. Деталі — у §4.

---

## 3. Довжина і ресайз

### 3.1 Правило довжини
`resolveCountertopLengthM` (policy:172-177):
- attached → завжди `autoLengthM`;
- moved → `CountertopLengthM`, якщо задана (>0), інакше `autoLengthM`.

Застосовує правило `_syncLength` (adapter 1542-1572):
- `sameNumber(lengthM, _appliedLengthM)` → `NO_OP`;
- інакше `geometry.setLengthM` (SmartStretch симетрично відносно центру меша);
- `skipDebounce` тільки для layout (`'countertop-layout'`, ~1000).

### 3.2 `setLengthM(lengthM | null)` — API `setSize({length})`
Adapter 485-509; bridge `AC/bridge/plugins/countertop.plugin.mjs:101-105`.
- attached + не-null → `COUNTERTOP_ATTACHED` (~491-494).
- Clamp до `getLengthLimitsM()`, тобто max(material, симетричний basin), **без** per-side bounds.
- Offset не змінюється, центр стоїть, обидва торці рухаються однаково (~496-497).

### 3.3 `resizeFromM(side, lengthM, {validation})` — API `resizeFrom`
Adapter 514-588; bridge:107.
1. Clamp до `_resizeBoundsM()[side]` (fallback `getLengthLimitsM()`) (~528).
2. Якщо attached і довжина та сама → no-op (~534).
3. `halfDelta = (next − current)/2`; `target.x = offset.x ± halfDelta` (`right: +`, `left: −`), `y` без змін (~535-536). Це і є «перший ресайз зсуває top на ±Δ/2»: протилежний торець стоїть у світовому X.
4. HR-CT-04: attached top теж ресайзиться (коментар ~524-525). Якщо target точно = standard, `target.x = ±2·1e-6`, щоб не re-attach і не скинути довжину (~537-539).
5. Якщо owner `countertop`: `sinkShiftM −= Δx`, тож раковина лишається у світі на місці (~540-542).
6. `spatial.setOffsetM(target, {constraint:'bypass'})` (~545) → `_placeSinks('resize')` → один запис snapshot: offset-patch + `CountertopLengthM` + `CountertopSinkShiftM` (~551-556) → `_syncLength('countertop-length-changing', { immediate: true })`: виріз перебудовується до наступного рендеру, тож новий центр і нова довжина з'являються в одному кадрі.
7. Guard після застосування: невалідна поза відкочується (offset, довжина, shift, sink owner), далі `POSE_INVALID` (~564-580).
8. Колізія ресайз не блокує (doc-коментар ~509-512).

### 3.4 Межі
- **Матеріал** (requested): `setLengthLimitsM({minM,maxM}|null)` (adapter 591-599; bridge:108-113).
  - Default `{minM: 0.6, maxM: 120″ = 3.048 м}` — `countertop-length-limits.mjs`, `DEFAULT_COUNTERTOP_LENGTH_LIMITS_M`.
  - `normalizeCountertopLengthLimits` відкидає невідомі ключі та випадок min > max.
- **Симетричний basin min**: `2·(max відстань краю вирізу від центру + 1″)`; `COUNTERTOP_BASIN_MARGIN_M = INCH_M` (length-limits `resolveBasinMinLengthM`; вимір — adapter `_measureBasinMinLengthM` 606-622).
- **Ефективні**: `min = max(requestedMin, basinMin)`, `max = max(requestedMax, min)` (length-limits `resolveCountertopLengthLimitsM`).
- **Per-side** `resolveResizeBoundsM` (`countertop-resize-bounds.mjs:27-53`):
  - `anchorXM` = протилежний торець;
  - `basinMin` = |far(cut-out) − anchor| + margin, де margin = `basinEdgeMarginM = min(0.10, (hostWidth − cutoutWidth)/2)` для integrated і 0 для vessel (:17-20; adapter `getCoverageInputs` ~640-648);
  - `supportMin` = |far(support box) − anchor|;
  - `min = max(materialMin, basinMin, supportMin)`, `max = max(materialMax, min)`.
- **Support boxes**:
  - owner `cabinet` → хости живих раковин / вирізів;
  - owner `countertop` + resting + `landingPending` → бокс тумби-кандидата;
  - старий хост не враховується (adapter ~658-672).
- `getState().resizeBoundsM = {left, right}` (adapter `_resizeBoundsM` 877-893). Коли виміряти не вдалося — `null`.

### 3.5 Снап і крок (жест ручки — у UI / overlay)
- `countertop-resize-snap.mjs`:
  - `COUNTERTOP_RESIZE_STEP_M = 0.1″ = 0.00254` (:12);
  - `COUNTERTOP_RESIZE_SNAP_TOLERANCE_M = 1″` (:11).
- `snapCountertopLengthM` (:89-126):
  - кандидати в межах 1″ з пріоритетом `composition-edge > cabinet-edge > limit-min > limit-max > basin-min` (:15);
  - якщо кандидата немає — округлення до 0.1″;
  - потім clamp, і clamp перемагає округлення.
- `collectCountertopEdgeTargets` (:68-83): композиційні краї замінюють краї тумб на тому самому X.
- Сам `resizeFromM` **не** округлює і не снапить — тільки clamp. Снап робить UI через `countertopOverlay.lengthAtPointer(side, pt, {snap:true})` (README:64-70; код overlay не перевірявся).

### 3.6 `canResize`
- `canResize = ready && !attached` (adapter ~355). У UI вмикає лише кнопку edit-size (`emitEditSizeAction` 895-901; README:70).
- Ручки на торцях є в будь-якої стільниці (README:65).

---

## 4. Ресторація і ребайнд

### 4.1 `updateStandardLayout(input)` — вхід від rule (adapter 920-1004)
1. Перевірка `layoutReady`: composition, productId, root, mesh, скінченні base x/y/z, `autoLengthM > 0`. Якщо ні → `resetForComposition` (~939-950).
2. **До** `_bind` викликається `_anchorRemoteOffset(...)` (~958-972); помилки ковтаються з коментарем «never fail the standard layout over the remote anchor».
3. Зміна ідентичності (composition / product / root / mesh) → `_bind(...)`. Інакше: оновити assembly і base, `spatial.rebase()`, а за потреби `_moveToRebasedOffset(rebased)` (~974-984).
4. Новий `_binding` з `baseLengthM = layout.autoLengthM` і `_syncLength('countertop-layout', {skipDebounce:true})` (~986-1002).

### 4.2 `_bind` (adapter 1171-1242)
- Спершу `reset('countertop-binding-replaced')`; `reset` обнуляє sink-стан: owner null, shift 0, landing NONE, pending null, liftAnnounced false (1118-1150).
- `spatial.register({... savedOffsetM: readSpatialOffsetM(snapshot) ...})` (~1194-1221). У spatial (152-245) ненульовий saved offset ставиться через `handle.setOffset({u,v},{constraint:'bypass'})` + `whenSettled` (190-193). Тобто **restore без валідації і без снапу**. Після цього застосовується vertical lock.
- `.then(handle)` (~1221-1240):
  - відновлення owner із `CountertopSinkShiftM`: скінченне значення → `'countertop'` + shift; `null`, `undefined` або `''` → owner `null`, shift 0;
  - далі `_placeSinks('restore')` → `_syncLength('countertop-restored')`;
  - якщо `NO_OP` і стільниця не attached → `_refreshSinkCutouts(..., {anyOwner:true})`;
  - `emit RESTORED` → `_snapHome()`: відновлена resting-стільниця з pending `home` осідає одним рухом цілої стільниці.

### 4.3 Rebase і remote anchor
- `spatial.rebase()` (spatial 262-266) → `handle.rebasePose()` (повторно захоплює base, offset застосовується заново) і повторно знімає `afterPose` sink-стан. Логіка `rebase({mode:'standard'})` — у `AC/domain/spatial-manipulation/playcanvas/entity-group-pose.mjs:75, 86`.
- `_anchorRemoteOffset` (adapter 1476-1506):
  - **Нічого не робить**, якщо: композиція не модульна, триває drag, є `hasMutationGuard()` або стільниця attached.
  - Опорна база: попередня `basePositionM` того самого продукту, інакше збережені `positionX/Y − parentShift(root)`.
  - `dx, dy = newBase − fromBase`; якщо зсув > 1e-6 → `next = offset − (dx, dy)`.
  - Винесена раковина: `sinkShiftM += dx`, щоб раковина стояла на місці.
  - Якщо `CountertopLengthM` немає → пише `frozenLengthM` (поточна застосована довжина або base).
  - Повертає новий offset, якщо він змінився. Далі `_moveToRebasedOffset` (1508-1520) робить `spatial.setOffsetM(..., bypass)` + cover notify + `emit OFFSET`.

### 4.4 `resetOffset()` (adapter 477-479; bridge:95)
- Це `setOffsetM({x:0,y:0}, {constraint:'bypass'})`, а `validation` лишається за замовчуванням `'guard'`. Для attached-пози `_poseValidation` завжди повертає `'valid'` (adapter ~388), тож скидання фактично не відхиляється.
- **Пастка: несена раковина з `shift ≠ 0`** — висновок із коду, живцем не перевірено:
  1. `_commitOffset({0,0})` → `_placeSinks`: owner лишається `countertop` (~1315);
  2. стільниця resting → `_sinkLanding` дає `home` з `snapDxM = −(0 + shift)` (~723);
  3. `|snapDxM| > 1e-4` → `landingPending = home`;
  4. `setOffsetM` (~472) викликає `_snapHome()` → `setOffsetM({x: −shift, y:0}, bypass, skip)`.
  
  Підсумок: стільниця **не** в Standard, а на `x = −shift`. Для модульної композиції `_commitOffset` ще й заморожує довжину в `CountertopLengthM`.
- Документи: `docs/countertop/ui-integration-phase1.md:53` («Goes back to Standard and drops the custom length. Not validated.») і :199 / README:149 (API Reset / Standard / Cancel не надсилають `sink-landing`; UI комітить сам, якщо є `sink.pending`).

### 4.5 Snap-back жесту (spatial 197-245)
- `gesturestart`: `_lastValidOffsetM = getOffsetM()`, `_lastValidSinkM = _poseSinkM` (або свіжий `afterPose()` для першого жесту після restore).
- На кожну `change` під час drag: `afterPose()` → `_placeSinks('drag')`. Якщо `_poseValid() !== false`, оновлюються lastValid offset і sink.
- `gestureend` / `gesturecancel` → `finish`: якщо `_poseValid() === false`, спершу `restoreSink(backSink)` («the snap back must not read as a fresh lift»), потім `setOffset(back, bypass)` + `whenSettled`. Далі `_applyAxes` (якщо `_axesStale`) → `onCommit(getOffsetM())` → `'drag-end'`.
- Adapter у `onChange('drag-end')` (~174-176) викликає `_snapLanding()` + `_announceSinkLift()`.

### 4.6 API-guard `setOffsetM` (adapter 453-475)
- `back` = offset і sink-стан до запису → `spatial.setOffsetM(offset, {constraint})`.
  - `constraint: 'respect'` (default) або `'bypass'`. API-рухи не снапляться (bridge:7).
- Якщо `validation:'guard'` і поза invalid: відкат sink owner/shift, `setOffsetM(back, bypass)`, кидок `POSE_INVALID` з `.reasons` і `.rejected`.
- Інакше `_commitOffset` → `whenSettled` → `_snapHome` (якщо не `_landingSnapping`) → `_announceSinkLift`.

---

## 5. Sink у русі (позиційна частина)

### 5.1 `_placeSinks(logTag)` (adapter 1283-1358)
Викликається після кожного запису пози: `afterPose` (drag), `commit`, `resize`, `resize-revert`, `restore`.
- `lifted = offset.y > 0.01`; `resting = _isResting(offset)`.
- Owner:
  - `owner = hosted || lifted || owner === 'countertop' ? 'countertop' : 'cabinet'` — гістерезис: підхоплюється при підйомі, скидається лише точно вдома;
  - owner `cabinet` або hosted → shift = 0;
  - перехід `cabinet → countertop` → `shift = −offset.x` (~1315-1318).
- Розстановка `place()` (~1319-1330):
  - owner `cabinet`: `dx = 0`, `dy = 0`;
  - несена раковина: `dx = offset.x + shift`, `dy = offset.y`;
  - integrated sink: `setPosition(homeX + dx, homeY + dy, current.z)`, де home = sink point (батько entity);
  - vessel clone root: home = root тумби, Y не пінується;
  - Z завжди поточний.
- Landing рахується лише для owner `countertop`: `resting || lifted ? _sinkLanding() : NONE` (~1338).
  - Кілька SB-раковин, resting, `none` і не DETACHED → синтетичний `home` з `snapDxM = −(offset.x + shift)` (~1339-1343).
  - `home` з `|snapDxM| ≤ 1e-4` → owner = `cabinet`, shift = 0, повторний `place()` (~1344-1348).
- `_landingPending = resting && owner === 'countertop' && (fits | home)` → `{cabinetId, fromCabinetId, status}` (~1356).
- Landing мемоізується за `poseKey = generation|x|y`: повторне розміщення тієї ж пози (afterPose, потім commit) зберігає landing, оцінений при опусканні (~1331-1333).

### 5.2 `_sinkLanding()` (adapter 687-747)
Для owner `countertop` з **одним** вирізом.
- Ряд = тумби, чий бокс перекриває X стільниці.
- `holds` = тумба вміщає виріз із допуском 1 см (~715); кандидат = свій хост, інакше перша тумба, що вміщає.
- Немає кандидата:
  - виріз торкається тумби (допуск 1 мм) → `gap`;
  - інакше `none` з `reason: 'DETACHED'` (~720-721).
- Кандидат = свій хост → `home`, `snapDxM = −(offset.x + shift)`; для hosted sink — 0 (~723).
- Інша тумба:
  - integrated: `snapDxM = (центр кандидата − центр хоста) − (offset.x + shift)`;
  - hosted: `snapDxM = центр кандидата − центр вирізу` (~726-729);
  - `levelDy = верх кандидата − (низ стільниці − offset.y)` для hosted або `− верх хоста` для integrated (~730);
  - роль не SC → `unfit TYPE`; `levelDy > +0.005` або `< −0.02` → `unfit HEIGHT`; інакше `fits` (~732-734).

### 5.3 Що змінює X стільниці на release
- `_snapLanding()` (842-863) після `'drag-end'`:
  - `home` → `_snapHome()`: ціла стільниця зсувається на `snapDxM`, `y → 0`, `validation: 'skip'`; дія для UI не потрібна;
  - `fits` → `setOffsetM({x: offset.x + snapDxM, y: 0}, {bypass, skip})` (якщо `|snapDxM| > 1e-4` або `y ≠ 0`), потім `action {type:'sink-landing', landing}` один раз на кандидата (`_landingAnnounced`) і `emit SINK_LANDING`.
- Повторний вхід блокує `_landingSnapping`.
- `gap` / `unfit` позу не зсувають. Їх ловить guard (`getLandingReasons` 810-815 → snap-back або `POSE_INVALID`) — це частина агента валідації.

### 5.4 Вирізи під час жесту
- `drag-start`/`drag`, owner `cabinet`, є cutters → `meshBoolean.restoreSourceMesh('countertop-drag')`: стільницю тягнуть цілою, бо отвір лишається з раковиною на тумбі.
- `drag-end` → `_refreshSinkCutouts('countertop-drag-end', {anyOwner:true, forceRebuild:true})` (adapter ~165-173).
- `_refreshSinkCutouts` (1436-1446) без `anyOwner` перерізає лише для owner `cabinet`.

---

## 6. Таблиця «параметр → значення → де»

| Константа / поріг | Значення | Де |
|---|---|---|
| `COUNTERTOP_REST_TOLERANCE_M` (resting / lift / lowered / lock) | 0.01 м (1 см) | adapter:46; ~373, ~458, ~750, ~822, ~1310 |
| `COUNTERTOP_ATTACHED_EPSILON_M` (attached) | 1e-6 м | policy:157 |
| «Волосок» від standard після resize | ±2e-6 м | adapter ~539 |
| Поріг «точно вдома» / snapDx | 1e-4 м | adapter ~723, ~1344, `_snapLanding` ~850-852, `_snapHome` ~869 |
| Lock: дозволений підйом | `y ≤ max(0.01, поточний y + 1e-6)` | adapter ~458 |
| Landing, допуск висоти SC | +0.005 / −0.02 м (+5 мм / −2 см) | adapter ~733; HR-CT-01 `docs/rules-manifest.md:61` |
| Landing `holds` (виріз у тумбі) | 0.01 м | adapter ~715 |
| Landing `touches` (gap) | 0.001 м | adapter ~720 |
| Resting / height: перекриття X | 1e-3 м | adapter ~754, ~827 |
| Lowered beside row: допуск під cover | 1e-3 м | adapter ~832 |
| `SINGLE_SIDE_PANEL_OFFSET_M` (X base при одній боковій панелі) | ±0.005 м (0.5 см) | policy:10, :70-71 |
| `SIDE_PANEL_WIDTH_LEGACY_CM` (до auto length) | 1 см на панель | policy:9, :93 |
| Free layout: бокова панель до auto length | 0.01 м на панель | rule ~272 |
| `SIDE_SHELF_WIDTH_LEGACY_CM` | 15 см | policy:8 |
| `COUNTERTOP_INTRINSIC_LENGTH_M` (меш, stretch = auto − це) | 0.6 м | policy:11, :147 |
| `DEFAULT_COUNTERTOP_LENGTH_LIMITS_M` | 0.6 м … 120″ (3.048 м) | `countertop-length-limits.mjs` (`DEFAULT_COUNTERTOP_LENGTH_LIMITS_M`) |
| `COUNTERTOP_BASIN_MARGIN_M` (симетричний basin min) | 1″ (0.0254 м) | length-limits (`COUNTERTOP_BASIN_MARGIN_M`) |
| `COUNTERTOP_LENGTH_EPSILON_M` | 1e-4 м | length-limits |
| `COUNTERTOP_BASIN_EDGE_MARGIN_M` (per-side, integrated) | 0.10 м; фактично `min(0.10, (host − cutout)/2)`; vessel 0 | `countertop-resize-bounds.mjs:3, 11, 17-20` |
| Coverage `tolM` | 1e-4 м | resize-bounds:65 |
| `COUNTERTOP_RESIZE_STEP_M` | 0.1″ = 0.00254 м | `countertop-resize-snap.mjs:12` |
| `COUNTERTOP_RESIZE_SNAP_TOLERANCE_M` | 1″ = 0.0254 м | resize-snap:11 |
| Пріоритет снапу довжини | composition-edge > cabinet-edge > limit-min > limit-max > basin-min | resize-snap:15 |
| `CLAMP_EPSILON_M` / злиття edge-цілей | 1e-6 м | resize-snap:14, :79 |
| Копланарність опор (support-plane) | 0.001 м | `countertop-support-resolver.mjs` ~101 |
| `Countertop_Mount_Point` `baseLocalYM` | −0.00635 м (0.5″ TopSolid, центральний pivot) | `product-config-loader.mjs` ~297-302 |
| Default `Thickness` Top_Solid | 0.375 | product-config-loader ~292 |
| `COUNTERTOP_METERS_PER_INCH` | 0.0254 | `countertop-units.mjs:1` |
| Compact preset: поріг «є offset» | 1e-9 | compact-preset ~489 |

---

## 7. Інваріанти і пастки з коду та коментарів

1. **Раковина ніколи не залишає стільницю, якщо її вже несуть.** Додому вона йде лише точно вдома (`home` і `|snapDxM| ≤ 1e-4`). Pending `home` / `fits` на release зсувають **всю** стільницю — adapter ~1312-1314, док класу ~150-152.
2. **Lowered не підхоплює раковину** (~1314). Поза рядом landing немає (~1338).
3. **Offset завжди в standard-координатах.** Layout володіє base X/Y, drag — лише offset (spatial ~161). Remote у модульній композиції тримає **світову** позу: offset переписується під нову base (`_anchorRemoteOffset`), а винесений sink shift поглинає `dx`.
4. **Re-attach (offset ≈ 0) скидає `CountertopLengthM`** (`_offsetPatch` ~1460). Тому resize attached-стільниці навмисно лишає її на ±2e-6 від standard (~537-539).
5. **Remote без збереженої довжини не перераховується.** Довжина заморожується при detach (`_commitOffset` ~1253-1258) і при rebase (`_anchorRemoteOffset` ~1498-1501). Тільки для `preserveCabinetPositions === true`; legacy-композиції не змінено (док класу ~141-147).
6. **Restore збереженої пози проходить без guard і без снапу** (`constraint:'bypass'`, spatial 190-193). Збережена піднята поза під lock не відхиляється, лише `verticalLockViolated` (~372-373).
7. **Snap-back відновлює sink-стан до offset**, щоб відкат не виглядав як новий lift (spatial ~206-207). API-guard робить те саме (adapter ~466-467).
8. **`_anchorRemoteOffset` не працює під час drag і під `hasMutationGuard`** (~1477). `updateStandardLayout` викликає його **до** `_bind`, бо `reset` у `_bind` стирає стан (~958-959).
9. **`_placeSinks` має early return** без assembly або без drag handle (~1286-1289) і без sink homes та не hosted (~1305-1308). У debug-лог пишеться причина.
10. **Мемоізація за позою:** `getCoverageInputs` і `_poseValidation` за ключем `generation|x|y|appliedLength|owner|pendingCabinet` (~628-630, ~390); `_sinkLanding` — за об'єктом coverage (~691); `_placeSinks` — landing за `poseKey` (~1332).
11. **Generation-guard:** усі колбеки `_bind` / spatial перевіряють `generation === this._generation`, щоб старий handle не писав у новий binding (~1206, ~1210, ~1215, ~1223). Spatial реєструє handle з id `countertop:${productId}:${generation}` (~178).
12. **Записи блокуються, поки legacy suspended/retired** (`LEGACY_WRITERS_BUSY`): `setOffsetM`, `setLengthM`, `resizeFromM`, `setDragEnabled`, spatial `setOffsetM` / `register`.
13. **`endSettle`, `waitForFrames`** у прочитаних файлах стільниці відсутні. Очікування — через `whenSettled()` (adapter 1011; `handle.whenSettled()` у spatial) і `_trackOperation`.

---

## 8. Не перевірено / суперечності

1. **Немає `COUNTERTOP_POSITION_MODE`, `classifyCountertopPosition`, `_positionMode` і `getState().mode`.** Точки входу брифу цього не підтверджують. Режими існують лише в доці (README:19-23) і, за README:79-85, в UI-репо (thickness → `none / offset / free`). Код UI не перевірявся.
2. **«5 мм rest tolerance»** у брифі не відповідає коду. Rest tolerance = **1 см** (`COUNTERTOP_REST_TOLERANCE_M = 0.01`). 5 мм — це верхній допуск висоти SC при посадці (`levelDy > 0.005`).
3. **Розбіжність у док-коментарі `_sinkLanding`** (~676-685: «box top within 2 cm of the host's»). Код перевіряє асиметрично: +5 мм / −2 см (~733).
4. **`lengthLimitsIn` / `lengthPresetsIn` по колекціях** у цьому репо не знайдено: у `countertop-collections.mjs` таких полів немає. Межі приходять з UI через `countertop.setLengthLimits`. Імовірно, вони живуть в UI-репо — не перевірено.
5. **«B1 lift»** — позначення не знайдено в прочитаних файлах. Можливо, воно з `docs/features/counttop/relocation and remote positions/changes.md` (прочитано лише кілька рядків).
6. **Кейс `resetOffset` із `shift ≠ 0` → `x = −shift`** виведено з коду (§4.4), живцем не перевірено.
7. **`resetOffset` фактично йде з `validation:'guard'`** (default у `setOffsetM`). Документ `ui-integration-phase1.md:53` каже «Not validated». На практиці attached-поза завжди `'valid'`, але подальший `_snapHome` іде з `validation:'skip'`.
8. **Snap / крок довжини в overlay** (`countertopOverlay.lengthAtPointer`, `countertop-edit-overlay.mjs`) не читався. Те, що він викликає `snapCountertopLengthM`, взято з README:66 і док-коментаря resize-snap.
9. **Номери рядків з `~`** пораховано по діапазонах `sed`, похибка ±1–2. Рядки в `countertop-length-limits.mjs` не вказано: файл читався з відфільтрованими порожніми рядками, тому посилання там за іменем символу.
10. **Повний список `watchParams` rule** (rule:54-55) прочитано частково. Чи є там `CountertopLengthM`, не перевірено.
11. **Backlog із README:155-162** (не перевірено в коді): `_landingAnnounced` може не перевзвестися після відмови; відхилений `setOffset` встигає надіслати move-події до відкату; `COUNTERTOP_RESIZE_STEP_M` не експортується через API.
12. **HR-CT-08 (Remote на винесених SC, ❌) і HR-CT-09 (рух раковини по CT, фаза 2)** не реалізовані (`docs/rules-manifest.md:68-69`).
