# Стільниця — drag-and-drop і spatial-manipulation (scope `playcanvas` › `dnd`)

Читай разом із `contract.md`. Коли сюди: жест pointer → поза, `countertop.manipulable.mjs` (осі, снап-правила, колізія), `countertop-spatial.mjs` (register, canDrag, finish, vertical lock), snap-цілі, колізійні профілі, ручки ресайзу (`lengthAtPointer`, `previewLength`), settle/rebase, пастки рушія. Хто вирішує «червоне» → `playcanvas-validation.md`; як рахується offset/довжина → `playcanvas-positioning.md`.

## Сценарії
- **CT не тягнеться** → `canDrag`: `!legacySuspended && dragEnabled && isSelected()` (+ `hasMutationGuard`); `setDragEnabled(true)` викликає `assertMutable`; поріг 6 px; ownership gate.
- **Не снапить / снапить не туди** → `countertop-snap-targets.mjs`: тіла з **цілим** `orderIndex` (group-edge панелі ±0.5 відкидаються); правила і пріоритети в `countertop.manipulable.mjs:60–76`; `x-side-abut-*` лише при замороженому v; API-рух не снапить.
- **Застаріла поза / «runaway»** → `syncEntityWorld` (stale матриця нащадка), `rebase` відкладається під жестом, `invalidate` пріоритетніший за rebase при flush.
- **Ручка дає не ту довжину** → `lengthAtPointer` → `snapCountertopLengthM` (краї лише тумб; 0.1″; 1″; clamp переважає) → `resizeFrom` на release.
- **Esc під час drag комітить** → `gesturecancel` і `gestureend` ведуть у той самий `finish` (snap back лише якщо guard = false).

## Інваріанти
- Стільниця — декларативна спека; input/проєкцію/снап/колізію/запис пози робить рушій; host дає `fixedZ`, `transformTargets` (CT + мийки + cutters), `pickEntities`, `beforeCapture` (база з layout).
- Один instance на binding generation (`countertop:<productId>:<generation>`), старий знищується з `restoreStandard:false`.
- Collision — observe, не блок; `against` = тумби + side panels (включно з joint-смугою); ULH-тумби без профілю → `unknown` → overlay міряє box сам (tol 1 мм).
- `setMotion` під жестом → BUSY → `_axesStale`, застосовується у `finish`.
- `whenSettled` = FIFO + jobs; `endSettle` спершу чекає `beforeRemeasure` (CSG/довжина), потім `world.invalidate`.
- Sweep (`node tests/sweep-report.mjs`) рухає через API — pointer-жест і semantic snap ним не покриті; снап — goldens (`spatial-manipulation-goldens.test.mjs`).

---

# Стільниця і drag-and-drop: `spatial-manipulation` (V2)

Репо `playcanvas-hasting`, гілка `feture/part-2`. `AC/` = `src/Scripts/app-configuration/`, `SM/` = `AC/domain/spatial-manipulation/`, `CT/` = `AC/domain/countertop/`. Тести лежать у `src/tests/`.
Базу та API, режими позиціонування (offset, довжина) і коди причин валідації описують інші references. Тут на них лише посилання.

---

## 1. Архітектура spatial-manipulation (V2)

**Шари** (`SM/docs/ARCHITECTURE.md:13`, `SM/README.md`):
- `core/`: чисті алгоритми без рушія й DOM. Тут `contracts/` (constants, errors, validators), `motion/` (frame, grid, bounds, planner, axis-intent, ray-plane), `snapping/` (candidates, latch, resolver), `collision/` (aabb, observation, proxies).
- `spec/`: `defineManipulable`, selectors (`tag`, `any`, `all`, `not`, `envelope`), extractors (`edges`, `corners`, joints), compiler.
- `runtime/`: World (`world.mjs`), instance, рознесений по `instance-{gesture,motion,snap,geometry,support}.mjs`, FIFO (`queue.mjs`), `jobs.mjs`, `lifecycle.mjs`, `pose-driver.mjs`, `coordination/` (registry, leases, hierarchy).
- `playcanvas/`: адаптери `input.mjs` (router), `projection.mjs`, `scene-measure.mjs`, `entity-group-pose.mjs`, `snap-guides.mjs`, `gesture-ownership.mjs`, `hierarchy.mjs`, `world.mjs`. `index.mjs` не імпортує `playcanvas/`, а `playcanvas/index.mjs` публікує адаптер (`ARCHITECTURE.md:13`).

**Конвеєр одного pointer-sample** (`ARCHITECTURE.md:15-35`): `input.mjs` → `projection.sample()` → `instance.updateGesture()` → `resolveGestureAxes()` (Alt) → `GeometryPort.readSnapSnapshot()` → `resolveSnapV1()` + latch → `createMotionPlanV1()` у порядку **axis-freeze → semantic-snap → grid → bounds** (`core/motion/planner.mjs:280/282/298/314`) → `PosePort.apply()` → `driver.write()` → collision snapshot → AABB verdict → подія `motionapplied` → handle `change`/`collision` + guides.

