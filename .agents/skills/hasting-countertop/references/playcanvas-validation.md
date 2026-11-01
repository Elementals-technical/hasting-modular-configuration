# Стільниця — валідні й невалідні позиції (scope `playcanvas` › `validation`)

Читай разом із `contract.md` (таблиця кодів) і `rules-and-decisions.md` (правила клієнта, числа). Коли сюди: чому поза червона / snap back / `COUNTERTOP_POSE_INVALID`, trap keep-out, coverage SB, basin edge, sink landing, below cover, vertical lock, колізія vs валідність. Де рахується позиція → `playcanvas-positioning.md`; жест → `playcanvas-dnd.md`.

## Сценарії
- **Поза відкочується на release, але причини не видно** → `dragGuard.evaluate()` (`countertop-drag-overlay.mjs:311–335`) → `reasons` з `evaluateCountertopOverlay`; перевір `getState().validation` і `traps`/`coverage` входи.
- **API `setOffset` кидає `POSE_INVALID`** → `error.reasons` + `error.rejected`; з `validation:'skip'` поза приймається без перевірки (так робить Cancel D&D).
- **Червоне при колізії, але Apply/API пропускають** → так і задумано: колізія лише `warnings`; overlay сам блокує Apply (`canApply`). Різні відповіді spatial vs overlay — задокументований розрив.
- **Trap keep-out не спрацьовує** → `activePack().geometry.trap` (6″/8″ з `urban.pack.mjs`), хост-SB звільняється лише якщо його верх у `contactM` від низу CT; hosted trap нікого не звільняє; бокові панелі не перевіряються.
- **Мийка «сідає» не туди** → landing: `TYPE` (не SC), `HEIGHT` (levelDy > 5 мм або < −2 см), `gap`; `fits` → pending, не помилка.

## Інваріанти
- Блокують позу (snap back / `POSE_INVALID`): `TRAP_KEEPOUT`, `SINK_BASE_NOT_COVERED`, `BASIN_EDGE_TOO_CLOSE`, `SINK_LANDING_GAP/UNFIT`, `COUNTERTOP_BELOW_COVER`. Лише overlay: `COUNTERTOP_COLLISION` (warning), `LENGTH_OUT_OF_RANGE`, `BASIN_CONFLICT`.
- Attached CT завжди `valid`; restore/rebase/внутрішні снапи не валідуються.
- `validation` мемоізовано за `generation|offset|length|owner|pending`; зміна статусу → change reason `'validation'`.
- Відхилений `setOffset` встигає емітити `move` до revert; `resizeFromM` пише snapshot до перевірки і revert-ить його назад.
- `lastValid` оновлюється на кожному кроці, де guard ≠ `false` (`null` = «можна»).

---

# PlayCanvas: валідність пози стільниці (CT)

Репо `playcanvas-hasting`, гілка `feture/part-2`. Шляхи від `Scripts/app-configuration/` (`AC/`), якщо не сказано інше. Короткі імена:
- `LL` = `AC/domain/countertop/countertop-length-limits.mjs`
- `RB` = `AC/domain/countertop/countertop-resize-bounds.mjs`
- `TK` = `AC/domain/countertop/trap/trap-keepout.mjs`
- `OV` = `AC/domain/countertop/adapters/countertop-drag-overlay.mjs`
- `AD` = `AC/domain/countertop/adapters/countertop-composition-adapter.mjs`
- `SP` = `AC/domain/countertop/spatial/countertop-spatial.mjs`
- `CT` = `AC/domain/countertop/countertop-contract.mjs`
- `PL` = `AC/bridge/plugins/countertop.plugin.mjs`

Одиниці: метри, world X/Y. `offset` = зсув від стандартної (композиційної) пози. `REST_TOL = 0.01` (AD:46).

---

## 1. Словник причин

### 1a. `COUNTERTOP_OVERLAY_REASON` (LL:21-31): збирає `evaluateCountertopOverlay` (LL:80-120)

