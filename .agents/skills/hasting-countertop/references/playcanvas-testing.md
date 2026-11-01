# Стільниця — тести, sweep, goldens, dev-panel, docs, live (scope `playcanvas`, за потреби)

Коли сюди: перед комітом (базова лінія), щоб відтворити кейс (dev-panel, sweep), щоб знайти існуючий тест на поведінку, щоб знати, яким докам у репо вірити. Базова лінія 20.10: `countertop-*` 136/136; повний прогін 1084 / 1055 pass / 22 fail / 7 todo; sweep 0 порушень на 10 збірках. Червоні, дотичні до CT: `sink-mount-config` (тест відстає від коду: Tricot/Lame anchors), `test-ui` (секція side-panels), `uf-type-transform-config` ×2.

---

# Стільниця: перевірка і наявна документація (PlayCanvas-репо)

Зібрано 2026-10-20 з `hasting-modular-playcanvas-flow-git/src`, гілка `feture/part-2`, HEAD `5310d1f` (2026-10-16).
Node v22.23.2. Шлях `AC/` = `Scripts/app-configuration/`.

---

## 1. Node-тести

### 1.1 Базова лінія прогонів

| Команда | Результат |
|---|---|
| `node --test tests/node/countertop-*.test.mjs` | 21 файл, **136 тестів, 136 pass, 0 fail**, ~2.8 с |
| `node --test tests/node/*.test.mjs` | **1084 тести: 1055 pass / 22 fail / 7 todo**, 0 skipped, ~7.7 с (top-level `1..1069`) |
| `node tests/sweep-report.mjs` | `0 violation(s) over 10 assemblies`, ~1.5 с |

Червоні в повному прогоні, що стосуються sink/стільниці/кавера:

| Тест | Файл:рядок | Суть падіння |
|---|---|---|
| sink mount metadata maps every collection to its scene anchor | `tests/node/sink-mount-config.test.mjs:26` | у коді з'явились `TRICOT: 'Tricot_Sink_Point'` і `LAME: 'Lame_Sink_Point'`, у тесті очікуються лише ULH/CLASS/MAKO/UNIBOX (тест відстає від коду) |
| UF sink applies visibility and Boolean and retries incomplete setup | `tests/node/uf-type-transform-config.test.mjs:37` | expected 2, actual 0 |
| UF Sink leaves visibility unchanged until its product-local cutter is ready | `tests/node/uf-type-transform-config.test.mjs:64` | expected 2, actual 0 |
| Tricot registers sink and side products with shared width… | `tests/node/tricot-cabinet-dimensions.test.mjs:42` | expected 6, actual 8 |
| Urban Duplex registers sink and side and restores size transforms… | `tests/node/urban-duplex-size.test.mjs:6` | deepEqual-розбіжність |
| test UI mounts only behind the flag and only talks to ConfiguratorAPI | `tests/node/test-ui.test.mjs:59` | у dev-panel додано секцію `side-panels` між `cabinets` і `urban-duplex`; тест чекає `['presets','cabinets','urban-duplex','countertop']` |

TODO (у прогоні як `not ok … # TODO`, на fail не впливають), що стосуються стільниці:
- `B5: offset top standing over [c,d] … stays with [c,d]` — `# TODO B5: offset top holder is the first sorted piece` (`risk-basin-top-groups.test.mjs`)
- `B6: after split -> piece deleted -> second split …` — `# TODO B6: taken ids ignore deleted rows` (`risk-basin-top-groups.test.mjs`)
- `A3: two tops on two rows -> both kept (or a clear error)` — `# TODO A3: second top dropped`
- також `A5b`, `A4`, `B1`, `B3` (compact preset / ряди).

Решта 16 червоних — Lame/Tricot/UF/UD матеріали, розміри, бокові панелі, baseboard, ручки (`lame-cabinet-materials`, `tricot-*`, `uf-baseboard`, `uf-cabinet-dimensions`, `uf-cabinet-type`, `uf-cabinet-materials`, UF side shelves/open shelves/end panel/joint strip/group plan/layout rule, `Urban Duplex: Drawers…`), не стільниця.

### 1.2 Файли `tests/node/countertop-*.test.mjs` (21 файл, 136 тестів)

Кількість — за `test(` у файлі (параметризовані позначено).

| Файл | Тестів | Що перевіряє |
|---|---|---|
| `countertop-active-handoff` | 3 | active basin top suspend/resume без руху root; spatial handle ineligible без знищення; retire committed top |
| `countertop-boolean-cutters-discovery` | 3 | cutter, вимкнений попереднім cut, знаходиться (отвір виживає); шукається лише sink mount; без sink mount — без cutters |
| `countertop-collections` | 3 | таблиця колекцій (sources, keys, defaults); UF open shelves без кавера; `highest-plane` policy |
| `countertop-collision-profiles` | парам. (`for … of cases) test(name…)`) | профілі колізій на реальних GLB-фікстурах (`fixtures/collision/glb-accessor.mjs`) |
| `countertop-dimension-units-suppression` | 8 | розмірні лінії: Metric→см, десяткові, inch; length line над верхом; `setSuppressed`; зв'язок з `countertopOverlay.setActive` |
| `countertop-drag-overlay` | 9 | limits (defaults, basin min, clamp); red reasons (collision, basin conflict, length); projection; overlay active/inactive; drag guard; coverage (виріз 5 см від торця → red); selection frame; edit-size button |
| `countertop-hosted-sink-cutters` | 4 | resolver `Countertop_SinkPoint` → hosted sinks + cutters; `RuleCountertopBooleanCutouts` ріже `BoolB_*`; hosted vessel clone; hosted trap (hostCabinetId null) |
| `countertop-layout-rule` | 10 | `RuleCountertopLayout`: measurement adapter (anchors, mesh fallbacks, mount bottom), один X/Y/length план, free layout по support group, production layout, missing group, carried-off sink поза footprint |
| `countertop-lowered-remote` | 4 | lowered Remote: carried sink лишається з CT, додому лише в спокої; `COUNTERTOP_BELOW_COVER`; cover-endpoint snap лише з товщиною кавера |
| `countertop-manipulation` | 19 | length rule attached/moved; offset/custom length у snapshot і restore; modular remote top (frozen length, world pose, re-import); drag лише selected; drag guard snap-back; vertical lock; `ConfiguratorAPI.countertop` (метри, події); length limits 0.6 м…120″; basin raises min; drag показує top без CSG, release re-cut; CSG debounce |
| `countertop-overlay-box-collision` | 4 | box collision: resting top clear; moved into cabinet → red, блок Apply, outline; length preview ghost red; не перекриває реальну observation |
| `countertop-position-strategy` | 5 | `Top_Solid` support mount у registry; support-plane thickness correction; legacy Standard Height table; mount resolver відхиляє неповні дані |
| `countertop-resize-bounds` | 3 | `resolveResizeBoundsM` (basin/vessel/support/material); `countertopCoverageViolations`; `basinEdgeMarginM` + per-cut-out `marginM` |
| `countertop-resize-from` | 21 | `resizeFrom` left/right (протилежний торець фіксований), clamp, INVALID_INPUT; attached top (HR-CT-04); modular remote; sink owner cabinet/countertop (F1, F4, Y pinned); API guard (`POSE_INVALID`, revert); basin edge 10 см; drawer `BoolB_` не рухається з CT; P3 sink landing / pending landing; decision 2.2 |
| `countertop-resize-pointer` | 6 | математика променя камери до осі X; anchored length; snap ≤1″, крок 0.1″, clamp; `previewLength` ghost; `lengthAtPointer` |
| `countertop-side-panels-group` | 8 | free layout рахує бокову панель на зовнішньому краї support group (stale X, інший ряд, нижній ряд, спільний край); standard рахує всі; `RuleSidePanels` без sink mount subtree |
| `countertop-sink-hosts` | 2 | `sinks[]`: по одному на sink anchor (cabinets, потім top), placeholders, ambiguous/missing mounts |
| `countertop-sink-sweep` | 10 (по одному на assembly) | headless sweep (див. §1.4); assert 0 порушень, у повідомленні — markdown-таблиця |
| `countertop-sink-together` | 5 | top на краю SB, sink поруч (DETACHED…); виріз над краєм SB → `SINK_LANDING_GAP`; опускання не підбирає sink; rest 5 см від home → pending; `setOffsetM` закриває pending |
| `countertop-stale-world-sync` | 3 | вимір нащадка щойно зсунутого root без stale matrix; cut-out і dimension measure синхронізують ланцюг предків; стаб відтворює пастку PlayCanvas `syncHierarchy()` |
| `countertop-support-resolver` | 5 | вибір support group; support-plane лише коли всі тумби підтримують; coplanar alignment; independent placement; без «випадкової нульової» площини |