**Ключові сутності** (`SM/docs/GLOSSARY.md`):
- Frame: `originM`, `uAxis`/`vAxis`, `normal`, `frameRevision` (`GLOSSARY.md:7`).
- `offsetM {u,v}` — зсув від base/standard pose, а не абсолютна позиція (`:8-9`). `rebase()` захоплює нову базу, `suspend()` тимчасово знімає зсув (`:9`).
- Binding / `bindingGeneration` (`:10`), policy / `policyRevision` (`:11`), feature/role (`:12`), pair rule `align-u|align-v|coincide-uv` (`:13`), latch (`:14`), bundle (`:15`), envelope (`:16`), proxy strategy (`:18`), `observe` (`:19`), fail-closed/pending (`:20`), `SUPERSEDED`/`STALE_*`/`BUSY` (`:21`).

**Ревізії** (`ARCHITECTURE.md:41-49`):

| Маркер | Що робить |
|---|---|
| `bindingGeneration` | не дає позі чи геометрії перейти до нового binding |
| `policyRevision` | патч frame/motion/profile робить жест stale, а jobs — superseded |
| `poseRevision` | росте лише тоді, коли offset справді змінився |
| `frameRevision` | інвалідує старий frame |
| `sourceGeometryRevision`, `targetSceneRevision` | ростуть на `invalidate` |
| `membershipRevision`, `queryRevision` | ростуть на `refreshMembership` |
| `projectionRevision` | перебазовує anchor без запису пози |

**Відкладення під жестом**: `invalidate`, `refreshMembership` і `rebasePose` відкладаються (`runtime/world.mjs:313-366`). Під час flush `invalidate` має пріоритет над rebase і membership (`world.mjs:361-364`). Core відхиляє refresh захопленої геометрії під жестом (`ARCHITECTURE.md:59`). `whenSettled()` чекає watermark прийнятих команд FIFO і jobs (`ARCHITECTURE.md:59`, `RULINGS.md:36` ADR-0005).

**Handle API** (`runtime/world.mjs`):
- реєстрація `register(spec, { body, host, id, canDrag })` (`:141`);
- події `change, collision, snap, gesturestart, gestureend, gesturecancel, error` (`:37`);
- payload `change`: `{ source, offsetM, snap, collision, state }`, де `offsetM` береться з `state.applied.offsetM` (`:370-379`);
- `collision` приходить лише тоді, коли змінився `verdict.status` (`:380-384`);
- `setOffset(offsetM, { constraint: 'respect'|'bypass' })` (`:441-444`), `moveBy` (`:446`), `reset` — завжди bypass (`:450`), `setMotion` (`:453`), `refreshMembership` (`:468`), `rebasePose` (`:475`), `suspendPose` (`:489`), `invalidate` (`:495`), `whenSettled` (`:500`);
- `world.invalidate` і `world.whenSettled` діють на всі handles (`:536-542`).

**Consumers**:
1. Стільниця: `CT/spatial/countertop-spatial.mjs` + `countertop.manipulable.mjs`.
2. Модулі (тумби): `AC/domain/composition/spatial/composition-modules.mjs` + `module.manipulable.mjs`.
3. Draft-тумба при розміщенні: `AC/domain/cabinet-placement/adapters/cabinet-draft-drag-adapter.mjs:208`, `canDrag` активний лише в lifecycle `'preview'`.

Спільний World і scene живуть у `AC/domain/composition/spatial/composition-spatial.mjs:51-68`: `getSpatialWorld` + `createCompositionScene`.

---

## 2. Реєстрація стільниці

**Спека** `CT/spatial/countertop.manipulable.mjs`:
- `id: 'countertop'` (`:21`).
- Frame: `plane: 'xy'`, `z = host.fixedZ` (`:87`), u = world X, v = world Y (`:4`).
- `motion.axes: ['u','v']` (`:88`). Grid і bounds у спеці **не задані**.
- `target` (`:89-97`):
  - `entities` = `host.transformTargets()`, тобто top, мийки й катери з assembly;
  - `pick` = `host.pickEntities()`, тобто корінь стільниці;
  - `pose` = `createEntityGroupPose({ frame: X/Y, resolveTargets, beforeCapture })`.
- Snapping: features `self` (власні фічі `ct.*`, `:33-47`) і `composition` (`select: structure`, `extract: compositionSnapTargets`, `:98-104`).
  - `structure = any(tag('cabinet'), tag('side-panel'))` (`:83`). Joint-смуга (`side-panel-joint`) **не виключена**, на відміну від модулів (`module.manipulable.mjs:32`).
  - `thresholds` не задані, тому діють дефолти (`SM/spec/define.mjs:21-22`): mouse `{ engagePx 8, releasePx 14, switchMarginPx 2, tieEpsilonPx 0.5 }`, touch `{ 12, 22, 2, 0.5 }`.
- Collision (`:105-110`): `source: () => topSolid profile` (`:82`), `against: structure`, `volumes: hastingCollisionProfileFor`, `roles: HASTING_OBSTACLE_ROLES`. `epsilonM` **не задано**, а в модулів він `1e-4` (`module.manipulable.mjs:51`).

**Власні фічі `ct.*`** (`:37-45`):
- осі `ct-left`, `ct-center-x`, `ct-right` (u) і `ct-bottom`, `ct-top` (v);
- точки `ct-corner-{left,right}-{top,bottom}`.

**Реєстрація** `CT/spatial/countertop-spatial.mjs`:
- `register(binding)` (`:152`) будує `host` (`:157-175`):
  - `fixedZ` = z кореня стільниці (`:158`);
  - `transformTargets` = `assembly.transformTargets[].entity` (`:159`);
  - `pickEntities` = `[root]` (`:160`);
  - `coverThicknessM` (`:161`);
  - `beforeCapture` перед захопленням бази ставить `root.setLocalPosition(base.x, base.y, local.z)` + `syncHierarchy` (`:163-174`), бо layout володіє X/Y, а drag — тільки offset.