| Код | Умова спрацювання | Хто рахує вхід | У `dragGuard` (snap back / POSE_INVALID)? | Overlay |
|---|---|---|---|---|
| `COUNTERTOP_COLLISION` | `state.collision.status === 'colliding'` (LL:83). Коли spatial-спостереження дає `unknown`/`disabled`, overlay сам перевіряє box CT проти boxів тумб і бокових панелей; збіг понад 1 мм по кожній осі = колізія (OV:40, OV:259-271, `detectDraftCollision`) | spatial `getCollision()` (SP:121-125) + box-фолбек (OV) | **Ні**: лише `warnings` (OV:319), і тільки зі spatial-статусу, без box-фолбеку | червоний, `canApply:false`, outline `invalid` на CT і на кожен `collidesWith` (OV:93-97, OV:213) |
| `TRAP_KEEPOUT` | будь-яка тумба (не хост) заходить у зону сифона понад `tolM = 1e-3` (див. §3c) (LL:86-89) | `trapViolationsAt` (OV:277-283) → `countertopTrapViolations` (TK:54-59) | **Так** (OV:321, OV:332) | червоний; тіла-порушники потрапляють у `collidesWith` (LL:119), тож теж обводяться `invalid` |
| `BASIN_EDGE_TOO_CLOSE` (= `COUNTERTOP_COVERAGE_REASON.BASIN_EDGE`, RB:5) | вирізаний отвір ближче за margin до торця CT: `c.minX < ct.minX + m − tol` або `c.maxX > ct.maxX − m + tol` (RB:71); `tol = 1e-3` в overlay (OV:305) | `countertopCoverageViolations` (RB:60-82), вхід `AD.getCoverageInputs()` (AD:624) | **Так**, лише для відсунутої CT (`attached === false`, OV:297) | червоний |
| `SINK_BASE_NOT_COVERED` (= `SB_NOT_COVERED`, RB:6) | support box (SB) не вкладається в X CT: `b.minX < ct.minX − tol` або `b.maxX > ct.maxX + tol` (RB:77) | там само | **Так**, лише для відсунутої | червоний |
| `SINK_LANDING_GAP` | CT у стані «лежить» (resting) + `_sinkLandingAt.status === 'gap'` (AD:810-815) | `AD.getLandingReasons()` | **Так** (OV:323-326: проходить навіть без trap/coverage-правила) | червоний |
| `SINK_LANDING_UNFIT` | resting + `status === 'unfit'` (`TYPE` або `HEIGHT`) (AD:810-815) | там само | **Так** | червоний |
| `COUNTERTOP_BELOW_COVER` | `offset.y < −0.01` і (X CT перекриває будь-яку тумбу більш ніж на 1 мм, **або** CT стоїть поруч із рядом і `top.maxY < endCabinet.maxY + coverThickness − 1e-3`) (AD:821-834) | `AD.getHeightReasons()` | **Так** (OV:324-326) | червоний |
| `BASIN_CONFLICT` | лише коли `coverageViolations` **не масив** і `basinMinLengthM > 0` і `length < basinMinLengthM − 1e-4` (LL:110-112) | `getLengthLimitsM().basinMinLengthM` (AD:600-616) | **Ні** (guard завжди передає масив, OV:332-333) | червоний; на практиці лише коли box CT не виміряно (див. §6) |
| `LENGTH_OUT_OF_RANGE` | `attached === false` і (`length < requestedMinM − 1e-4` або `length > maxLengthM + 1e-4`) (LL:113-116) | `state.size.length`, `state.lengthLimitsM` | **Ні** | червоний, `canApply:false`; також для ghost-прев'ю ресайзу (OV:204-207) |

Агрегований статус: є хоч одна причина → `'colliding'`; інакше `'clear'` лише коли `collision.status === 'clear'`, решта → `'unknown'` (LL:118).

### 1b. `COUNTERTOP_ERROR_CODE` (CT:40-47), коди помилок API

| Код | Коли кидається | Де |
|---|---|---|
| `COUNTERTOP_NOT_READY` | немає composition manager / spatial ще не зареєстрований | PL:167, SP:244-245 |
| `COUNTERTOP_INVALID_INPUT` | погана форма аргументів; `validation` не `'guard'`/`'skip'` | PL:49-62, AD:461, AD:527 |
| `COUNTERTOP_ATTACHED` | `setLengthM(число)` на приєднаній CT | AD:≈495-498 (`setLengthM`) |
| `COUNTERTOP_DESTROYED` | фасад знищено | PL:208 |
| `COUNTERTOP_VERTICAL_LOCKED` | lock увімкнено і `offset.y > max(0.01, currentY + 1e-6)`; кидається **до** застосування (AD:458-459) | AD:458-459 |
| `COUNTERTOP_POSE_INVALID` | `validation: 'guard'` і після застосування `_poseValidation().status === 'invalid'`; поля `error.reasons` (коди) і `error.rejected = { offset, length }` (AD:402-408) | AD:465, AD:566 |
| `LEGACY_WRITERS_BUSY` (поза контрактом) | writer призупинено | AD:454, SP:108 |

