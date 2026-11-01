# Контракт 3D ↔ UI для стільниці (спільне ядро, читається в будь-якому scope)

Стан звірено 2026-10-20: PlayCanvas `src/` (`feture/part-2`), UI `UI-APP-config-react` (`package-3/fix` @ `91257118`). Одиниці скрізь — **метри**, world XY; offset — від стандартної пози, яку рахує `RuleCountertopLayout`. Дюйми лише в підписах UI.

## Терміни
- **CT / стільниця / basin top** — єдиний продукт `Top_Solid` (`category: 'countertops'`, `CountertopRole: 'basinTop'`). **Cover / кавер / cap-CT** — згенерований `Cabinet_Cover` (`CountertopRole: 'cabinetCover'`) на тумбах поза основною CT. Інші `Top_*` (`Top_HPLPrisma`, `Top_HPLStrip` …) — це **мийки** (`category: 'sinks'`), не стільниці.
- **SB / SC / OS / OSS** — тумба з мийкою / бічна / відкрита полиця / бічна полиця. **Trap / сифон** — під basin, по центру SB. **Hosted sink** — мийка, яку несе CT (`CountertopSinkType` на CT), не тумба.
- **Standard / attached** — \|offset\| ≤ 1e-6, довжина композиції. **Moved** — усе інше. **Offset / Remote** — поняття клієнта й UI; у 3D режиму-класифікатора немає (див. `rules-and-decisions.md`).
- **Resting** — \|offset.y\| ≤ 1 см і CT перекриває тумбу по X. **Lifted** — y > 1 см. **Beside / lowered** — без перекриття X, будь-яка висота.
- **Landing** — куди сяде мийка при опусканні: `none | home | fits | gap | unfit`.

## Що UI викликає в 3D
`window.ConfiguratorAPI.countertop` — UI бере з iframe лише якщо є всі 7 методів `getState, setDragEnabled, setSize, setOffset, resetOffset, whenSettled, on` (PlayCanvasIntegration.tsx:598–609); решта — через bridge з перевіркою наявності.

| Метод | Хто викликає в UI | Що робить 3D |
|---|---|---|
| `getState()` | скрізь; живий стан у `countertopRuntimeState`, закомічена довжина у `countertopRuntimeSize` | знімок (форма нижче); до binding — `{ unit:'m', readiness:'waiting', productId:null }` |
| `on('change', cb, { emitCurrent })` | один підписник у `PlayCanvasIntegration` (читає лише `state`, `reason` ігнорує) | `{ reason, state }`; reasons з enum + spatial `drag-start/drag/drag-end` поза enum |
| `on('action', cb)` | `useSinkLanding`, `hostedSinkLanding` | `{ type:'edit-size' }`, `{ type:'sink-landing', landing }`, `{ type:'sink-lift', fromCabinetId, sinkLocalM }` |
| `setDragEnabled(bool)` | вхід/вихід Drag & Drop (ULH, UD) | `assertMutable()`; drag лише для виділеної CT |
| `setOffset({x,y}, { validation:'guard'\|'skip' })` | Cancel D&D (`skip`), авто-корекція режиму, Align | `guard`: apply → evaluate → revert → `COUNTERTOP_POSE_INVALID {reasons, rejected}`; vertical lock → `COUNTERTOP_VERTICAL_LOCKED`; **снап до API-рухів не застосовується** |
| `resetOffset()` | тонкий топ / збій корекції / застарілий landing | offset 0 через `bypass`; attached → custom length скидається |
| `setVerticalLocked(bool)` | режим за товщиною: 4″ → true | drag лише вісь u; `setOffset` з y > 1 см відхиляється; переживає rebind |
| `resizeFrom('left'\|'right', lengthM)` | release ручки | протилежний торець стоїть; clamp до `resizeBoundsM[side]`; працює і на attached (далі CT `moved` з offset 2e-6) |
| `setSize({ length \| null })` | UI **не викликає** | лише для moved (`COUNTERTOP_ATTACHED`) |
| `setLengthLimits({minM,maxM}\|null)` | з `lengthLimitsIn` колекції (ніде не задано → дефолт 23.6″…120″ у UI; 0.6 м…120″ у 3D) | буферизується до появи adapter |
| `whenSettled()` | після команд | geometry → pose → cover → collision refresh |
| `countertopOverlay.setActive / getState / on / previewLength({side,lengthM}) / lengthAtPointer(side, point, {snap})` | D&D-оверлей, ghost ручок | кадр з якорями, `status`, `reasons`; `lengthAtPointer` снапить до країв **тумб** (крок 0.1″, 1″ прилипання) |
| `cabinets.moveSink({fromCabinetId,toCabinetId})` / `liftSink({fromCabinetId, sinkLocalM})` / `landSink({toCabinetId})` | `useSinkLanding` одразу на `fits` (без модалки); `hostedSinkLanding` після API-опускання | SB↔SC з **новими id** (тип у префіксі), повертає `{ …receipt, idMap, sinkHostId \| sideCabinetId }`; `STALE_COMPOSITION` → UI повторює 1 раз |
| `cabinetCover.getState()` | pricing (опитування кожну 1 с — change-події немає) | сегменти каверів |