- `world.register(countertopManipulable, { body: productId, host, id: 'countertop:<productId>:<generation>', canDrag })` (`:176-182`). На кожну binding generation створюється окремий instance (`:179`).
- `canDrag: () => !legacySuspended && dragEnabled && isSelected()` (`:181`). Аргументи `{ phase, handle }` (`SM/playcanvas/world.mjs:89`) стільниця **ігнорує**.
  - Фази перевіряє сам router (`SM/playcanvas/input.mjs:466-471`). `binding.readiness === 'ready'` обов'язкова завжди. `'contact'` вимагає lifecycle `ready`, а `'drag'` — `ready|gesturing`.
  - У адаптері `isSelected = !composition.hasMutationGuard() && _isSelected()` (`CT/adapters/countertop-composition-adapter.mjs:1200`).
- Застарілий binding одразу знищується з `restoreStandard: false` (`:185-188`).
- `savedOffsetM` відновлюється через `handle.setOffset(..., { constraint: 'bypass' })` + `whenSettled` (`:190-193`). Це `SpatialOffsetM` зі snapshot (`adapter:1198`, `composition-spatial.mjs:15,23-26`).
- Вертикальний lock (`:89-107`): `setVerticalLocked(true)` → `handle.setMotion({ axes: ['u'] })`, і planner заморожує v (axis-freeze). Lock **не** залежить від `canDrag`/`contact`, це явний UI-режим (`bridge/plugins/countertop.plugin.mjs:8-10`, `adapter:441-450`).
  - Під жестом `setMotion` дає BUSY, тому виставляється `_axesStale` (`:103-105`) і lock застосовується у `finish` (`:213-214`).
  - `setOffsetM` на час власного запису тимчасово розширює осі до `['u','v']` (`:251,256`).
- Підписки (`:218-237`):
  - `change` → `afterPose()` (`_poseSinkM`) → `onChange('drag'|'move')`. Під жестом, якщо `dragGuard !== false`, запам'ятовуються `_lastValidOffsetM` і `_lastValidSinkM`.
  - `collision` → `onChange('collision')`.
  - `gesturestart` → `_dragging = true`, lastValid = поточний offset, плюс стан мийки.
  - `gestureend` і `gesturecancel` → обидва ведуть у **той самий** `finish`.
- `finish` (`:197-217`): якщо guard каже `false` і є `lastValid`, викликається `restoreSink(backSink)` → `setOffset(back, bypass)` → `whenSettled`. Потім `_applyAxes` (якщо stale) → `onCommit(getOffsetM())` → `onChange('drag-end')`.
- `afterPose` у адаптері (`adapter:1209-1213`) = `_placeSinks('drag')`, повертає `{ owner, shiftM, landing, pending }`. `restoreSink` описаний у `adapter:1214-1220`, `onCommit` → `_commitOffset` у `adapter:1205-1208,1245-1259`.
- Participant `beforeRemeasure: whenGeometrySettled` (`:40`) → `adapter._whenAllGeometrySettled()` (`adapter:164-166`).
- `release()` → `handle.destroy({ restoreStandard: false })` (`:269-281`). `suspendLegacy()` блокує writer кодом `LEGACY_WRITERS_BUSY` (`:61-77`).

---

## 3. Жест: від pointer до пози; різниця з API

**Pointer-жест:**
1. **pointerdown.** `findRegistrationAt` → `hitTest` (`input.mjs:483`). Дефолтний hit test: ціль select tool у точці є pick-entity або її нащадком (`playcanvas/world.mjs:13-14,88`). Далі eligibility `'contact'` → `canDrag`. Router резервує ownership з owner `spatial-manipulation:<instanceId>` (`input.mjs:7-10`), камера й SelectTool блокуються через `blocksCamera`/`blocksSelection` (`:168-169`).
2. **Поріг.** Після 6 CSS px (`input.mjs:133`, mouse `:604`, touch `:699`) → `beginGesture` (`:400`) → `gesturestart` (`world.mjs:400`) → `CountertopSpatial`: `_dragging = true`, `lastValid` (`countertop-spatial.mjs:229-234`).
3. **move.** Samples коалесуються до одного in-flight `updateGesture` (`input.mjs:19,315`). Потім snap candidates → latch → plan → pose write → collision observe (див. §1).
   - Alt (mouse) обирає вісь у core (`RULINGS.md:8` R2, `input.mjs:539,740`). Touch завжди вільний по осях.
   - Зміна проєкції або камери перебазовує anchor без запису пози (`input.mjs:17,348-351`).
   - Bounds-корекція перебазовує лише свою вісь (`RULINGS.md:22` AC-06).
4. **Публікація.** `motionapplied` → `renderGuides` + `change` (+ `collision`) (`world.mjs:387-396`) → `afterPose` → `_placeSinks('drag')` → adapter `change` → drag overlay `sync` (підписка `countertop-drag-overlay.mjs:123`). Overlay також оновлюється на `app 'update'` (`:368-371,377`).
5. **pointerup.** `endGesture` (`input.mjs:427`) → `gestureend`: guides очищуються, виконується `flushDeferred` (`world.mjs:401-405`) → `finish` (snap back / commit, §2).
6. **Скасування.** Escape, window blur і touchcancel ведуть у `cancelGesture` (`input.mjs:16,733,736,451`) → `gesturecancel` → **той самий `finish`**, тобто commit поточного offset, якщо guard не `false`. Другий дотик завершує drag на applied offset (`input.mjs:12-13`).
7. **Settle.** Відкладені `invalidate` / `rebase` / `membership` виконуються після кінця жесту (`world.mjs:357-365`).