### 1c. Change reasons (CT:25-38), що стосуються валідності
- `'validation'`: вторинна подія, коли `state.validation.status` змінився між двома `_emitChange` (AD:1630-1632).
- `'vertical-lock'`: `setVerticalLocked` (AD:448).
- `'sink-landing'`: після snap на `'fits'` (AD:≈855-856), разом з `action { type:'sink-landing', landing }`.
- `'length'`: `resizeFromM`, як після успіху, так і після revert (AD:≈582-583).
- `'restored'`: restore пози; не валідується (AD:1237).
- Spatial-причини передаються сирими, поза `COUNTERTOP_CHANGE_REASON`: `'move'`, `'drag'`, `'drag-start'`, `'drag-end'`, `'collision'`, `'drag-enabled'`, `'registered'` (SP:222, AD:167-178).

### 1d. `sink.landing` (`getState().sink.landing`, AD:368), обчислює `_sinkLanding()` (AD:687-≈738)
Рахується лише при `_sinkOwner === 'countertop'` і рівно одному cut-out (`coverage.cutouts.length === 1`).

| `status` / `reason` | Умова | Наслідок |
|---|---|---|
| `none` / `null` | немає власника-CT, cut-out ≠ 1 або нема вимірів | валідно |
| `none` / `DETACHED` | жодна тумба не тримає cut-out і жодна з ним не перекривається (> 1 мм) — раковина поза рядом | валідно (`landingReasons` порожні) |
| `gap` | жодна тумба не тримає cut-out (`box.minX − 0.01 ≤ cut.minX && cut.maxX ≤ box.maxX + 0.01`, AD:715), але якась перекривається | resting → `SINK_LANDING_GAP` |
| `home` | кандидат = власна SB-хост; `snapDxM = −(offset.x + sinkShiftM)` (hosted: 0) | на release уся CT зсувається на `snapDxM` (`_snapHome`, `validation:'skip'`) |
| `unfit` / `TYPE` | кандидат не має ролі `SC` | resting → `SINK_LANDING_UNFIT` |
| `unfit` / `HEIGHT` | `levelDy = candidate.maxY − (hosted ? top.minY − offset.y : hostSB.maxY)`; `levelDy > 0.005` або `< −0.02` | resting → `SINK_LANDING_UNFIT` |
| `fits` | SC, висота в межах −2 см…+5 мм | resting → `sink.pending` до `cabinets.moveSink`; на release snap на `snapDxM` + action |

Кілька SB-раковин у стані resting і `none` без `DETACHED` → синтетичний `home` із `snapDxM = −(offset.x + shift)` (AD:≈1339-1342).

---

## 2. Pipeline валідації пози

### 2a. Drag (жест вказівником)
1. Прив'язка: `PL._bindSubscriptions` викликає `adapter.setDragGuard(overlay.dragGuard)` і `adapter.setPoseValidator(overlay.dragGuard.evaluate)` (PL:175-180). Діє незалежно від того, чи увімкнені візуали overlay.
2. `gesturestart`: `_dragging = true`, `_lastValidOffsetM = стартова поза`, `_lastValidSinkM = _poseSinkM ?? afterPose()` (SP:≈229-233).
3. Кожен крок: `handle 'change'` → `afterPose()` = `AD._placeSinks('drag')` повертає `{owner, shiftM, landing, pending}` (AD:1209-1213) → `_onChange('drag')` (SP:221-222) → `AD._emitChange('drag')` скидає `_validationMemo` (AD:1626) → `getState().validation` = `_poseValidation` викликає validator (AD:384-399) → listeners `change`.
4. Ще в тому ж обробнику: якщо `dragGuard() !== false`, то `_lastValidOffsetM/SinkM` = поточна поза (SP:223-225). Значення `null` («не можна вирішити») теж оновлює last valid.
5. Overlay `sync()` (OV:129-151): `evaluation = evaluateCountertopOverlay(withLanding(withCoverage(withTrapKeepOut(withBoxCollision(state, box)))))` (OV:147) → tint/outline → `publish(computeFrame())` (OV:≈357-366, дедуп за ключем кадру).
6. `gestureend`/`gesturecancel` → `finish()` (SP:197-216): якщо `back && _poseValid() === false`, то `restoreSink(backSink)` (AD:1214-1220) і `handle.setOffset(back, bypass)`; далі `onCommit(offset)` → `AD._commitOffset` і `_onChange('drag-end')`.
7. `AD` на `'drag-end'`: `_snapLanding()` і `_announceSinkLift()` (AD:177). `'home'` → `_snapHome()` → change `'offset'`; `'fits'` → `setOffsetM({x+snapDx, y:0}, {constraint:'bypass', validation:'skip'})` → action `sink-landing` → change `'sink-landing'` (AD:≈842-858).

