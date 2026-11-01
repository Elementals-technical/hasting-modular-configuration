# Стільниця: правила клієнта, маніфест HR, рішення і відкриті питання

Джерела: `Urban-Low-Height-Countertop-Positioning-Clarification 2.docx` (відповіді Райана, 05.10) → `research/ulh-countertop-positioning-verified-2026-10-05.md` (44 правила звірено) і `plans/ulh-countertop-positioning-rules-tasks-2026-10-05.md`; `docs/rules-manifest.md` у репо (HR-CT, HR-CV); рішення Андрія з `handoffs/p3-sink-landing-movesink-state-2026-10-08.md`, `plans/countertop-lowered-remote-beside-cabinet-2026-10-09.md`, `research/sink-separates-from-top-on-landing-2026-10-09.md`; `research/block2-v3-code-compliance-2026-10-06.md`. Правило в коді посилається на `HR-CT-NN`; розбіжність коду з документом клієнта — питання Райану, не рішення розробника.

## Терміни
CT — стільниця (`Top_*`, basin top). SB — тумба з мийкою (у ній раковина; на ній основна CT); SC — бічна тумба; OS / OSS — відкрита / бічна відкрита полиця. Trap / сифон — під basin, завжди по центру SB. Cover / кавер / cap-CT — додаткова стільниця на тумбах поза основною. Клієнт: **Standard** = наш Default, **Connected** = Standard + Offset, **Width** (§15/§17) = Length у UI.

## Режими (клієнт ↔ код)
| Режим | Клієнт (R1) | Код (`countertop-layout-policy` / adapter) |
|---|---|---|
| Standard / Default | CT стоїть на тумбі | `placementState: 'attached'` — \|offset\| ≤ 1e-6 м; довжина композиції (`customLength === null`); drag u+v |
| Offset / connected | зсунута, частково спирається; рух **лише L/R** | **класифікатора в коді немає** (план `countertop-offset-state-minimal-changes-2026-10-06` з `classifyCountertopPosition` не злитий у жодну гілку). Режим задає UI за товщиною: 4″ → `setVerticalLocked(true)` → `setOffset` з y > 1 см кидає `COUNTERTOP_VERTICAL_LOCKED`, drag — лише `u`; `getState().verticalLocked / verticalLockViolated` |
| Remote | не торкається тумби; рух L/R + Up/Down | `placementState: 'moved'` з вільною вертикаллю (2.4″ / 5.125″ / 5.5″ → UI `free`). У коді «remote» ще означає: (1) зсунута CT у модульній композиції (`preserveCabinetPositions`) — довжина фіксується в `CountertopLengthM`, `_anchorRemoteOffset` тримає світову позу; (2) виріз поза рядом — landing `none` / `reason: 'DETACHED'`, поза валідна |
| Resting (код) | — | \|offset.y\| ≤ `COUNTERTOP_REST_TOLERANCE_M` = 1 см і CT перекриває тумбу по X > 1 мм (`_isResting`); lifted — y > 1 см |
| Lowered / beside (рішення Андрія 09.10) | — | CT біля тумби без перекриття X може йти **нижче** верху тумби; підлога — верх кавера сусідньої крайньої тумби (`COUNTERTOP_BELOW_COVER` при y < −1 см і surface > 1 мм нижче); раковина лишається з CT, landing `none` |

⚠ Клієнтське «Remote does not contact» не збігається з його ж відповідями (abutted flush, 0″ дотик дозволено) — відкрите питання A2. ⚠ Тонкі топи (< 1″) — UI режим `none`: меню Position сховане, зсунута CT повертається в Standard.