**API-рух** (`countertop.setOffset` → `adapter.setOffsetM`, `adapter:453-475`):
- Перевіряється vertical lock: підйом вище `COUNTERTOP_REST_TOLERANCE_M` дає `VERTICAL_LOCKED` (`:458-460`).
- Далі `CountertopSpatial.setOffsetM` → `handle.setOffset({u,v}, { constraint })` → `instance.setOffsetM(..., { constraintMode })` (`world.mjs:442-444`). Це **не жест**: semantic snap не застосовується (`countertop.plugin.mjs:7`). Planner з `'respect'` застосовує лише grid і bounds (`planner.mjs:298,314`), а в спеці стільниці їх немає.
- Після запису: `whenSettled` → guard `_rejectInvalidPose` (revert через bypass, помилка `POSE_INVALID`, `adapter:406-407,465-468`) → `_commitOffset` → `whenSettled` → `_snapHome` → `_announceSinkLift`.
- `resetOffset` = `setOffsetM({0,0}, bypass)` (`:477-479`).
- Snap home після restore реєструється як `_trackOperation(this._snapHome())` (`adapter:1239`).

**rebase.**
- `CountertopSpatial.rebase()` → `handle.rebasePose()` (відкладається під drag, `world.mjs:475-484`) → `driver.rebase` → `beforeCapture` (база з layout) → offset застосовується знову. Після цього виконується `afterPose()` (`countertop-spatial.mjs:262-266`).
- Викликається з адаптера після перекладки layout (`adapter:981,1051`).
- `world.invalidate` теж викликає `driver.rebase()` (`world.mjs:327`).

**Settle композиції** (`composition-spatial.mjs`):
- `invalidate` під settle лише ставить `_dirty` (`:90-97`). `beginSettle` описаний у `:99-104`.
- `endSettle` чекає `beforeRemeasure` усіх participants (стільниця: booleans і довжина), потім виконує `_remeasure('composition-settled')` → `world.invalidate` → `afterRemeasure` (`:106-111,129-136`).
- `composition-manager.mjs`:
  - `_invalidateSpatial` (`:729-736`) пропускає зміни, що не є `isCountertopCollisionGeometryChange` (`:730`); з `holdUntilAggregation` викликає `beginSettle`;
  - hooks обгортають aggregator: `onProductChanged`, `onCompositionStructureChanged`, `recalculateAll` (`:738-781`);
  - якщо агрегація вже в черзі, викликається `invalidate` + `scheduleSpatialSettleRelease` (`:750-757`);
  - `abortSettle` спрацьовує після збою (`:788-792`).
- `whenSettled`:
  - handle: FIFO + jobs (`world.mjs:500`);
  - plugin: `countertop.whenSettled()` → `adapter.whenSettled()` + `getState()` (`countertop.plugin.mjs:116-119`);
  - manager: чекає `countertopCompositionAdapter.whenSettled()` (`composition-manager.mjs:1880`).

---

## 4. Снап стільниці

**Цілі** генерує `CT/spatial/countertop-snap-targets.mjs`, функція `compositionSnapTargets(bodies, ctx)`, `perBody = false` (`:25,83`):
- Елемент = cabinet або side panel. Тіла **без цілого `meta.orderIndex` відкидаються** (`:40`).
- `composition:left|centerX|right`, ролі `composition-edge-left`, `composition-center`, `composition-edge-right` (`:49-51`). Ліва і права межа рахуються по всіх елементах, бічні панелі теж входять (`:43-44`).
- `<cabinet|side-panel>:<id>:left|right`, роль `cabinet-edge` / `side-panel-edge` (`:56-57`).
- `cabinet:<id>:centerX` (`cabinet-center`) і `support:<id>:top` (`support-top`, вісь v = верх тумби, `supportIntervalUM`) — **тільки для тумб** (`:58-61`).
- `endpoint:<id>:leftTop|rightTop` (`support-endpoint-left|right`) додається лише для елемента на зовнішньому краю композиції (`:62-69`). `cover-endpoint:*` — та сама точка + `host.coverThicknessM()`, тільки для тумби і тільки при `cover > 0` (`:64,68`).
- `joint:<a>|<b>` (`module-joint`) — стики сусідніх тумб за `orderIndex`, якщо `|a.right − b.left| ≤ 1e-9` (`:72-80`).

**Правила** (`countertop.manipulable.mjs:60-76`). Пріоритети: нижче число виграє серед рівних відстаней (`:53`): `sideAbut 0, compositionEdge 0, moduleJoint 1, compositionCenter 2, edge 3, supportTop 3, cabinetCenter 4`.