### 1.3 Суміжні файли (sink / basin / trap / cover / spatial)

| Файл | Тестів | Що перевіряє |
|---|---|---|
| `basin-top-home` | 5 | `pickBasinTopHome`: шматок під CT найбільше; tie → лівий; offset top → null; `isBasinTopOffset` читає `SpatialOffsetM` |
| `risk-basin-top-groups` | 6 (2 TODO) | B5/B6 (TODO), standard top після видалення sink, regroup notification |
| `assign-support-groups-sink-delete` | 2 | видалення sink: standard top — шматок з найбільшим перекриттям; offset top — без перерахунку |
| `trap-keepout` | парам. (`for (const [name, ctBox, bodies, expected] of cases) test(...)`, рядок 24) | keep-out зони сифона |
| `dnd-sink-level` | 5 | D&D тумб у ряд з sink-тумбою: pivot y рядa, колізія по mesh, beginMove sink-тумби |
| `hosted-sink-adapter` | 4 | hosted sink: CT володіє в спокої; landing fit/unfit TYPE/HEIGHT/gap; `sink-lift` подія раз на підйом |
| `hosted-sink-document` | 5 | документ `liftSink` (SB→SC, ключі sink переходять), `landSink` (SC→SB), помилки, round-trip |
| `hosted-sink-scene` | 4 | `Top_Solid` будує anchor з sink у `CountertopSinkLocalM` лише з `CountertopSinkType`; anchor за Thickness без дрейфу; матеріал sink з CT (`VesselColor`) |
| `sink-cabinet-boolean` | 3 | sink cut ініціалізується раз на продукт; retry при відсутності cutter/mesh |
| `sink-mount-config` | 6 (1 fail) | мапа sink mount по колекціях; UF swap basin; ULH/Class/Mako mount = висота + товщина CT; без накопичення offsets |
| `sink-mount-ud-tricot-uf` | 3 | UD/Tricot/UF swap basin за `sinkType`; mount з товщиною CT; UF mount при зміні ручки |
| `collection-countertop-anchors` | 6 | support metadata ULH/Class/Mako/Tricot; ULH Open Shelf bounds; height rules оновлюють лише `*_Countertop_Point`; UD connect points |
| `compact-preset-sink-pivot-flow` | 1 | sink-тумба тримає pivot Y через export → import |
| `cabinet-cover-*` (9 файлів: composition-adapter, integration, persistence, policy, product-port, reconcile-plan, roles, service, ulh) | 132 | кавер (HR-CV) |
| `cover-policy-carried` | 5 | cover policy з carried sink |
| `ud-open-shelves-covers` | 3 | UD open shelves і кавери |
| `spatial-manipulation-*` (15 файлів) | ~191 | модуль V2: collision, contracts, coordinator, goldens (2), lifecycle (54), motion, multi-instance, playcanvas-adapter (31), playcanvas-world, presentation, public-entry, runtime, second-consumer, snapping, world |
| `composition-spatial`, `cabinet-draft-spatial-pose`, `column-snap` | 5 / 1 / 25 | composition spatial, draft pose, column snap (UD) |

### 1.4 Хелпери та фікстури

| Файл | Рядків | Призначення |
|---|---|---|
| `tests/node/helpers/countertop-vm.mjs` | 20 | `loadCountertopAdapter(filename, bindings, names)`: читає джерело з `AC/domain/countertop/adapters/<filename>`, вирізає `import`/`export`, виконує в `node:vm` з власним `Vec3` і переданими bindings |
| `tests/node/helpers/playcanvas-stub.mjs` | 4 | `register('./playcanvas-stub-hooks.mjs')`; імпортувати першим (static import), щоб `'playcanvas'` резолвився у стаб |
| `tests/node/helpers/playcanvas-stub-hooks.mjs` | 25 | module hooks: стаб `Vec3`, `BoundingBox` (`copy`, `add`), `Entity`, `Script`, `Mesh` (кидає `This test requires an explicit mesh fixture`), `Color` |
| `tests/node/helpers/countertop-sweep-fixture.mjs` | 284 | параметризована ULH-сцена: `createSweepFixture({ cabinets, sinkCutHalfXM })`, `ASSEMBLIES`, `SEQUENCES`, `sweepAssembly`, `toMarkdown`, `TOP_HALF_Y = 0.0275`. Використовує справжні `CountertopCompositionAdapter`, `createCountertopDragOverlay`, `ProductRegistry_V2`, `createSpatialWorld`, `measureBodyProxiesM`/`measureEntityBoundsM`, `CompositionSpatial`, `cabinetUniBodyFixture` |
| `tests/node/fixtures/collision/archive-geometry.mjs` | — | `cabinetUniBodyFixture`, `sidePanelUpperG46Fixture` (реальна топологія архівних mesh) |
| `tests/node/fixtures/collision/expected-proxies.mjs`, `glb-accessor.mjs` | — | очікувані proxy-об'єми; `decodeGlbAccessor` |
| `tests/node/fixtures/placement/ulh-scenes.mjs` | — | ULH-сцени для placement |
| `tests/node/fixtures/spatial-manipulation/box-consumer.mjs`, `fake-ports.mjs` | — | другий споживач і фейкові порти модуля |
| `tests/node/fixtures/preset-goldens.json` | — | goldens формату пресетів (оновлення: `UPDATE_PRESET_GOLDENS=1 node --test tests/node/preset-format-goldens.test.mjs`) |