## Правила клієнта (нормалізовані, з номерами з research-документа)
**Рух і снап**: R4.1 горизонталь неперервна; R13.4 вертикаль у Remote — снап 1″; R13.3 snap origin — 34-¼″ від підлоги до верху CT (умовно); R5 freeform за замовчуванням + Align Left/Center/Right + опційний м'який снап до швів/країв (tolerance/пріоритет — клієнт чекає нашу пропозицію); R10.3 завжди rear-aligned до стіни.
**Offset (connected)**: R2.1 мінімального перекриття немає; R3.1 максимального виносу немає (ghost brackets); R2.2 матеріал/кронштейни/faucet/overflow — без обмежень; R2.3/RB2.6 товщина 5-⅛″ і 5-½″, 4″ — лише коли під basin стоїть SB (або Vessel — суперечність A1); R6 стилі Integrated + Vessel (Undermount у продукті немає); R10.1 глибина тумби = глибині CT.
**Remote**: R7.1 горизонталь без min/max, тумба може бути повністю поза футпринтом; R7.2 abutted — верх CT ≥ верх тумби; R7.3 SC/OS під трапом — V min 8″; R7.4 поза 6″-зоною — V min 0″; R7.5 V max немає; RB1.5 товщина лише 5-⅛″/5-½″; R10.2 тумба ≤ глибини CT.
**Trap keep-out (усі режими)**: R11.1 6″ ліворуч/праворуч від трапа до тумби; 8″ V від низу CT для тумби під трапом; R13.5 конфлікт → блокувати рух + червоний ghost-оверлей; RB1.6 drag CT з SB у конфлікт → snap back (K1: block vs snap back — не узгоджено).
**Resize** (R15–R17): Width і Depth редаговані, крок 0.1″; min/max — від матеріалу (+ basin style для Depth, Google Sheet); width — **тільки ручками на торцях**, basin лишається на місці; поле Length read-only з підказкою; R15.5 край basin ≥ 10 см від краю CT (Vessel — без відступу); R16.2 з SB — CT не коротша за SB (або ряд SB); R16.3 трап по центру SB; R16.6 basin над SB не рухати; винесення basin повністю за SB → SB стає SC (C4/C5 TBD).
**Переходи** (B1/B2): Standard→Remote: усі тумби SC/OS/OSS, SB → еквівалентна SC; cap-CT на remote SC (не на OS; SC впритул до OS/OSS → на весь ряд); трап видно завжди. Remote→Offset: тумба на місці трапа має бути SB — авто SC→SB або повна заборона **TBD**; cap-CT прибрати з накритих ділянок.
**Трап (візуал)**: R14 видно лише коли відкритий; generic «голографічний»; схований лише в SB.
**SKU/ціна** (R12): позиція CT ціну не змінює; довжина — існуюча структура; cap-CT — нові SKU за тією ж структурою для 3D, LACM, LACG, ST, BM, ESS.

## Маніфест `docs/rules-manifest.md` (стан 13.10, код — `countertop/*`, `bridge/plugins/cabinet-local-runtime.mjs`)
| ID | Правило | Було | Стан |
|---|---|---|---|
| HR-PL-06 | Зона сифона: жодна тумба, крім SB-хоста, не заходить у 6″ L/R і 8″ під низом CT; діє і при перетягуванні CT (червоний overlay, snap back) | V-31a, V-40 | ✅ `TRAP_KEEPOUT` |
| HR-CT-01 | Посадка раковини: опущена CT, виріз над іншою тумбою; підходить SC з верхом −2 см…+5 мм від низу CT; інакше `unfit` (TYPE/HEIGHT), `gap`, `none`; UI підтверджує → SB↔SC | P.3 | ✅ |
| HR-CT-02 | Підняли CT > 1 см — забирає раковину (SB→SC); опустили над SC — SC→SB; тому в remote немає SB | RB1.1, V-30, V-31 | ✅ |
| HR-CT-03 | Ресайз ручками: крок 0.1″, кінець прилипає до країв тумб/композиції в межах 1″, min/max матеріалу | R15.3, R16.4 | ✅ |
| HR-CT-04 | Приєднану (standard) CT теж можна ресайзити з торців; далі тримає свою довжину | R16.1 | ✅ |
| HR-CT-05 | Ширина CT — лише ручками, раковина на місці | R15.4, R16.5 | ✅ рушій · ручки — UI |
| HR-CT-06 | Край раковини ≥ 10 см від торця (не більше половини вільного місця на тумбі); Vessel — 0 | R15.5 | ✅ `basinEdgeMarginM` (тимчасово, до відповіді Райана) |
| HR-CT-07 | CT не коротша за SB і накриває її | R16.2, V-22 | ✅ `SINK_BASE_NOT_COVERED` |
| HR-CT-08 | Remote: CT на винесених SC, не на OS; SC впритул до OS → на всю групу | V-32 | ❌ |
| HR-CT-09 | Рух раковини по CT (10 см і зона сифона) | V-41…V-45 | ❌ фаза 2 |
| HR-CV-01 | Кавер на тумбах поза основною CT для ULH, UD (модульний режим), UF; сусідні тумби однієї колекції/кольору/висоти/глибини — один кавер | — | ✅ · за ролями — відкладено |
| HR-CV-02 | UF: основна CT на найвищих тумбах впритул; решта — кавер; одна найвища група, якщо кілька — ліва | — | ✅ |
| HR-CV-03 | Колір кавера = `CabinetColor`; спільний колір на композицію | — | 🟡 спільного немає |