| id | from → to | op | prio | умова |
|---|---|---|---|---|
| `x-composition-edge-left/right` | `ct-left/right` → `composition-edge-left/right` | align-u | 0 | — |
| `x-composition-center` | `ct-center-x` → `composition-center` | align-u | 2 | — |
| `x-module-joint` | `ct-left`, `ct-right` → `module-joint` | align-u | 1 | — |
| `x-edge` | `ct-left`, `ct-right` → `cabinet-edge`, `side-panel-edge` | align-u | 3 | декартів добуток пар (`KNOWN-ISSUES.md:7`) |
| `x-cabinet-center` | `ct-center-x` → `cabinet-center` | align-u | 4 | — |
| `x-side-abut-left/right` | `ct-left` → `support-endpoint-right` / `ct-right` → `support-endpoint-left` | align-u | 0 | `when: 'abut-u'`, `onlyWhenFrozen: 'v'` (тільки при замороженому Y) |
| `y-support-top` | `ct-bottom` → `support-top` | align-v | 3 | `when: 'overlap-u'`, ε `1e-9` |
| `xy-side-abut-left/right` | кути `ct` → `support-endpoint-*` | coincide-uv | 0 | `abut-u`, bundle `SIDE_ABUT` |
| `xy-cover-abut-left/right` | `ct-corner-*-top` → `cover-endpoint-*` | coincide-uv | 0 | опущена Remote-стільниця до кута кришки (`:72`) |

- Bundle `SIDE_ABUT` (`:54-58`): `compatible` = composition-edge, `x-edge`, `x-side-abut-*`; `retainOverProjection: true`.
- Правил «підлога» чи «rest» у спеці **немає**. «Rest» — це допуск адаптера `COUNTERTOP_REST_TOLERANCE_M` для vertical lock (`adapter:458`). У модулів підлога є: `v-floor` → `row.v.min` (`module.manipulable.mjs:44`).
- Tolerances задаються в CSS px за дефолтами `define.mjs:21-22` (§2). Selector спершу бере найближчого кандидата, при tie вирішує priority. Latch тримає snap до `releasePx` (`GLOSSARY.md:14`).
- Фінальні snap pairs перед очищенням latch переоцінюються на збереженій applied pose (`RULINGS.md:26` AC-18).
- Семантично притягнута вісь не округлюється сіткою (`ARCHITECTURE.md:37`).

**Виключення з вимірювання** (катери, мийки, ручки):
- `DEFAULT_EXCLUDED_NODE_FRAGMENTS` = `Sink_Point, SinkPoint, BoolCut, Cutter, cutter, Siphon, siphon, collision, Collision, proxy, Proxy, Helper, helper` (`SM/playcanvas/scene-measure.mjs:286-289`).
- До них додаються `registry.getAabbIgnoreNodesByEntity(productId)` (`composition-scene.mjs:50-53`), які передаються як `meta.measure.excludeNameFragments` (`:83`).
- Стільниця вимірюється лише по мешу `TopSolid` (`measureEntity`, `composition-scene.mjs:85-86`). Тілом стільниці стає тільки `basinTop` role.

**Тіла сцени** (`composition-scene.mjs:61-121`):
- cabinets: `tags: ['cabinet']`, `orderIndex` з порядку (`:87-90`);
- side panels: `['side-panel', 'side-panel-left|right']`, плюс `side-panel-joint` при `SidePanelFace === 'joint'` (`:91-99`);
- grouped-панель (`SidePanelLayout === 'group-edge'`) отримує `orderIndex = order[anchor] ± 0.5` (`:100-105`);
- legacy-панелі отримують цілі індекси поза рядом (`:110-117`).

**`lastValidPose`** — поле `_lastValidOffsetM`/`_lastValidSinkM` у `countertop-spatial.mjs` (`:35-36,223-226,231-232`). Його виставляє `change` під жестом, поки guard не `false`. Використовується у `finish` для snap back.

**Снап мийки після опускання**: `_snapHome` (`adapter:1239,472`), деталі — у reference позиціонування.

---

## 5. Колізії

**Профілі** (`AC/domain/composition/spatial/hasting-collision-profiles.mjs`):

| profile | kind | productTypes / template / entity | proxy |
|---|---|---|---|
| `top-solid/v1` (`:47-58`) | moving-volume | template `Top_Solid`, entity `TopSolid` | `single-box`, role `countertop-moving-volume` |
| `cabinet-uni-body/v1` (`:59-80`) | obstacle | `CabinetUniBox`, `Sink-Base`, `Sink-Cabinet` | `opposed-boundary-slabs` по x, roles `cabinet-side-left/right`, перевірка топології |
| `uni-open-shelves/v1` (`:81-94`) | obstacle | `UniOpenShelves`, `Open-Shelf` | `component-boxes` (2) |
| `side-panel-left/right/v1` (`:95-122`) | obstacle | `SidePanel_*`, `ULH-SidePanel_*`, `Tricot-SidePanel_*` | `active-member-union` `_Panel` [1,1], `_Inlay` [0,1], без `_Overlay` |
| `uf-side-panel-left/right/v1` (`:123-138`) | obstacle | `UF-SidePanel_*` | `active-member-union` `_Panel_{Bot,Full,Top}`, `_Inlay_{Bot,Top}` |
| `uni-open-side-shelves/unsupported-v1` (`:141-153`) | unsupported | `UniOpenSideShelves`, `Side-Shelf` | — |

- `resolveHastingCollisionProfile({ role: 'countertop' })` завжди повертає `topSolid` (`:200-202`). Невідомий тип стає `unsupported`, `PROFILE_NOT_FOUND` (`:218-227`). Цілого тіла як fallback немає (`:5`).
- `hastingCollisionProfileFor(body)` бере `meta.productType/templateName/entityName` (`:235-245`).
- `HASTING_OBSTACLE_ROLES` (`:165-169`).