### 2b. `dragGuard.evaluate()` (OV:315-335)
- Повертає `{ valid: true|false|null, reasons: string[], warnings: string[] }`.
- `closed` → `valid:null`. `warnings = ['COUNTERTOP_COLLISION']`, якщо `s.collision.status === 'colliding'` (OV:319).
- `trapRule` вмикається, коли є `s.traps` і пакет активної колекції має `geometry.trap` (OV:320-321). `coverage` береться лише для `attached === false` і непорожніх cutouts/supportBoxes (OV:296-302).
- Без trap-правила і без coverage → `early()`: landing чи height-причини дають `valid:false`, інакше `null` (OV:325-327).
- Box: з overlay, якщо той активний на тому ж root, інакше `measure(countertopMesh ?? root)` (OV:328-330). Немає box → `early()`.
- `reasons` = коди з `evaluateCountertopOverlay({trapViolations, coverageViolations, landingReasons, heightReasons})`; `valid = reasons.length === 0` (OV:332-334). `size`/`lengthLimitsM`/`collision` у цей виклик не передаються, тож `LENGTH_*`/`BASIN_CONFLICT`/`COLLISION` ніколи не роблять позу невалідною.
- `dragGuard()` = `evaluate().valid` (OV:311-313).

### 2c. `getState().validation` (AD:374, AD:384-399)
- `{ status: 'valid'|'invalid'|'unknown', reasons, warnings }`.
- `unknown`: не ready / validator не прив'язаний / іде рекурсія (`_validatingPose`).
- `attached` → завжди `valid` (AD:387).
- Мемо-ключ: `${generation}|${offset.x}|${offset.y}|${appliedLengthM}|${sinkOwner}|${pendingCabinetId}` + той самий validator (AD:390-391). Скидається в кожному `_emitChange(reason ≠ 'validation')` (AD:1626). Coverage-inputs мають власний мемо з тим самим ключем (AD:≈628-630); `_placeSinks` скидає `_coverageMemo`, коли раковину несе CT (AD:≈1336). Landing мемоізується на об'єкт coverage (AD:691).
- Помилка validator-а → `result = null` → `unknown` (AD:394).

### 2d. API-шлях `setOffset` (`validation: 'guard'` за замовчуванням)
1. `PL.setOffset(offset, {validation})` перевіряє ключі опцій (PL:57-63, 92-93) → `AD.setOffsetM` (AD:453).
2. Перевірка vertical lock до будь-якої зміни (AD:458-459).
3. Запам'ятати `back = offset`, `backSink = {owner, shiftM}` (AD:462).
4. `applied = await _spatial.setOffsetM(offset)` (SP:≈242-252) → `handle.setOffset` → `handle 'change'` → `afterPose` + `_onChange('move')` → **AD емітить `change {reason:'move'}` з невалідною позою** (+ `'validation'`, якщо статус перевернувся).
5. `_rejectInvalidPose` (AD:402-408): `status !== 'invalid'` → вихід; інакше revert: `_sinkOwner/_sinkShiftM = backSink` → `_spatial.setOffsetM(back, bypass)` (ще одна `'move'`) → `throw POSE_INVALID {reasons, rejected:{offset, length}}`.
6. Успіх: `_commitOffset(applied)` (запис snapshot) → `whenSettled` → `_snapHome()` (якщо не всередині snap) → `_announceSinkLift()` (AD:468-473).
- Revert зачіпає sink owner/shift і offset. Snapshot не змінювався, бо commit іде після guard (тест: «nothing persisted»).
- `'skip'`: поза застосовується і комітиться; `validation.status` може бути `'invalid'`, і подія `'validation'` про це повідомляє.