Відкрите в маніфесті: глибина кавера UF 48 чи 50; UD з 56 і 28 в одному ряду — підключити HR-CV-02; HR-CV-03 спільний колір потребує команди модульного режиму.

## Рішення Андрія (власник 3D-логіки)
- 08.10: **3D звітує, UI комітить**; 3D ніколи не змінює тип тумби (SB↔SC робить UI через `cabinets.moveSink`); прийняті ризики: нові id з новим префіксом після swap, `scene.replace` flash, pricing SB/SC — UI, undo — UI, дві раковини під однією CT — поза скоупом.
- 09.10: **раковина і CT завжди разом** — remote і на тумбі; або вся CT з раковиною снапиться, або поза блокується; раковина ніколи не рухається сама. Реалізовано: hosted sink (`cabinets.liftSink/landSink`, RB1.1), один sink host (`sinks[]` → CSG, матеріал, трапи).
- 09.10: lowered remote beside cabinet — три зони (resting |y| ≤ 1 см + перекриття X; lifted y > 1 см; beside — без перекриття X, будь-яка висота); owner hysteresis: раковину підхоплюють при виході з rest-смуги (|y| > 1 см), додому — лише коли CT знову на тумбах і landing ≠ fits.
- 06.10 (рев'ю руху): дві відповіді про колізію (рушій `unknown` vs box-перевірка overlay) залишено й задокументовано — авторитет для червоного/Apply = кадр overlay; `onlyWhenFrozen: 'v'` правила лишено для Offset; V1-runtime рушія — переписувати після Offset і перемикача снапу.
- UI (08.10, d72350ce): режим руху за товщиною — тонкі < 1″ → `none`; 4″ → `offset` (`setVerticalLocked(true)`); 2.4″ / 5.125″ / 5.5″ → `free`; 'fits' над SC → `moveSink` одразу, без діалогу.

## Числа (єдине місце)
| Параметр | Значення | Де |
|---|---|---|
| Lift (CT забирає раковину) | offset.y > 1 см (`COUNTERTOP_REST_TOLERANCE_M = 0.01`, adapter:46); у момент підхоплення `shift = −offset.x` | adapter `_placeSinks` |
| Rest tolerance | \|y\| ≤ 1 см і перекриття тумби по X > 1 мм | `_isResting` (adapter ~:749) |
| Vertical lock | `setOffset` з y > max(1 см, поточний y + 1e-6) → `COUNTERTOP_VERTICAL_LOCKED` | adapter ~:458; UI вмикає для 4″ |
| Sink landing fits | верх SC: `levelDy` ≤ +5 мм і ≥ −2 см (асиметрично; док-коментар каже «within 2 cm»); виріз цілком над кандидатом, tol 1 см; кандидат не SC → `TYPE` | `_sinkLanding` |
| Below cover | surface > 1 мм нижче верху кавера крайньої тумби при y < −1 см | drag guard |
| Basin edge margin | min(0.10 м, (hostWidth − cutoutWidth)/2); Vessel 0 | `countertop-resize-bounds.mjs` |
| Trap keep-out | 6″ L/R, 8″ під низом CT; хост-SB виняток | `trap/trap-keepout.mjs`, placement `trapKeepOut` |
| Resize крок / снап | `COUNTERTOP_RESIZE_STEP_M` = 0.1″; прилипання до країв тумб/композиції в межах 1″ (`COUNTERTOP_RESIZE_SNAP_TOLERANCE_M`); пріоритет composition-edge > cabinet-edge > limit-min > limit-max > basin-min; clamp переважає округлення | `countertop-resize-snap.mjs:8–15` |
| Довжина | min 0.6 м (одна тумба), max 120″ (3.048 м); `lengthLimitsIn`/`lengthPresetsIn` по колекціях | `countertop-length-limits.mjs` |
| Side panels | +1 см за end-панель; одна сторона → зсув ∓0.5 см | `countertop-layout-policy.mjs` |
| Колізія (overlay) | перекриття > 1 мм по кожній осі; дотик — не колізія | `countertop-drag-overlay.mjs` |
| Attached ε | 1e-6 м | `COUNTERTOP_ATTACHED_EPSILON_M` |
| Drag threshold | 6 px; снап mouse 8/14 px, touch 12/22 px | spatial `DEFAULT_SPATIAL_DRAG_THRESHOLD_PX`, `DEFAULT_SNAP_THRESHOLDS` |

## Відомі 3D-баги / борг (з handoff-ів, не виправлені станом на 16.10)
1. `COUNTERTOP_RESIZE_STEP_M` не віддається через API — UI дзеркалить константу.
2. `_landingAnnounced` скидається лише при owner === 'cabinet' → повторний drop на той самий SC не емітить `sink-landing`, `sink.pending` висить.
3. Відхилений `setOffset` емітить move-події невалідної пози до revert (мерехтіння).
4. Опускання через API не емітить `sink-landing` (лише drag-end) → авто-опускання 4″ над SC веде в `resetOffset`.
5. `resetOffset` з carried shift ≠ 0 закінчує в x = −shift, не Standard.
6. `RuleChangeSinkType` слухає лише `sinkType` (hosted sink type change).
7. ~~`global-bridge` guard без `resizeFrom`~~ — закрито: `global-bridge.mjs:169` містить `['setOffset','resetOffset','setSize','resizeFrom']`.
8. UF: `UFConfig.baseHeightM 0.03` ніде не читається; `UFBaseboardService` рухає лише X; Z CT ніколи не вирівнюється до тумби (`z: localPosition.z`).
9. Контракт у 4 копіях (фасад, `domain/countertop/README.md`, `docs/countertop/ui-integration-phase1.md`, UI `types.ts`); `LEGACY_WRITERS_BUSY` є в UI enum, немає в `COUNTERTOP_ERROR_CODE` (адаптер його кидає поза enum).
10. Валідація (знайдено 20.10): `BASIN_CONFLICT` в overlay практично не спрацьовує (умова на `coverageViolations` інвертована); `LENGTH_OUT_OF_RANGE` порівнює з `requestedMinM`, а не `minLengthM`; overlay блокує Apply на колізії/довжині, а `dragGuard`/API таку позу пропускають (колізія — лише warning).
11. Снап: group-edge бічні панелі (orderIndex ±0.5) відфільтровуються `countertop-snap-targets.mjs:40` → не дають snap-цілей і не входять у межі композиції; UF joint-смуга лишається snap-ціллю і перешкодою для CT (у модулів виключена).
12. `gesturecancel` (Esc, blur, touchcancel) веде в той самий `finish`, що й `gestureend` — тобто комітить поточний offset, а не повертає до старту жесту.

## Відкриті питання
**Райану**: A1 4″ Vessel без SB; A2 визначення Remote при 0″ дотику — connected чи remote; A3 §7 заголовки (0″-кейс не під трапом); A4 snap origin 34-¼″ і чи 8″ інше для USH (C2); A5 basin над SB / авто SC→SB чи блок (C4 = C5); A7 два SB — одна CT чи дві, дві раковини; A8 width min/max (48″/120″ плейсхолдер?); A12 keep-out, коли трап схований у SB; K1 block vs snap back; K2 Depth у connected при «must match»; HR-CT-06 правило 10 см — open item; gap-кавер / OS теж отримує кавер (HR-RW-06).
**Імплементаційні (17–29 у research)**: режим — явний перемикач чи геометрія; Offset з перекриттям → 0; Align L/C/R відносно ряду чи SB; 4″ при переходах; глибина при Remote→connected (46 під 50); сітка 1″ vs контактні позиції; «equivalent SC»; накладка на частково накриту SC; геометрія keep-out (від краю чи центру трапа; OS/OSS); abutted і загальна заборона взаємопроникнення; 10 см — лише торці чи й глибина.
**Андрію**: cover depth UF 48/50; `resetOffset` з shift; snap-back vs clamp (motion.constrain hook відкладено).