**Стільниця.** `against = cabinet | side-panel`, включно з joint-смугою (§2). Collision тільки **observe**: рух застосовується до вердикту, блокування немає (`ARCHITECTURE.md:9`, `GLOSSARY.md:19`). AABB повернутого тіла може дати хибне `colliding` (`KNOWN-ISSUES.md:11`). Одне невиміряне тіло переводить запит у `pending` (`KNOWN-ISSUES.md:10`).

**Модулі для порівняння.** `source = hastingCollisionProfileFor` (той самий resolver), `epsilonM: 1e-4` (`module.manipulable.mjs:49-56`).

**ULH-тумби.** `ULH-sink-cabinet`, `ULH-side-cabinet`, `ULH-Open-Shelf` (тест-фікстура `tests/node/helpers/countertop-sweep-fixture.mjs:15`) не мають verified профілю, тож статус `unknown`. Тоді overlay сам перевіряє box проти box тумб і панелей з допуском `COUNTERTOP_BOX_COLLISION_TOLERANCE_M = 1e-3` (`countertop-drag-overlay.mjs:40,259-271`).

**Хто за що відповідає:**
- Spatial collision дає `status` і `collidesWith` (`countertop-spatial.mjs:123-126` через `collidingObjectIds`).
- Drag overlay:
  - outline `editing`/`invalid`; сусідів, з якими є колізія, теж позначає `invalid` (`:90-101`);
  - tint green/red (`:103-114`);
  - `canApply = status !== 'colliding'` (`:213`).
- `dragGuard.evaluate()` (`:311-335`) повертає `{ valid, reasons, warnings }`. **Колізія лише `warnings`** (`:319`), а `valid=false` дають trap keep-out, coverage, landing і height. Коди причин описані у reference валідації.
- Plugin прив'язує guard до адаптера: `setDragGuard(overlay.dragGuard)` + `setPoseValidator(overlay.dragGuard.evaluate)`. Прив'язка працює і при вимкнених візуалах (`countertop.plugin.mjs:175-180`).
- Через це release у колізії **не** відкочується, а release у trap/coverage відкочується (snap back, §2).

---

## 6. Ресайз ручками

**API.** `countertop.resizeFrom(side, lengthM, { validation })` → `adapter.resizeFromM` (`countertop.plugin.mjs:107`, `adapter:514-580`):
- `nextLengthM = clamp(lengthM, _resizeBoundsM()[side] ?? lengthLimits)` (`:528`);
- центр зсувається на `±halfDelta`, щоб протилежний кінець лишився на місці при симетричному SmartStretch (`:535-536`);
- точне потрапляння в стандартну позу зсувається на `2·COUNTERTOP_ATTACHED_EPSILON_M`, щоб довжина не скинулась (`:539`);
- піднята мийка лишається у світі: `_sinkShiftM -= Δx` (`:540-542`);
- далі `spatial.setOffsetM(target, bypass)` → `_placeSinks('resize')` → один snapshot patch (offset + length + sink shift) → `_syncLength` → `_scheduleCollisionRefreshAfter(operation)` або `_refreshSinkCutouts` (`:545-562`);
- guard на застосованій довжині, з revert (`:566-580`);
- attached-стільницю теж можна ресайзити (HR-CT-04, `:524-525`).

**Overlay** (`countertop-drag-overlay.mjs`, `window.ConfiguratorAPI.countertopOverlay`):
- `previewLength({ side, lengthM } | null)` — ghost-рамка, сцена не змінюється. Працює лише при `active` (`:410-418`). `previewBox` рухає лише кінець `side` (`:165`). Кадр із preview переоцінюється з `size.length = preview.lengthM` (`:204-208`).
- `lengthAtPointer(side, point, { snap })` (`:336-356`):
  - point у frame px → промінь камери → `lineXAtRay` на лінії X через центр Y і передню грань;
  - якір — протилежний кінець (`right` → `minX`, `left` → `maxX`);
  - `snapCountertopLengthM` з `edgeTargets` лише від **тумб** (`cabinetBoxes()`, `:255-257`) і лімітами `state.resizeBoundsM[side] ?? lengthLimitsM`;
  - повертає `{ lengthM, rawLengthM, snappedTo, limits }`; `null`, якщо overlay неактивний.
- `setActive` (`:399-407`), dimension lines приглушуються (`:383-385`). Кнопка edit-size з `countertop-edit-overlay.mjs` ховається, коли overlay активний або після `setEditSizeButtonEnabled(false)` (`:386-394,434-439`). Edit overlay створює адаптер (`adapter:1650`).

**Математика** `CT/countertop-resize-snap.mjs`:
- Крок `0.1″` (`COUNTERTOP_RESIZE_STEP_M`), допуск прилипання `1″` (`:10-12`).
- Пріоритет `composition-edge > cabinet-edge > limit-min > limit-max > basin-min` (`:15`). Кандидати: краї тумб і композиції (`:68-83`) + довжини лімітів і `basinMinLengthM` (`:101-104`).
- Спершу обирається найближчий, при рівності — за priority. Якщо цілі немає, довжина округлюється до кроку (`:105-115`). Clamp до `[min,max]` має пріоритет і переписує `snappedTo` на `limit-*` (`:117-124`). Результат округлюється до 1e-6 (`:125`).
- `lineXAtRay` / `closestPointOnLineToRay` безпечні при перспективній проєкції (`:27-49`).