Не викликаються з UI: `isDragEnabled`, `off`, `setSize`. UI знає `COUNTERTOP_RESIZE_STEP_M` як власну копію (3D не віддає).

## `getState()` — що з нього реально читає UI
```
readiness 'waiting'|'ready'; productId; selected
placementState 'waiting'|'attached'|'moved'; attached; moved; canResize (= ready && !attached)
offset {x,y}; size {length, depth}; autoLength; customLength (null при attached); thickness (м)
lengthLimitsM {minLengthM, maxLengthM, requestedMinM, requestedMaxM, basinMinLengthM}; resizeBoundsM {left,right} | null
collision {status 'unknown'|'clear'|'colliding', collidesWith[]}   ← ULH-тумби без профілю → 'unknown'; червоне вирішує overlay
traps [{ id, xM, hostCabinetId }]
sink { owner 'cabinet'|'countertop'|null, shiftM, landing {status, cabinetId, fromCabinetId, reason 'TYPE'|'HEIGHT'|'DETACHED'|null, snapDxM}, pending {cabinetId, fromCabinetId, status}|null, hosted }
verticalLocked; verticalLockViolated
validation { status 'valid'|'invalid'|'unknown', reasons[], warnings[] }   ← attached завжди valid; мемо за offset|length|owner|pending
```
UI показує `validation.status` (invalid — червоним, Apply вимкнено; `COUNTERTOP_COLLISION` у warnings — жовтим), тексти — `describeCountertopError` по slug-ах `CountertopReasonSlug` (types.ts:398–487).

## Коди і причини (одна таблиця для обох репо)
| Код | Де народжується | Серйозність | UI |
|---|---|---|---|
| `COUNTERTOP_NOT_READY`, `INVALID_INPUT`, `ATTACHED`, `DESTROYED`, `VERTICAL_LOCKED`, `POSE_INVALID` | `COUNTERTOP_ERROR_CODE` (enum контракту) | throw | `classifyCountertopError`; `POSE_INVALID.reasons` → slug-тексти |
| `LEGACY_WRITERS_BUSY` | адаптер під час handoff placement kernel; **поза enum** | throw | UI має його в своєму enum; `/BUSY$\|TEARDOWN/` = «busy», retry |
| `COUNTERTOP_MESH_BOOLEAN_MISSING`, `COUNTERTOP_BOOLEAN_REQUEST_FAILED`, `COUNTERTOP_RESTORE_FAILED`, `CABINET_COVER_RESTORE_FAILED` | CSG / restore / cover; поза enum | throw (restore → імпорт пресета відкочується) | `CABINET_COVER_RESTORE_FAILED` + `error.reasons` з `diagnostics` |
| `TRAP_KEEPOUT`, `SINK_BASE_NOT_COVERED`, `BASIN_EDGE_TOO_CLOSE`, `SINK_LANDING_GAP`, `SINK_LANDING_UNFIT`, `COUNTERTOP_BELOW_COVER` | `dragGuard.evaluate` → `validation.reasons` | **блокують позу**: snap back на release, `POSE_INVALID` з API | червоне, Apply off |
| `COUNTERTOP_COLLISION` | overlay / spatial observe | лише `warnings`; overlay ставить `canApply=false`, guard — пропускає | жовте |
| `LENGTH_OUT_OF_RANGE`, `BASIN_CONFLICT` | `evaluateCountertopOverlay` лише з overlay | лише overlay (`BASIN_CONFLICT` фактично мертвий) | — |
| change reasons | `current, selection, reset, layout, restored, offset, length, length-settled, length-limits, validation, vertical-lock, sink-landing` + spatial `drag-start/drag/drag-end` | подія | UI не розгалужує по reason |