### 1.5 Sweep (`tests/sweep-report.mjs`)

- Запуск: `node tests/sweep-report.mjs [assembly...]` (без аргументів — усі). Друкує markdown-таблицю `| assembly | step | invariant | numbers |` і рядок `N violation(s) over M assemblies`. Поточний вивід: порожня таблиця, `0 violation(s) over 10 assemblies`.
- Той самий sweep як тест: `tests/node/countertop-sink-sweep.test.mjs` — по `test` на assembly, `assert.equal(rows.length, 0, toMarkdown(rows))`.
- Збірки (10, ULH, зліва направо впритул): `SB60`, `SB80`, `SB60+SC40`, `SC40+SB60`, `SC40+SB60+SC40`, `SB60+SC60+SB60`, `SB60+OS60`, `SC60+SC60`, `SB60 vessel`, `SB60(wide cut)+SC40` (`cutHalfXM: 0.25`).
- Рухи (18 послідовностей, кожна зі standard pose; `x` — відносний зсув, `y` — абсолютний підйом, `rr`/`rl` — resize справа/зліва): `X-0.1`, `X+0.1`, `X+0.3`, `X+W`, `X-W`, `Y+0.003`, `Y+1in`, `Y+8in`, `Y+0.5`, `lift,X+0.3,X-0.3`, `lift,lower`, `X+0.2,lift,lower`, `rr+0.2 rest`, `rl-0.2 rest` (HR-CT-04), `lift,rr+0.2`, `lift,rl-0.2`, `rr+0.2,lift,lower`, `trap lift+1in` (`mustTrap`: підйом 1″ над SB мусить дати `TRAP_KEEPOUT`).
- Інваріанти (коди в колонці `invariant`): `1 owner`; `2 resting sink≠point`, `2 vessel≠cabinet`; `3 lifted carry`, `3 lifted resize`; `4 lowered shift`; `5 SpatialOffsetM`, `5 shift missing`, `5 shift stale`; `6 no re-cut`; `7 coverage` (`SINK_BASE_NOT_COVERED`), `7 standard reasons`, `7 trap fixture`, `7 trap missing`, `7 trap not fired`, `7 trap off-trap`, `7 trap ≥8″`; `8 cut-out count`, `8 non-finite`; `9 getState side effect` (ідемпотентність); `exception`.

---

## 2. Goldens і snap-harness

Усі в `tests/node/goldens/`, споживач — `tests/node/spatial-manipulation-goldens.test.mjs` (2 тести; collision — по тесту на сцену).

| Файл | Рядків | Призначення |
|---|---|---|
| `countertop-snap-vectors.mjs` | 309 | 24 snap-вектори (P0 spatial-manipulation V2, 2026-09-21); вхід — plain data (raw anchor snapshots). Коментар: «captured from the V1 path (profile + resolveSnapV1), which matched legacy on all 24 vectors… the parity oracle once the legacy solver is deleted» |
| `countertop-snap-outcomes.json` | 759 | 24 очікувані результати (`snappedAxes`, `appliedOffsetM`, pairs, latch), напр. `raw-composition-left-x-only` |
| `countertop-snap-harness.mjs` | 171 | проганяє вектор через V2: сцена компілюється countertop spec (`countertop.manipulable.mjs`, `compileSnapGeometry`) і резолвиться `resolveSnapV1`; legacy candidate ids (`x:ct.left->cabinet:cab-3:right`) = rule-axis prefix + feature ids. Експорти: `isSceneVector`, `resolveCountertopSnapGoldenV2` |
| `countertop-collision-scenes.mjs` | 114 | duck-typed дерева сутностей з реальною топологією архівних mesh; експорти `COUNTERTOP_COLLISION_SCENES`, `COLLISION_EPSILON_M`, `toSceneBodies` |
| `countertop-collision-outcomes.json` | 3857 | 4 сцени: `60+60`, `60+35`, `cavity`, `side-panel` — readiness, виміряні obstacle volumes, verdict / hit ids / overlap depths на фіксованому sweep поз; «captured when the legacy controller and V1 agreed» |

Тести:
- `snap goldens: the countertop spec resolves every scene vector to the captured axes, offsets, pairs and latch` (рядок 62)
- `collision goldens: scene ${name} — the countertop spec measures the captured volumes and verdicts` (рядок 83)

Механізму перезапису countertop-goldens у репо немає: `spatial-manipulation-goldens.test.mjs` лише читає JSON (`readFileSync`), env-прапорця чи `writeFileSync` там немає. Єдиний update-прапорець у `tests/node` — `UPDATE_PRESET_GOLDENS=1` для `preset-format-goldens.test.mjs`.

---

## 3. Dev-panel (`Scripts/dev-panel/`)

- Відкриття: `?testUI=1` в URL (`isTestUIEnabled(win, flag = 'testUI')`, `Scripts/dev-panel/test-ui.mjs:26`). Монтується `mountTestUI({ window, getAPI: () => window.ConfiguratorAPI })` з `Scripts/app-configuration/bridge/global-bridge.mjs`. `DEFAULT_SECTIONS`: presets, cabinets, side-panels, urban-duplex, countertop.
- Файли: `test-ui.mjs`, `components.mjs`, `README.md` (2026-10-14), `sections/{presets,cabinets,side-panels,urban-duplex,countertop}.mjs`, `data/{collection-presets,side-panel-guide,urban-duplex-presets}.mjs`.

### 3.1 `sections/countertop.mjs` (184 рядки)

Працює лише через `ConfiguratorAPI.countertop` і `ConfiguratorAPI.countertopOverlay` (+ `setConfig`, `setConfigBatch`, `getConfig`, `cabinets.*`, `composition.getState`). Метри, world XY, offset від standard (composition) позиції. `STEP_X_M = 0.02`, `INCH_M = 0.0254`.