**`isDragEnabled`** = `adapter.dragEnabled` = `CountertopSpatial.dragEnabled && !legacySuspended` (`countertop.plugin.mjs:85`, `adapter:430-432`, `countertop-spatial.mjs:53-55`).
- `setDragEnabled(true)` викликає `composition.assertMutable()` (`adapter:435-439`).
- Writer, призупинений legacy-шляхом, кидає `LEGACY_WRITERS_BUSY` (`countertop-spatial.mjs:109-110`).
- Окремого вимкнення drag для «модульного режиму» в цих файлах не знайдено. `canDrag` вимикає drag при mutation guard (`adapter:1200`). У модулів `canDrag` теж перевіряє `hasMutationGuard` (`composition-modules.mjs:255`).

---

## 7. Пастки рушія (з коду й коментарів)

- **`syncEntityWorld`** (`SM/playcanvas/scene-measure.mjs:33-45`). Голий `entity.syncHierarchy()` на нащадку, поки предок dirty (корінь стільниці щойно зрушив drag), кешує застарілу матрицю. Піддерево лишається stale, доки предок знову не рухнеться, і навіть `app.root.syncHierarchy()` цього не лагодить. Тому спершу викликається `getWorldTransform()`. Використовується в `measureEntityBoundsM` (`:302`), `CT/countertop-length-limits.mjs:137` і `CT/adapters/countertop-dimension-adapter.mjs:56`.
- **AABB з катерами, мийками, ручками.** Список виключень `DEFAULT_EXCLUDED_NODE_FRAGMENTS` + `aabbIgnoreNodes` реєстру (§4). Коментар у `AC/domain/composition/rules/RuleSidePanels.mjs:100`: мийка й ручки не повинні зсувати панелі.
- **CSG підміняє mesh.** Overlay порівнює список мешів і перепідключає tint (`countertop-drag-overlay.mjs:108-112`). Відносний box overlay міряється один раз (`ensureRelative`), далі зсувається з позицією кореня (`:154-163`).
- **`waitForFrames`** у правилах: `RuleSidePanels.mjs:95,228` (2 кадри), `RuleCountertopBooleanCutouts.mjs:122` (1 кадр). У самому DnD-шляху не використовується.
- **Порядок settle → collision refresh.**
  - `endSettle` спершу чекає `beforeRemeasure` (geometry barrier стільниці), а вже потім `world.invalidate` (`composition-spatial.mjs:106-111`).
  - Після зміни довжини адаптер окремо викликає `_scheduleCollisionRefreshAfter(operation, generation)` (`adapter:559,577,1232`).
  - Під жестом `invalidate` відкладається до кінця (`world.mjs:352-365`).
- **Зміна policy під жестом.** `setMotion` під жестом повертає `SPATIAL_BUSY`, і фасад це приглушує (`KNOWN-ISSUES.md:12`). Відомий баг: `handle.getState().motion` розходиться з core (`KNOWN-ISSUES.md:14`). Стільниця обходить це через `_axesStale` (§2).
- **`bounds` відносні до base pose** (`KNOWN-ISSUES.md:9`). Pose пише лише трансляцію, rotation не підтримується (`KNOWN-ISSUES.md:13`).
- **Легасі-власник вводу `countertop-drag`** враховується тим самим ownership gate (`input.mjs:9-10`).
- **Синтетичні mouse після touch** пригнічуються (вікно 1000 ms / 25 px, `input.mjs:15`).

---

## 8. Тести та інструменти