### 2e. API-шлях `resizeFrom(side, lengthM, {validation})` (AD:514-≈584)
- Довжина спочатку обрізається до `_resizeBoundsM()[side]` (AD:528; `RB.resolveResizeBoundsM`: material min/max, basin per side, support per side).
- Застосування: offset зсувається на ±½Δ (на приєднаній CT стоїть на 2·ε від стандарту, щоб не re-attach); `_sinkShiftM` компенсується; `_placeSinks('resize')`; **snapshot записується до валідації** (offset + `CountertopLengthM` + `CountertopSinkShiftM`); SmartStretch/CSG; `whenSettled`.
- Guard після застосування (AD:566): revert = sink owner/shift + offset + `_placeSinks('resize-revert')` + backPatch snapshot (попередня довжина, shift) + `_syncLength` + `whenSettled` + change `'length'` → throw `POSE_INVALID`.
- `setLengthM` guard-а не має: лише clamp до `getLengthLimitsM()` і `ATTACHED` на приєднаній.

---

## 3. Геометричні перевірки

### 3a. Coverage (HR-CT-06/07), RB:60-82 + AD:624-≈680
- Діє лише для відсунутої CT (`attached === false`, OV:297). Приєднана не перевіряється (тест OV-coverage).
- `cutouts`: кожен `assembly.cutters` з `mesh.parent`; X-екстент через `measureCutoutExtentXM` (LL:123-140, усі mesh-і, також приховані); `vessel = source === 'vessel-clone' || /^Vessel(_|$)/.test(sinkId)`; `id` = id хост-тумби або `null`.
- Margin для кожного cut-out: Vessel → 0; інтегрований з хостом → `basinEdgeMarginM({cutoutWidthM, hostWidthM}) = min(0.10, max(0, (hostWidth − cutoutWidth)/2))` (RB:17-20, AD:650); без хоста → функціональний `marginM = 0.10` (RB:3, RB:11).
- `supportBoxes`: лише при owner `'cabinet'` (owner = `_sinkOwner ??` (`hosted` або `y > 0.01` ? `'countertop'` : `'cabinet'`)). Це boxи хостів живих раковин, потім хостів живих cut-out (Vessel-плейсхолдер). Додатково при owner `'countertop'` + `pending.cabinetId` + resting додається box кандидата посадки; старий хост тоді не перевіряється.
- Допуск: 1e-3 в overlay/guard (OV:305), 1e-4 за замовчуванням (RB:65).
- `COUNTERTOP_BELOW_COVER` до coverage не належить, це `heightReasons` (див. 3g).

### 3b. Basin edge margin і мінімальна довжина
- Симетричний мінімум (SmartStretch навколо центру): `basinMin = 2·(max|cutEdge − centerX| + 1″)`, де `COUNTERTOP_BASIN_MARGIN_M = 0.0254` (LL:19, LL:50-58). Ефективні межі: `min = max(requestedMin, basinMin)`, `max = max(requestedMax, min)` (LL:60-67).
- Однобічний ресайз: `basinMin(side) = max(|far(cut) − anchorX| + margin(cut))`, `supportMin = max |far(SB) − anchorX|`, `min = max(materialMin, basinMin, supportMin)`, `max = max(materialMax, min)` (RB:27-53).

### 3c. Trap keep-out (HR-PL-06), TK + OV:277-283
- Пакет: `urban.pack.mjs:23` `geometry.trap = { sideM: 0.1524 (6″), belowM: 0.2032 (8″) }`, `tolerances.contactM = 0.002`, `collisionM = 1e-4` (urban.pack.mjs:21). Немає пакета або `geometry.trap` → правила немає (OV:279, OV:321).
- Traps: `getState().traps = readSinkTraps(assembly, pendingCabinetId)`: `[{ id:'trap:<hostCabinetId|entity.name>', xM (world, рухається з CT), hostCabinetId }]` (AD:367, AD:1768-1787).
- Зона будується лише для сифона, X якого лежить у межах X CT (TK:23): X `[trapX − 6″, trapX + 6″]`, Y `[ctBottom − 8″, ctBottom]`, Z = Z-діапазон CT (TK:24-26).
- Хост звільнений від правила, якщо `|host.maxY − ctBottom| ≤ contactM` і `host.minX ≤ trapX ≤ host.maxX` (TK:38). Сифон hosted-раковини (`hostCabinetId: null`) не звільняє нікого (TK:36).
- Порушник: box тумби перекриває зону понад `tolM` по всіх осях (`boxesOverlap`, TK:48). Для CT `tolM = 1e-3` (OV:282). Тіла: лише тумби, бокові панелі не перевіряються (OV:276, OV:280).