| Група | Контрол | Виклик |
|---|---|---|
| State | readout | `getState()`: readiness, attached, dragging, canResize, verticalLocked, verticalLockViolated, offset, size, customLength, thickness, `lengthLimitsM`, collision, traps, validation (`status reasons… warn:…`), `countertopOverlay.getState().status` |
| Drag & Drop | Pointer drag (toggle) | `setDragEnabled(bool)` / `isDragEnabled()` |
| | D&D visuals (toggle) | `countertopOverlay.setActive(bool)` / `isActive()` |
| | Start D&D | запам'ятати pose, `setDragEnabled(true)`, overlay on |
| | Apply | overlay off, `setDragEnabled(false)`, `whenSettled()` |
| | Cancel | overlay off, drag off, `setOffset(startPose)`, `whenSettled()` |
| Position | Standard | `resetOffset()` (скидає custom length) |
| | Offset (y = 0) | `setOffset({ x, y: 0 }, SKIP)` |
| | Remote (+1″ up) | `setOffset({ x, y: max(y,0) + 1″ }, SKIP)` |
| | Lock Y (toggle) | `setVerticalLocked(bool)` |
| | Guard (toggle) | off (default) → `{ validation: 'skip' }`; on → `{ validation: 'guard' }` (API відхиляє з `COUNTERTOP_POSE_INVALID`) |
| | Offset X, m / Offset Y, m (steppers) | `setOffset(…, SKIP)`; крок X 0.02 м, Y 1″, min Y 0 |
| Width | Length, m (stepper) | `setSize({ length })`, крок 1″ |
| | −1″ left / +1″ right | `resizeFrom('left'|'right', length ∓ 1″, SKIP)` |
| | Follow | `setSize({ length: null })` |
| | Limits 0.6–2 m / Default limits | `setLengthLimits({ minM: 0.6, maxM: 2 })` / `setLengthLimits(null)` |
| Top & sink | Thickness, in (select) | `setConfigBatch({}, { Thickness })`; значення `0.375, 0.5, 4, 5.125, 5.5` |
| | Material (text + suggestions) | `setConfigBatch({}, { CountertopColor })`; `Cacao Orinoco FF MT`, `Noce Sinfonia TKM`, `Pulpis Chiaro TKH` |
| | Sink cabinet (select) | список з `cabinets.getCapabilities()` + `cabinets.getState()`, фільтр `/sink/i` |
| | Sink type (select) | `setConfig(<sink cabinet>, { sinkType })`: `Top_HPLPrisma`, `Top_HPLQuadra`, `Vessel_Aquarius`, `Vessel_UrbanModo` |
| | landing readout | `getState().sink.landing` (`status → cabinetId (dx snapDxM)`) і `.pending` |
| | Move sink here | `cabinets.moveSink({ apiInstanceId, compositionId, requestId, expectedCompositionRevision, fromCabinetId: pending.fromCabinetId, toCabinetId: pending.cabinetId })`; disabled, якщо pending немає / `status === 'home'` |
| | log | `countertop.on('action')` → `type === 'sink-landing'` пишеться в лог |
| API methods (згорнуто) | `countertop.*`, `countertopOverlay.*` | генеричний виклик будь-якої функції з JSON-аргументами |

Контролів `liftSink` / `landSink` у dev-panel немає (grep `liftSink|landSink` по `Scripts/dev-panel` — 0). Генеричний виклик покриває лише `countertop.*` і `countertopOverlay.*`.

Тестові значення — `COUNTERTOP_TEST_VALUES` у тому ж файлі.

### 3.2 `data/collection-presets.mjs` (173 рядки) — пресети з sink/CT

Окремих пресетів з offset / remote / liftSink немає. Compact-пресети ULH (`ulhRows`) додають `top: { productType: 'Top_Solid' }` («One countertop per preset, on the sink row»; `withCountertop: false` у stack-пресетах).

| Колекція | id | Склад |
|---|---|---|
| ULH | `ulh-sb` | SB 60 |
| | `ulh-sb-sc` | SB 60 + SC 35 |
| | `ulh-sc-sb-sc` | SC 35 + SB 60 + SC 35 |
| | `ulh-sb-sc-sb` | SB 60 + SC 60 + SB 60 |
| | `ulh-sb-os` | SB 60 + OS 60 |
| | `ulh-two-groups`, `ulh-three-groups` | compact, 2/3 ряди з проміжками, sink-ряд з CT |
| | `ulh-stack-flush`, `ulh-stack-lower-longer` | stack 2 над 2, без CT |
| UD | `ud-row-56`, `ud-columns`, `ud-shifted-column` | 56 sink · side · sink; колонка 28/28; shifted column |
| URBAN | `ush-sb`, `ush-sc-sb-os` | Sink-Base 60; Sink-Cabinet 35 + Sink-Base 60 + Open-Shelf 50 |
| CLASS / MAKO / UF / TRICOT | `<prefix>-sb`, `<prefix>-sc-sb-sc` (`sinkAndSidePresets`) | Sink 60; Side 40 + Sink 60 + Side 40 |
| UF | `uf-joint-88-53`, `uf-joint-unknown` | Sink 88 + Side 53 / Side 50 |

sink-тумби в пресетах мають `sinkType: 'Top_HPLPrisma'`.

### 3.3 `Scripts/dev-panel/README.md`, частина countertop

Рядки 48–51: countertop — D&D start/apply/cancel, Standard/Offset/Remote, offset X/Y, length ±, resizeFrom, length limits, thickness, material, sink, генеричний виклик; тестові значення в `COUNTERTOP_TEST_VALUES`. Рядки 65–72: Guard, sink landing readout, Move sink here, лог `sink-landing`. Рядок 75: «Full contract: `docs/countertop/ui-integration-phase1.md`».

---

## 4. Документація в репо

Кількість «битих» посилань — файли `*.mjs/js/json`, згадані в документі, яких немає в `git ls-files` (перевірка за basename).