- **Модуль.** `src/tests/node/spatial-manipulation-{collision,contracts,coordinator,goldens,lifecycle,motion,multi-instance,playcanvas-adapter,playcanvas-world,presentation,public-entry,runtime,second-consumer,snapping,world}.test.mjs`, а також власні тести модуля: з `AC/domain/` запускати `node --test spatial-manipulation/tests/` (`KNOWN-ISSUES.md:16`).
- **Стільниця.** `tests/node/countertop-manipulation.test.mjs`, `countertop-drag-overlay.test.mjs`, `countertop-resize-from.test.mjs`, `countertop-resize-pointer.test.mjs`, `countertop-resize-bounds.test.mjs`.
- **Goldens.** `tests/node/goldens/`: `countertop-snap-vectors.mjs` (309 р.), `countertop-snap-harness.mjs` (171), `countertop-snap-outcomes.json` (759), `countertop-collision-scenes.mjs` + `countertop-collision-outcomes.json`.
- **Sweep.**
  - Запуск: `node tests/sweep-report.mjs [assembly...]` (`tests/sweep-report.mjs:1-7`). Без аргументів проходить усі `ASSEMBLIES` і друкує markdown-таблицю порушень. У `node:test` обгортка `tests/node/countertop-sink-sweep.test.mjs` перевіряє, що порушень 0 для кожної збірки.
  - Фікстура `tests/node/helpers/countertop-sweep-fixture.mjs`:
    - engine-free `createSpatialWorld` + `playcanvas-stub`;
    - тіла лише `countertop` і `cabinet`, **без side panels** (`:114`), типи ULH (`:15`);
    - рух іде через **API** (`adapter.setOffsetM(..., { constraint: 'bypass', validation: 'skip' })`, `resizeFromM(..., { validation: 'skip' })`), тож pointer-жест і semantic snap **не перевіряються**.
  - 10 збірок `ASSEMBLIES` (`:152-163`): `SB60`, `SB80`, `SB60+SC40`, `SC40+SB60`, `SC40+SB60+SC40`, `SB60+SC60+SB60`, `SB60+OS60`, `SC60+SC60`, `SB60 vessel`, `SB60(wide cut)+SC40`.
  - 18 послідовностей `SEQUENCES` (`:167-186`): `X±0.1`, `X+0.3`, `X±W`, `Y+0.003`, `Y+1in`, `Y+8in`, `Y+0.5`, `lift,X+0.3,X-0.3`, `lift,lower`, `X+0.2,lift,lower`, `rr+0.2 rest`, `rl-0.2 rest`, `lift,rr+0.2`, `lift,rl-0.2`, `rr+0.2,lift,lower`, `trap lift+1in`. Крок: `['x', dx]` (відносний), `['y', y]` (абсолютний), `['rr'|'rl', dL]`, 3-й елемент `'mustTrap'`.
  - Інваріанти (`sweepAssembly` `:188`, `check`):
    1. owner мийки;
    2. resting: sink = point, vessel = cabinet;
    3. lifted carry/resize зберігає X мийки;
    4. при опусканні shift = null;
    5. snapshot `CountertopSinkShiftM` / `SpatialOffsetM`;
    6. X-рух перерізає cut-out (`requestBoolean`);
    7. reasons: coverage, `TRAP_KEEPOUT` (< 8″, поза trap, mustTrap), нічого на standard;
    8. немає non-finite, кількість cut-outs = кількість мийок;
    9. `getState()` ідемпотентний.
  - Нова збірка: запис у `ASSEMBLIES` через хелпери `SB/SC/OS(id, widthM, extra)` (`:149-151`). Поля spec: `{ id, type, widthM, heightM?, sink?: { cutHalfXM }, vessel? }` (`:2`).
  - Новий рух: ключ у `SEQUENCES(f)` з масивом кроків. `f.totalM` і `W(f)` доступні для відносних величин (`:165-167`).

---

## Не перевірено / суперечності

- **Group-edge бічні панелі випадають зі снапу стільниці.** `composition-scene.mjs:103` дає їм `orderIndex ± 0.5`, а `countertop-snap-targets.mjs:40` відкидає нецілі індекси. Тож такі панелі не дають `side-panel-edge`/endpoints і не входять у межі `composition:left/right`. Заголовок файлу (`:13`) обіцяє «side panels their edges and endpoints». Чи це навмисно, не перевірено.
- **Joint-смуга.** Для стільниці `side-panel-joint` лишається і snap-ціллю, і obstacle (`countertop.manipulable.mjs:83`). Для модулів її виключено зі снапу (`module.manipulable.mjs:31-32`).
- **`canDrag(phase, handle)` і «contact → lock V».** У коді стільниці `canDrag` без аргументів (`countertop-spatial.mjs:181`). Lock V — окремий UI-режим `setVerticalLocked`, на contact не прив'язаний. Методів `_lockV` і `endGesture` у `countertop-spatial.mjs` немає: є `_applyAxes`, `finish`, `_verticalLocked`.
- **Поведінка `cancelGesture` у core** (чи повертає позу до старту) не прочитана. `CountertopSpatial` обробляє `gesturecancel` тим самим `finish`, тобто комітить offset.
- **Default `epsilonM` для collision**, якщо його не задано (у стільниці), не перевірено в `core/collision/observation.mjs`.
- **Структуру `state.applied` / `state.pending` (`getSpatialState()`)** детально не читано. Відомо лише `applied.offsetM` (`world.mjs:374`), AC-17 (`applied === null` означає, що запису не було, `RULINGS.md:25`) і F4 (pending після збою pose-port, `RULINGS.md:17`).
- **`whenIdle`** у `composition-manager.mjs` не знайдено (grep без збігів). Знайдено лише `whenSettled` адаптерів (`:406,1880,1886,1950`).
- **`index.lock`, cross-realm об'єкти з API, «runaway drag»** у коді DnD grep не знайшов. Plugin валідує вхід через `onlyKeys`/`finite` (`countertop.plugin.mjs:48-56`), overlay клонує кадри через JSON (`countertop-drag-overlay.mjs:42`).
- **Зміст goldens** (`countertop-snap-vectors.mjs`, harness, outcomes) і **`countertop-edit-overlay.mjs`** не прочитано: відомі лише назви, обсяг і роль із коментарів drag overlay.
- **`docs/countertop-snapping.md` застарів.** Він описує V1-файли (`countertop-snapping-policy.mjs`, `countertop-axis-intent.mjs`, `countertop-input-adapter.mjs`, `countertop-service.mjs` тощо, `:24-40`), яких у дереві немає (find не знайшов). Там же інчі в public state і радіуси `snapProfiles.mouse/touch` `engageRadiusPx/releaseRadiusPx` (`:122-124`), а у V2 це `engagePx/releasePx` у spec. `docs/verification/countertop-snapping-testing.md` (161 р.) не звірено з V2.
- **`AC/bridge/global-bridge.mjs:169`** містить список `countertop: ['setOffset', 'resetOffset', 'setSize', 'resizeFrom']`. Його призначення (tracked/mutating operations) не перевірено.
- **`SM/docs/*`** (ARCHITECTURE, GLOSSARY, RULINGS) самі позначають свій зміст як «відновлено з коду, потребує підтвердження власником».