### 3d. Колізія (лише warning для guard)
- Основне джерело: spatial-спостереження (`highlight`-режим; `mode:'block'` відхиляється, `docs/countertop-collisions.md:51`, статуси `unknown|disabled|clear|colliding`, `docs/countertop-collisions.md:80-88`).
- Фолбек box-колізії (OV:259-271) вмикається, коли статус не `colliding`/`clear` (ULH без профілю): CT проти boxів тумб і бокових панелей (раковини виключені вимірюванням), перекриття > 1 мм по кожній осі. CT, що лежить на тумбі, лише торкається, тому `clear`.
- Колізія не блокує `resizeFrom` (тест `countertop-resize-from:278`) і не дає snap back, але в кадрі overlay робить `canApply:false`.

### 3e. Довжина
- За замовчуванням `{minM: 0.6 (одна тумба 60 см), maxM: 120″ = 3.048}` (LL:18); UI може задати своє через `setLengthLimits` (PL:15, AD:≈591-597).
- `LENGTH_OUT_OF_RANGE` лише для відсунутої і лише проти `requestedMinM` / `maxLengthM` (LL:113-116). API-шляхи обрізають довжину, тож червоне з'являється переважно на прев'ю `previewLength` (OV:204-207).

### 3f. Vertical lock
- `setVerticalLocked(true)`: drag рухається лише по осі `u` (`setMotion({axes:['u']})`, SP:102-106). Перемикання посеред жесту застосовується після `finish` (SP:214).
- API: заборонено лише підйом, `y > max(0.01, currentY + 1e-6)` (AD:458). Рух по X і опускання дозволені.
- Відновлена піднята поза зберігається: `verticalLockViolated = locked && offset.y > 0.01` (AD:373). Помилки немає.

### 3g. Висота / lift / resting
- Lifted: `offset.y > 0.01` → CT забирає раковину (owner `'countertop'`) (AD:≈1312-1316, HR-CT-02).
- Resting: `|offset.y| ≤ 0.01` **і** X CT перекриває box тумби більш ніж на 1 мм; якщо виміряти не вдалося, то `sinkOwner !== 'countertop'` (AD:≈741-748).
- Lowered: `offset.y < −0.01` → `getHeightReasons` (AD:821-834). Кінцева тумба ряду визначається за тим, з якого боку центр CT відносно центру ряду. `coverThickness` береться з `getCabinetCoverSettings()`, 0 = вимкнено.
- `landingReasons` діють лише у стані resting (AD:811).

---

## 4. Валідність тумб і валідність стільниці