| Документ | Останній коміт | Рядків | Битих посилань | Оцінка |
|---|---|---|---|---|
| `AC/domain/countertop/README.md` | 2026-09-28 | 227 | 0 / 22 | частково застарілий: немає sink owner / hosted sink / `liftSink`/`landSink` / traps (код 2026-10-07…10-09) і таблиці колекцій (10-13); розділ Tests перелічує 5 файлів (`countertop-support-resolver`, `-layout-rule`, `-position-strategy`, `collection-countertop-anchors`, `countertop-manipulation`) з 21 |
| `docs/countertop-snapping.md` | 2026-09-21 | 320 | 12 / 16 | застарілий щодо файлів: розділ «2. Архітектура файлів» посилається на видалені `countertop-snapping-policy.mjs`, `countertop-service.mjs`, `countertop-state.mjs`, `countertop-input-adapter.mjs`, `countertop-axis-intent.mjs`, `countertop-assembly-adapter.mjs`, `countertop-snap-guide-renderer.mjs`, `countertop-snap-metric-adapter.mjs`, `countertop-snap-snapshot-adapter.mjs`, `countertop-snap-anchors.mjs`, `check-runtime-scripts.mjs`, `countertop-movement…` (видалено в `36b3e2c`, `2693b9a`, `b8ea822`). Статус у шапці: «Direct PlayCanvas Launch… ще не перевірені» |
| `docs/countertop-collisions.md` | 2026-09-15 | 222 | 1 / 1 (`server.js` у батьківському репо) | застарілий: описує гілку `counter-top/create-logic-drag` і API `countertop.getCollisionState()` / `getCollisionConfig()` — у `Scripts` цих імен немає (grep 0); legacy collision controller видалено в `36b3e2c` |
| `docs/countertop/ui-integration-phase1.md` | 2026-10-09 | 225 | 0 / 7 | актуальний для API фази 1 (state model, `getState()`, методи, reason slugs, events, flows, §7 Test UI, §8 open items); згадує `liftSink`/`landSink` (5), hosted (4), traps (3). Не покриває таблицю колекцій / UF / UD (10-13+) |
| `docs/features/countertop-collections/README.md` | 2026-10-13 | 84 | 0 / 12 | актуальний на 10-13 (таблиця колекцій, кавер, `highest-plane` для UF, «Connect another collection (e.g. Urban Duplex)», Open questions). Після нього — `0eacb14` (UF open shelves, 10-15), `08eee92` (UD open shelves cover plan, 10-16) |
| `docs/features/counttop/relocation and remote positions/README.md` | 2026-10-09 | 183 | 0 | «Стан на 08.10.2026»; два репо: PlayCanvas гілка `debug/cabinet-countertop-movement`, UI `feture/update-countertop`. Розділи: принцип «3D звітує, UI комітить», модель стану, потоки (ручки, Offset/Remote, товщина → режим, SB↔SC), рішення, слаги, стан, відкрите, терміни |
| `…/relocation and remote positions/changes.md` | 2026-10-09 | 152 | — | 4 етапи: A (3D фаза 1, рух з раковиною), B (UI інтеграція, коміт `33098bb1`), C (UI режим за товщиною, авто-перенос раковини), D (3D раковина на стільниці, SB→SC при підйомі) |
| `…/relocation and remote positions/files-glossary.md` | 2026-10-13 | 124 | 0 / 47 | глосарій змінених файлів |
| `docs/verification/countertop-snapping-testing.md` | 2026-09-15 | 161 | 2 / 2 | застарілий: чекліст V1-епохи (snapping, Alt/grid, `setMovementGrid({})`, anchors, touch); «URL Launch поки не зафіксовано»; `check-runtime-scripts.mjs` відсутній. §8 regression preset exterior corner (`presetProducts`, `Thickness: '5.5'`) |
| `docs/countertop-movement.md` | — | — | — | немає на гілці |
| `docs/features/countertop-movement/` | — | — | — | немає на гілці |
| `AC/domain/countertop/README.md` за шляхом `AC/domain/...` буквально | — | — | — | буквального `AC/` у репо немає; `AC` = `Scripts/app-configuration` |
| `docs/onboarding/03-countertop-and-movement.md` | 2026-10-09 | 83 | 2 / 20 (`placement-policy.mjs`, `.test.mjs`) | частково актуальний: карта модуля, хід жесту, сесія тумб ULH з Apply, «Режими стільниці: як є і як має бути»; `liftSink`/hosted не згадані; «Близько 80 файлів у tests/node» |
| `AC/domain/spatial-manipulation/README.md` | 2026-09-21 | 92 | 0 / 4 | модуль V2 |
| `AC/domain/spatial-manipulation/docs/` | 2026-09-30 | — | — | `README.md` (путівник, 46), `ARCHITECTURE.md` (59), `ENGINE-ADAPTER.md` (21), `PUBLIC-API.md` (51), `EXTENDING.md` (38), `GLOSSARY.md` (21), `KNOWN-ISSUES.md` (16), `RULINGS.md` (38) — усі з коміту `f9da509` |
| `docs/rules-manifest.md` | 2026-10-16 | 91 | 0 / 14 | у тексті «Стан на 13.10.2026, перевірено по коду гілки `feture/fix-countertop-for-UF`» |
| `_fixes` по стільниці (`docs/features/ulh-cabinet-addition/_fixes/`) | 2026-09-29 | — | 0 | див. нижче |

Інші md по темі: `docs/features/cabinet-cover/` (тека є), `AC/domain/product/rules/CabinetTricot/Sink/README.md`, `docs/features/ulh-cabinet-addition/{local-dev-workflow,developer-architecture,ui-integration-guide,engineering-mode,line-to-modular-guide}.md` (Launch-URL і API-таблиці countertop/cabinetCover).

### 4.1 `_fixes`

| Файл | Коміт фіксу | Перевірка, записана у файлі |
|---|---|---|
| `2026-09-29-countertop-basin-hole-lost.md` — «the basin hole disappears after a countertop Drag & Drop (URLH-SB, integrated basin)» | `fbc7477` | `countertop-boolean-cutters-discovery.test.mjs` (3), node 792/792; live (fix емульовано в runtime): правило шле `validCutters: [BoolB_Tekorlux_Rectangular]` |
| `2026-09-29-countertop-dnd-sink-drift.md` — «countertop Drag & Drop leaves the sink behind» | `f3eda41` | `countertop-layout-rule.test.mjs` новий кейс (free і legacy), red→green; node 762/762; live ULH: drag 23.7 см → Apply → top і sink разом |
| `2026-09-29-countertop-drag-runaway.md` — «countertop jumps / runs away after a small Drag & Drop move» | `5e716b2` | `countertop-stale-world-sync.test.mjs`, red на `8c810cb`, green після; node 765/765; live: drags 3.4, 13, −5.5 см |
| `2026-09-28-local-cover-policy.md` — «local preset erased cover settings before drag Apply» | — | (кавер) |
| `2026-09-27-draft-spatial-runtime.md` — «draft bypassed the full spatial runtime» | — | (spatial) |
| `2026-09-28-local-bootstrap-order.md` | — | (bridge bootstrap) |

### 4.2 `docs/rules-manifest.md` — CT і CV (дослівно)