## Що 3D вирішує сам (знати UI-розробнику)
- Стандартну позу X/Y і авто-довжину пише **лише** `RuleCountertopLayout`; drag володіє тільки `SpatialOffsetM`; після перекладки layout offset накладається на нову базу (`rebase`) — ручний drag ніколи не стає стандартною позою.
- Мийка: піднята CT (> 1 см) несе мийку SB (`CountertopSinkShiftM`), SB лишається SB до `liftSink`; опускання з `fits` → `pending`, CT сама досувається на `snapDxM`, далі чекає `moveSink`/`landSink` від UI; `gap`/`unfit` → поза невалідна, snap back. 3D **ніколи не змінює тип тумби** (рішення 08.10).
- Кавери перераховуються після кожного коміту offset/довжини; у UF увімкнені за замовчуванням, у ULH/UD — за налаштуванням; OS/OSS без `lineTypes` валять весь план (`CABINET_COVER_RESTORE_FAILED`).
- Довжина CT: attached = композиція (+1 см за end-панель); moved = `CountertopLengthM` або авто; повернення в attached скидає custom.
- Колізія — observe, не блок; авторитет для червоного — кадр overlay, не `getState().collision`.

## Що UI припускає (знати 3D-розробнику)
- Режим руху — за товщиною (`useCountertopMovementMode.ts:20–53`): < 1″ → `none` (Position сховано, moved CT → `resetOffset`); ≈4″ → `offset` (`setVerticalLocked(true)`, піднята CT → `setOffset({x, y:0})`, не вийде → `resetOffset`); 2.4 / 5.125 / 5.5″ → `free`. Одна спроба корекції на порушення.
- Drag & Drop доступний лише для `urban-low-height` і `urban-duplex` (`resolveCabinetDebugSelection.ts:5`).
- `sink-landing` зі статусом `fits` комітиться **одразу** (`moveSink` або `landSink` для hosted) без підтвердження; помилка → поза на початок drag, інакше `resetOffset`; одночасно один commit, застарілий landing не комітиться.
- Ціна: довжина = закомічена `size.length` з runtime, інакше `calcTotalCountertopWidthCm` (сума ширин + 1 см на активну side panel); кавери — з `cabinetCover.getState()`; hosted sink — `CountertopSinkType`/`VesselColor` з `getConfig`. Позиція CT ціну не змінює.
- Збереження: offset і довжина живуть лише у `sceneLayout` (через `composition.exportPreset`) і лише для D&D-колекцій; undo/redo їх не переграє; compact preset несе для CT лише `CountertopColor`, `Thickness`, `sinkType`.
- UI дублює 3D-логіку: крок 0.1″, межі товщин, симетричну довжину при ручці, length guard — при зміні в 3D міняти в обох.
- `lengthPresetsIn` оголошено й провалідовано, але ніхто не читає; Apply у popover довжини нічого не шле; `Thickness` USH шлеться числом, хоча `runtime-bindings` чекає рядок.

## Розриви контракту (відомі)
1. Enum кодів у 3D і UI різні: `LEGACY_WRITERS_BUSY` лише в UI; CSG/restore-коди лише в 3D.
2. `COUNTERTOP_RESIZE_STEP_M` не в API — копія в UI.
3. Опускання через API не емітить `sink-landing` → авто-опускання 4″ над SC закінчується `resetOffset`, а не переносом мийки.
4. Відхилений `setOffset` встигає емітити `move` для невалідної пози до revert (мерехтіння).
5. Повторний drop на той самий SC (`|snapDx| ≤ 1e-4`) не емітить `sink-landing`; `pending` висить.
6. Дві відповіді про колізію (spatial `unknown` для ULH vs box-перевірка overlay) — задокументовано, не змінено.
7. Контракт у 4 копіях (фасад, `domain/countertop/README.md`, `docs/countertop/ui-integration-phase1.md`, UI `types.ts`).

## Інваріанти на стику
- Один `change`-підписник, стан у модульних сховищах, не в Redux — не додавати другий шлях читання стану.
- SB↔SC = нові id; усе, що тримало старі id (виділення, D&D-сесія, landing у черзі), має пере-adopt-итись через `cabinets.getState` → `adoptCommittedCabinetComposition`.
- Після `moveSink`/`landSink` D&D закривається через `apply()`; `apply()` не має падати на «countertop or composition changed».
- `PlayCanvasIntegration` не перемальовується на кожен кадр drag — хуки в плеєрі читають стан через `useCountertopRuntimeValue(select)`.