| | Placement kernel (тумби) | Countertop adapter/overlay (CT) |
|---|---|---|
| Правило | `HR-PL-06 TRAP_KEEPOUT`, check `trapKeepOut` (urban.pack.mjs:39-40), повідомлення `'A {role} cannot be placed in the trap clearance zone…'` (urban.pack.mjs:48) | `TRAP_KEEPOUT` overlay-reason (LL:25, LL:88) |
| Код | `placement-checks.mjs:126-133`: тіла = вибрані виміряні `facts.cabinets` (box `x[0..1]`, `levelM..topM`, `z[0..1]`), `tolM = tolerances.collisionM (1e-4)` | `OV.trapViolationsAt` (OV:277-283), `tolM = 1e-3` |
| Зони/хости | `draftTrapFacts({pack, countertop:{box, traps}, neighbours, candidate})` → `trapKeepOutZones` + `trapHostIds` (`cabinet-placement/adapters/draft-placement-facts.mjs:9-16, 36`) | `countertopTrapViolations` (TK:54-59) |
| Спільне | Ті самі функції TK. Обидва джерела беруть `traps` зі стану адаптера CT (`getState().traps`; коментар `draft-placement-facts.mjs:27`: «the top's box and sink traps (adapter state)») | |
| Окремо в CT | coverage, basin edge, landing, height, length, vertical lock. Їх немає в placement kernel | |

Rules manifest: HR-PL-06 «діє і при перетягуванні CT (червоний overlay, snap back)» (`docs/rules-manifest.md:32`); HR-CT-01…07 (`docs/rules-manifest.md:61-67`).

---

## 5. Сценарії «валідна → невалідна → що бачить користувач»

1. **Release у забороненій позі → snap back.** Guard стає `false` після x = −0.15; drag −0.1 → −0.2; на release CT повертається на −0.1, і саме ця поза комітиться (`tests/node/countertop-manipulation.test.mjs:366`).
2. **API setOffset у невалідну позу.** Піднята CT (y 0.5, x 0.3) → `setOffsetM({x:0.3, y:0})` → `POSE_INVALID`, `reasons:['TRAP_KEEPOUT']`, `rejected.offset.y = 0`; поза, sink owner/shift, позиція раковини і snapshot не змінюються. З `validation:'skip'` поза застосовується, `validation = {status:'invalid', reasons:['TRAP_KEEPOUT']}`, приходить подія `'validation'` (`countertop-resize-from.test.mjs:421`).
3. **Невалідний resizeFrom.** Відновлюються offset, довжина і sink shift (`countertop-resize-from.test.mjs:453`).
4. **Cut-out 5 см від торця відсунутої CT.** Кадр `status:'colliding'`, `reasons:['BASIN_EDGE_TOO_CLOSE']`, `canApply:false`, `dragGuard() === false`; прев'ю на 10 см далі стає `clear`; приєднана CT дає `clear` і guard `null` (`countertop-drag-overlay.test.mjs:184`).
5. **Опускання CT, коли cut-out над краєм SB.** Cut-out [0.35, 0.55] перетинає край SB 0.4 → `SINK_LANDING_GAP`, раковина лишається на CT (`countertop-sink-together.test.mjs:29`). Якщо ж CT лягає на край SB, а раковина поза рядом, це `DETACHED`, валідно (`countertop-sink-together.test.mjs:18`).
6. **Lowered remote.** Над тумбою (y −0.109) → `COUNTERTOP_BELOW_COVER`; урівень з корпусом без покриття → ок; при покритті 2 см урівень з корпусом → червоне; на +2 см → ок (`countertop-lowered-remote.test.mjs:39`).
7. **Vertical lock.** `setOffsetM({x:0.1, y:0.3})` → `COUNTERTOP_VERTICAL_LOCKED`, поза не змінюється; X дозволено; pointer не піднімає (`countertop-manipulation.test.mjs:390`).
8. **Box-колізія.** CT, що лежить на тумбі, `clear` навіть при `unknown`-спостереженні; CT, засунута в тумбу, червона, блокує Apply й обводить тумбу; прев'ю довжини в тумбу дає червоний ghost (`countertop-overlay-box-collision.test.mjs:61, 71, 91`).
9. Інше: P3 посадка `fits`/`gap` (`countertop-resize-from.test.mjs:537`); pending-кандидат має лишатися покритим (`:562`); snap back після відхиленого опускання зберігає раковину на CT (`:392`); межі ресайзу per side (`:502`); hosted trap не звільняє нікого (`countertop-hosted-sink-cutters.test.mjs:209`); юніт-тести TK у `tests/node/trap-keepout.test.mjs`; coverage/margin у `countertop-resize-bounds.test.mjs:55, 78`.

---

## 6. Інваріанти і пастки
- **Restore і rebase ніколи не відхиляються.** Restore пише позу і емітить `'restored'` без guard (AD:1220-1240); `rebase()` теж без guard (SP:≈260-266, AD:981, AD:1051). Внутрішні snap-и (`_snapHome`, `_snapLanding`) ідуть з `validation:'skip'` (AD:≈852, ≈871).
- **Приєднана CT завжди `valid`** (AD:387), тому `resetOffset` (bypass, guard) не відхиляється.
- **Відхилений `setOffset` емітить `'move'` (і, можливо, `'validation'`) для невалідної пози до revert, а потім ще раз на revert** (SP:219-222 + AD:178 + AD:1630-1632). Snapshot при цьому не змінюється, бо commit іде після guard.
- **Відхилений `resizeFrom` уже записав snapshot**, revert перезаписує його назад і емітить `'length'` перед throw (AD:≈548-583).
- **Validation мемоізовано на позу** (generation|offset|length|owner|pending) і скидається на кожному не-`validation` `_emitChange` (AD:1626).
- **Зміна статусу породжує вторинну change з reason `'validation'`** (AD:1630-1632). Перша подія, коли `_validationStatus === undefined`, не рахується як зміна.
- **Guard = `null` не дає snap back і не відхиляє API** (SP:204, AD:404). Сюди належать випадки без пакета з `geometry.trap`, приєднана CT, легасі-композиції і помилки validator-а.
- **Раковина вдома (owner `'cabinet'`) додає box SB у coverage**. Раковина на CT додає лише box pending-кандидата (AD:≈653-675).
- **Колізія ніколи не робить позу невалідною** (warning), хоча overlay блокує `canApply`.
- **Тіла-порушники trap обводяться `invalid`** через `collidesWith` (LL:119, OV:95-97).
- Кольори за замовчуванням: `clear '#39D080'`, `colliding '#E5484D'`, `unknown '#39D080'` (`cabinet-placement/adapters/draft-overlay-presentation.mjs:9`). Кадр поза Drag & Drop (selection frame) має `status:'unknown'`, `canApply:false`, без tint/outline (OV:189-198).
- **UI бачить** (PL): `countertop.getState().validation {status, reasons, warnings}`, `sink.landing`, `sink.pending`, `verticalLocked`, `verticalLockViolated`, `traps`; помилки `error.code/reasons/rejected`; кадр `countertopOverlay.on('change', frame)` з полями `{active, status, reasons:[{code, message}], collidesWith, canApply, limits, preview}`; actions `sink-landing` і `sink-lift`.

---

## 7. Не перевірено / суперечності
- `BASIN_CONFLICT` майже недосяжний в overlay: `withCoverage` завжди ставить масив `coverageViolations`, коли box виміряно (OV:306-307), а LL:110 вимагає «не масив». Тож він з'являється лише коли box відсутній, а тоді `withCoverage` повертає вхід без змін. Чи є шлях, де він реально горить, не перевірено.
- `LENGTH_OUT_OF_RANGE` порівнює з `requestedMinM`, а не з `minLengthM` (LL:113). Basin-мінімум покривається лише `BASIN_CONFLICT`/coverage.
- Overlay (`canApply = status !== 'colliding'`) блокує Apply і на `COUNTERTOP_COLLISION`, і на `LENGTH_*`, а guard і API ці позиції пропускають: червоний overlay без snap back. Як UI поводиться на Apply при такому кадрі, не перевірено (UI-репо).
- Guard рахує колізію лише зі spatial-статусу; box-фолбек (ULH) є тільки у візуалах.
- Severity HR-PL-06 у kernel (veto чи warning, `phase`) з `urban.pack.mjs:39-40` не визначено (немає `phase`); дефолтну фазу не читав. Інші пакети (UF/UD/Tricot/ULH) на `geometry.trap` перевірив лише regex-ом в один рядок: знайшовся тільки `urban.pack.mjs`.
- Хто саме передає `countertop: {box, traps}` у `draftPlacementFacts`, не знайдено (grep по `AC/` не дав викликача).
- `readSinkTraps(assembly, pendingCabinetId)` (AD:1768-1787): як саме pending-кандидат змінює `hostCabinetId` сифона, не читав.
- Номери рядків із «≈» оцінено з контексту (вивід без `-n` або з вирізаними порожніми рядками), можливе відхилення ±3.
- `docs/countertop-collisions.md:185` описує `validation: { state:'valid', issues:[] }` у persisted-снапшоті колізій. Це інша структура, ніж `getState().validation {status, reasons, warnings}`, і зв'язок між ними не перевірено.
- У HR-CT-01 (`docs/rules-manifest.md:61`) сказано «−2 см…+5 мм від низу CT». У коді для SB-раковини еталоном є `hostSB.maxY`, а від низу CT при resting (`top.minY − offset.y`) рахується лише для hosted-раковини (AD:≈729).