```
## CT — стільниця і раковина

Код — `countertop/adapters/countertop-composition-adapter.mjs`, `countertop/countertop-resize-snap.mjs`,
`countertop/countertop-resize-bounds.mjs`, `countertop/countertop-hosted-sink.mjs`,
`bridge/plugins/cabinet-local-runtime.mjs` (`moveSink` / `liftSink` / `landSink`).

| ID | Правило | Було | Стан |
|---|---|---|---|
| HR-CT-01 | Посадка раковини: опущена CT, виріз якої над іншою тумбою. Підходить SC з верхом у межах −2 см…+5 мм від низу CT; інакше `unfit` (`TYPE`/`HEIGHT`), `gap` (стик), `none` (поза рядом). UI підтверджує → SB ↔ SC, CT опускається | P.3 | ✅ |
| HR-CT-02 | Підняли CT більше ніж на 1 см — вона забирає раковину (SB → SC). Опустили над SC — SC → SB, раковина в центр тумби. Тому в remote немає SB | RB1.1, V-30, V-31 | ✅ |
| HR-CT-03 | Ресайз CT ручками: крок 0.1″, кінець прилипає до країв тумб / композиції в межах 1″, min/max матеріалу | R15.3, R16.4 | ✅ |
| HR-CT-04 | Приєднану (стандартну) CT теж можна ресайзити з торців; після цього вона тримає свою довжину | R16.1 | ✅ |
| HR-CT-05 | Ширина CT — лише ручками на торцях, раковина стоїть на місці | R15.4, R16.5 | ✅ рушій · ручки — UI |
| HR-CT-06 | Край раковини ≥ 10 см від торця CT (не більше половини вільного місця на тумбі); Vessel — без відступу | R15.5 | ✅ |
| HR-CT-07 | CT не коротша за SB і накриває її (ресайз і зсув CT) | R16.2, V-22 | ✅ |
| HR-CT-08 | Remote: CT на винесених SC, не на OS; SC впритул до OS → CT на всю групу | V-32 | ❌ |
| HR-CT-09 | Рух раковини по CT (межі 10 см і зона сифона) | V-41…V-45 | ❌ фаза 2 |

## CV — кавер і стільниця по колекціях

Код — `countertop/countertop-collections.mjs` (таблиця колекцій), `countertop/basin-top-policies.mjs`,
`countertop/cover/*`. Опис — `docs/features/countertop-collections/README.md`.

| ID | Правило | Було | Стан |
|---|---|---|---|
| HR-CV-01 | Кавер на тумбах, що не під основною CT, для колекцій з таблиці: ULH, UD (вмикає модульний режим), UF (вмикається сам). Сусідні тумби однієї колекції, кольору, висоти й глибини — один кавер | — | ✅ · за ролями (без кавера на окремих OS і між рядами) — відкладено |
| HR-CV-02 | UF: основна CT на найвищих тумбах, що стоять впритул; решта — кавер. Тумби з мийкою, нижчої за інші, не буває (контролює UI). Одна найвища група; якщо кілька — ліва | — | ✅ |
| HR-CV-03 | Колір кавера = `CabinetColor` тумби; можна задати один спільний колір на всі кавери композиції | — | 🟡 `CabinetColor` є · спільного кольору немає |
```

Відкриті питання там же (рядки 84–85): UD 56+28 в одному ряду — підключити HR-CV-02 до UD?; HR-CV-03 спільний колір для ULH/UD потребує окремої команди модульного режиму.

---

## 5. Історія (з 2026-09-15)

`git log --since=2026-09-15` по `AC/domain/countertop`, `AC/bridge/plugins/countertop.plugin.mjs`, `AC/domain/composition/rules/RuleCountertop*` (`RuleCountertopBooleanCutouts.mjs`, `RuleCountertopCollisionRefresh.mjs`, `RuleCountertopLayout.mjs`), `AC/domain/spatial-manipulation`: **77 комітів, з них 18 `fix`** (позначено **FIX**).

| Хеш | Дата | Автор | Subject |
|---|---|---|---|
| `08eee92` | 10-16 | Andriy Lobatskyi | **FIX** fix(ud): open shelves no longer refuse the cover plan |
| `f7a6d1a` | 10-15 | Andriy Lobatskyi | perf(uf): skip pure frame waits when a preset replaces the composition |
| `3767740` | 10-15 | Elementals-technical | Merge PR #84 feature/ulh-group-side-panels |
| `aafb33c` | 10-15 | lexa-sharm | Merge branch 'phase-2-main' into dev-oleksii |
| `0eacb14` | 10-15 | Andriy Lobatskyi | **FIX** fix(uf): open shelves keep the UF line, so the short cabinet gets its own cover |
| `3951ea7` | 10-15 | lexa-shamr | [lame]: Create rule composition for collection Lame - LameUndertop |
| `5ba85a1` | 10-14 | Andriy Lobatskyi | **FIX** fix: UF PTO 85 top front, short cabinets and covers follow the handle |
| `4b4e97e` | 10-14 | Andriy Lobatskyi | feat: add UF side panels through the group panel pipeline |
| `299504b` | 10-14 | Andriy Lobatskyi | feat: UF body height follows the handle |
| `bdd0f85` | 10-14 | Ruslan Krasiuk | feat: add per-row ULH side panels for exposed group edges |
| `ef60f96` | 10-14 | BYTULOCHKIN | Merge PR #73 fix/cabinet-cover-material |
| `b4a9aee` | 10-14 | Andriy Lobatskyi | **FIX** fix(cover): no cover under a cabinet standing on a support |
| `528c877` | 10-13 | Andriy Lobatskyi | feat(ud): Urban Duplex modular collection (drag, rows, sink move), one tier |
| `0720a6c` | 10-13 | Andriy Lobatskyi | refactor(modular): cabinet roles from collection packs instead of ULH names |
| `b474262` | 10-13 | Andriy Lobatskyi | docs(rules): rules manifest; rule ids HR-<group>-NN in code and tests |
| `ae53b4a` | 10-13 | Andriy Lobatskyi | feat(countertop): UF main top on the highest cabinets |
| `36ec522` | 10-13 | Andriy Lobatskyi | feat(countertop): per-collection countertop table; UF main top on the sink cabinet, covers for UF and UD |
| `d0d55a6` | 10-12 | Ruslan Krasiuk | **FIX** fix(cabinet-cover): honor explicit cover material |
| `8e4f001` | 10-09 | Andriy Lobatskyi | feat(countertop): the sink never leaves the top; lowered Remote top beside the row |
| `5a74120` | 10-09 | Andriy Lobatskyi | refactor(countertop): one sink host — resolver sinks[] feeds CSG, material, traps |
| `4e150ac` | 10-09 | Andriy Lobatskyi | feat(countertop): countertop-hosted sink — cabinets.liftSink / landSink (RB1.1) |
| `413a80e` | 10-08 | Claude | feat(countertop): phase 1 close-out — 0.1″ step, pending-landing coverage, UI integration guide, tests |
| `a0d48d4` | 10-08 | Claude | feat(countertop): sink landing (3D reports) + cabinets.moveSink (UI commits SB↔SC) |
| `414cddf` | 10-08 | Claude | feat(countertop): phase-1 package — basin margin, API pose guard, resize attached top, vertical lock |
| `a9dd893` | 10-08 | Claude | **FIX** fix(countertop): drag a resting top whole, re-cut the sink hole on release |
| `33851ad` | 10-07 | Claude | **FIX** fix(countertop): sink owner — audit fixes + headless sink sweep |
| `9e4d790` | 10-07 | Claude | **FIX** fix(countertop): pointer jitter is not a lift; no trap keep-out where the top is not over the trap |
| `e9b3aa6` | 10-07 | Claude | **FIX** fix(countertop): only the sink mount's cutters belong to the top |
| `a68d4fc` | 10-07 | Andriy Lobatskyi | feat(countertop): sink owner + per-side resize limits (phase 1, items 1 and 4) |
| `865560c` | 10-07 | Andriy Lobatskyi | feat(countertop): sink trap keep-out (V-31a) for cabinet drafts and countertop drag; tint follows CSG mesh swaps |
| `f9da509` | 09-30 | Andriy Lobatskyi | docs(spatial-manipulation): module docs (architecture, engine adapter, public API, extending, rulings) |
| `229873d` | 09-30 | Andriy Lobatskyi | **FIX** fix(side-panels): X from the clean body (no sink/handles); countertop counts only its group's panels |
| `ba28ede` | 09-30 | Andriy Lobatskyi | **FIX** fix(cover): cover neighbours by physical adjacency, not flat order |
| `3448111` | 09-30 | Andriy Lobatskyi | **FIX** fix(countertop): a remote top without a saved length keeps its length on relayout |
| `f271a49` | 09-29 | Andriy Lobatskyi | Merge origin/phase-2-main into cabinet/create-new-logic |
| `fbc7477` | 09-29 | Andriy Lobatskyi | **FIX** fix(countertop): keep the basin hole after a countertop move |
| `60f4348` | 09-29 | Andriy Lobatskyi | feat(countertop): one-cabinet minimum and tidy dimension lines in Drag & Drop |
| `1cb4b64` | 09-29 | Andriy Lobatskyi | **FIX** fix(countertop): show collisions with ULH cabinets in Drag & Drop |
| `8c09544` | 09-29 | Elementals-technical | Merge PR #45 cabinet/create-new-logic |
| `6001ea0` | 09-29 | Andriy Lobatskyi | feat(countertop): length ghost preview and exact pointer length for handles |
| `ad614d5` | 09-29 | Andriy Lobatskyi | feat(countertop): resize a moved-off top from one end |
| `b737dd2` | 09-29 | Elementals-technical | Merge PR #44 cabinet/create-new-logic |
| `5e716b2` | 09-29 | Andriy Lobatskyi | **FIX** fix(countertop): stop the dragged countertop from running away |
| `403fb7b` | 09-29 | Elementals-technical | Merge PR #42 cabinet/create-new-logic |
| `8c810cb` | 09-29 | Andriy Lobatskyi | feat(countertop): length limits and countertopOverlay for Position > Drag & Drop |
| `ee2bf18` | 09-29 | Elementals-technical | Merge PR #41 cabinet/create-new-logic |
| `f3eda41` | 09-29 | Andriy Lobatskyi | **FIX** fix(countertop): keep the sink with a dragged countertop |
| `36901c8` | 09-29 | lobatskiy-repo | **FIX** fix(class): scope countertop cutouts and drawer modes |
| `0e7dc43` | 09-28 | Andriy Lobatskyi | feat(ulh): cabinet rows, collection-driven runtime without URL flags |
| `5b1e5e7` | 09-28 | Andriy Lobatskyi | feat(ulh): complete local cabinet preset and drag workflow |
| `474b399` | 09-27 | Andriy Lobatskyi | Lock recovery after nested legacy handoff rollback failure |
| `403363f` | 09-27 | Andriy Lobatskyi | Add reversible live legacy cabinet handoff |
| `2b76546` | 09-26 | Andriy Lobatskyi | feat(ulh): guard legacy writers with private publication authority |
| `4860798` | 09-26 | Andriy Lobatskyi | feat(ulh): plan prospective covers and panels from measured groups |
| `021a371` | 09-25 | Andriy Lobatskyi | **FIX** fix(cabinet-cover): derive ULH material from cabinet color |
| `160ec2d` | 09-25 | Andriy Lobatskyi | feat: add ULH cabinet cover |
| `00f173c` | 09-24 | Andriy Lobatskyi | feat: add collection-specific ULH side panels |
| `05e98a3` | 09-24 | Andriy Lobatskyi | feat(sink): add collection-specific sink mount handling |
| `695f982` | 09-24 | Andriy Lobatskyi | feat(countertop): add support-plane layout positioning |
| `3f2aec5` | 09-23 | Andriy Lobatskyi | Implement Spatial Movement V1 contracts, lifecycle, and collision |
| `278f851` | 09-21 | lobatskiy-repo | countertop/spatial: remove redundancy; one collision outline for all |
| `159f29c` | 09-21 | lobatskiy-repo | countertop: the modules model — snapshot data, a length rule, no own state |
| `774ceaf` | 09-21 | lobatskiy-repo | countertop: move the movement-born helpers into countertop/spatial |
| `79dd13e` | 09-21 | lobatskiy-repo | spatial V2: countertop/spatial like the modules; composition owns the world |
| `8d584d1` | 09-21 | lobatskiy-repo | spatial V2 P6: composition modules as the second consumer |
| `30dfa9d` | 09-21 | lobatskiy-repo | feat(countertop): run the countertop on the spatial World; drop the V1 compat layer |
| `53dab0f` | 09-21 | lobatskiy-repo | feat(countertop): the countertop as a manipulable spec, proven on the goldens |
| `38dc667` | 09-21 | lobatskiy-repo | feat(spatial): PlayCanvas World — getSpatialWorld(app, { scene }) |
| `f16b700` | 09-21 | lobatskiy-repo | feat(spatial): V2 surface — declarative specs and a shared World |
| `cd220e1` | 09-21 | lobatskiy-repo | refactor(spatial): move gesture ownership into the module, drop legacy input hooks |
| `cd70053` | 09-21 | lobatskiy-repo | refactor(spatial): split runtime/instance.mjs (2.5k lines) along its seams |
| `99f06a0` | 09-21 | lobatskiy-repo | refactor(spatial): regroup the module into core/, runtime/ and playcanvas/ |
| `36b3e2c` | 09-21 | lobatskiy-repo | refactor(spatial): delete the legacy countertop snap solver and collision controller |
| `d7f6894` | 09-21 | lobatskiy-repo | update: code |
| `2693b9a` | 09-17 | lobatskiy-repo | refactor(countertop): remove the legacy pointer recognizer and its compat exports |
| `b8ea822` | 09-17 | lobatskiy-repo | refactor(countertop): extract spatial manipulation into a pure ESM core |
| `31fa797` | 09-15 | lobatskiy-repo | feat(countertop): add collision highlighting to drag baseline |

Ланцюжки «фікс після фіксу»:
- **2026-09-29…30, D&D стільниці** (після `8c810cb` length limits + countertopOverlay): `f3eda41` (sink лишається позаду) → `5e716b2` (runaway; у `_fixes` «red on `8c810cb`») → `1cb4b64` (колізії з ULH-тумбами в D&D) → `fbc7477` (втрачається отвір мийки) → `3448111` (remote top без збереженої довжини на relayout). Три з них мають `_fixes`-розбори.
- **2026-10-07…08, sink owner** (після `865560c` trap keep-out і `a68d4fc` sink owner): `e9b3aa6` (лише cutters sink mount належать CT) → `9e4d790` (jitter не є підйомом; trap keep-out лише над сифоном) → `33851ad` (audit fixes + headless sink sweep) → `a9dd893` (drag resting top цілим, re-cut на release).
- **Кавер, 2026-09-25…10-16**: `021a371` (ULH матеріал з CabinetColor) → `ba28ede` (сусіди за фізичною суміжністю) → `d0d55a6` (явний матеріал кавера) → `b4a9aee` (без кавера під тумбою на support) → `5ba85a1` (UF PTO 85, кавери за ручкою) → `0eacb14` (UF open shelves, короткій тумбі свій кавер) → `08eee92` (UD open shelves і cover plan).

---

## 6. Live-перевірка

| Що | Джерело |
|---|---|
| Launch local dev: `https://launch.playcanvas.com/2596616?debug=true&local=true` | `docs/features/ulh-cabinet-addition/local-dev-workflow.md:13` |
| Engineering Launch: `https://launch.playcanvas.com/2596616?debug=true&local=true&cabinetFromLine=1&cabinetEngineering=1&cabinetDebug=1` | `developer-architecture.md:586`, `line-to-modular-guide.md:13`, `engineering-mode.md:7` (там `cabinetDebug=1&cabinetEngineering=1` без `cabinetFromLine`) |
| `debug=true&local=true` потрібні лише dev-завантажувачу локальних файлів; runtime від URL не залежить | `local-dev-workflow.md:14`, `ui-integration-guide.md:8`, `developer-architecture.md:592` |
| Локальний сервер: `node tools/server.js` з батьківської теки моста → `https://localhost:3000`, потрібні `localhost.pem` / `localhost-key.pem` | `docs/onboarding/README.md:34-37` |
| Dev-panel: додати `?testUI=1` | `Scripts/dev-panel/README.md:6`, `ui-integration-phase1.md` §7 |
| Sink-лог: `?debug=true` або `?sinkLog=1` або `window.__SINK_LOG__ = true` → групи `[sink-log]` на кожну зміну zone / owner / landing (позиції, AABB, зв'язки top / sinks / cabinets); `countertopSinkDump()` — поточний snapshot. Код: `AC/domain/countertop/debug/countertop-sink-log.mjs` | `docs/countertop/ui-integration-phase1.md:216-218` |
| Перед скріншотом / експортом: `await api.countertop.whenSettled()` і `await api.cabinetCover.whenSettled()` | `ui-integration-guide.md:207` |
| API брати з `iframe.contentWindow.ConfiguratorAPI`, не кешувати об'єкт між reload | `ui-integration-guide.md:9` |
| `countertop.getState().offset` для remote-стільниці перераховується при зсуві бази ряду | `ui-integration-guide.md:206` |
| Кеш збірки: «Дві різні збірки з номером «038», у клієнта стара версія» → кожен експорт — новий номер (v039+) | `docs/onboarding/05-current-state.md:24` |
| UI отримує зміни лише після нового експорту збірки PlayCanvas (`v0NN`); «Кожен експорт — новий номер, інакше кеш покаже стару збірку» | `docs/onboarding/README.md:68` |
| `activateFromLine is not a function` → «Інший runtime/sandbox або старий bundle» | `developer-architecture.md:754` |
| Для Launch без `local=true` і для publish нові модулі мають бути в PlayCanvas-проєкті | `local-dev-workflow.md:235`, `ui-integration-guide.md:37, 356` |
| Phase 2 staging UI: `https://hasting-modular-phase-2-p98qb.ondigitalocean.app/prebuilt/model?collectionId=urban-low-height` (також `class`, `mako`) | `docs/onboarding/README.md:47` |
| Що міряли live у `_fixes`: `validCutters` правила після руху; top і sink разом після drag 23.7 см → Apply; drags 3.4 / 13 / −5.5 см без runaway (fix емульовано в runtime) | `docs/features/ulh-cabinet-addition/_fixes/2026-09-29-countertop-*.md` |
| V1-чекліст: «Використати canonical PlayCanvas source/branch, не stale export», записати Launch URL у run log, console без unexpected exceptions, `setMovementGrid({})`, touch на фізичному пристрої; regression preset exterior corner (`presetProducts`, `setConfigBatch({}, { Thickness: '5.5' })`, `countertop.whenSettled()`) | `docs/verification/countertop-snapping-testing.md` §2, §8 |

---

## Не перевірено

- Live-запуск у PlayCanvas Launch не виконувався; URL і сніпети взяті з документів.
- «Маркери свіжості бандла» (рядок/версія в консолі для звірки зі staging) у md-документах репо не знайдено; пастка кешу `038` задокументована лише в `docs/onboarding/05-current-state.md:24` і `docs/onboarding/README.md:68`.
- Точна кількість тестів у параметризованих `countertop-collision-profiles.test.mjs` і `trap-keepout.test.mjs` окремо не рахувалась (у сумі countertop-* = 136).
- Файли для TODO `A3`, `A4`, `A5b`, `B1`, `B3` не визначались (B5/B6 — `risk-basin-top-groups.test.mjs`).
- Причини червоних `uf-type-transform-config` (expected 2 / actual 0), `tricot-cabinet-dimensions`, `urban-duplex-size` по коду не розбирались.
- Чи існують у поточному API `setMovementGrid` і snapping toggles із `docs/verification/countertop-snapping-testing.md` — не перевірялось (перевірено лише відсутність `getCollisionState`/`getCollisionConfig`/`setSnappingEnabled`/`getSnapState` у `Scripts`).
- Зміст `docs/features/cabinet-cover/`, `AC/domain/spatial-manipulation/docs/KNOWN-ISSUES.md` і `RULINGS.md` не читався.
- Відповідність `docs/features/countertop-collections/README.md` змінам `0eacb14` / `08eee92` (10-15…16) детально не звірялась.
- Чи пресети `LOADER_PRODUCTS` (ULH SB-набори) створюють стільницю автоматично — не перевірялось.
