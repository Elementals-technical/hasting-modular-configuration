# Side panels — тести, dev-panel, docs, live (scope `playcanvas`)

Зібрано 2026-10-19 у `src/` (вкладене репо playcanvas-hasting), гілка `feture/part-2`, HEAD `5310d1f` (2026-10-16). Node v22.23.2.
У робочому дереві є staged-зміни, не пов'язані з side panels (`countertop-drag-overlay.mjs`, `countertop-edit-overlay.mjs`, `RuleHeightUDOpenShelvesSide.mjs`, два docs, `tests/node/countertop-dimension-units-suppression.test.mjs`). Базова лінія нижче знята з цим деревом.

Скорочення: `AC/` = `Scripts/app-configuration/`.

---

## 1. Node-тести

### 1.1 Файли саме про side panels (`tests/node/*side-panel*.test.mjs`, 7 файлів, 55 тестів)

| Файл (останній коміт) | Тестів | Що перевіряють (за назвами тестів) | Хелпери / імпорти |
|---|---|---|---|
| `tests/node/side-panels-group-policy.test.mjs` (2026-10-14) | 11 | Чиста політика груп: два ряди з розривом дають 4 панелі; краї, розміри й матеріали не залежать від порядку вставки; вертикальний стек має окремі панелі без сумування висоти; глобальний вибір сторони для всіх рядів, `None` не створює панелей; дотичні шафи з різних груп ховають спільну грань (толеранс контакту ряду); часткове перекриття по висоті/глибині не створює обрізаної панелі; два сусіди в стеку разом закривають вищу грань; той самий X на іншому рівні/глибині грань не ховає; несумісна крайова шафа не замінюється внутрішньою; непідтримувані розміри й невідомі bounds не дають панелі; split/regroup зберігають ідентичність краю незалежно від `SupportGroupId` | без stub; імпортує напряму `AC/domain/addons/side-panel-group-policy.mjs` (`planGroupSidePanels`, `classifySidePanelExposure`) і `AC/domain/product/logic/ulh-side-panel-policy.mjs` (`ULH_SIDE_PANEL_PRODUCTS`) |
| `tests/node/side-panels-groups-integration.test.mjs` (2026-10-14) | 16 | Інтеграція з aggregator: `both` дає 4 продукти на реальних X/Y/Z рядів з матеріалом і розміром своєї шафи; видалення середньої шафи ділить ряд і додає дві внутрішні панелі без заміни зовнішніх ID; закриті/часткові грані прибирають застарілі панелі, повторне відкриття відновлює вибір; стек має 4 незалежні панелі, верхні стартують від верхнього pivot; snapshot restore регідрує кілька продуктів однієї сторони зі збереженням ID; непідтримувані сторони зберігають вибраний тип через snapshot з нулем панелей; старі ULH-панелі мігрують на місці; стільниця враховує заплановані панелі своєї групи в першому циклі й прибирає допуск на `None`; collision scene впорядковує панелі біля якоря; towel bars беруть панель свого крайового кабінету; реальний aggregator реагує на regroup і передає нові панелі наступним правилам у тому ж циклі; зміна розміру/матеріалу шафи оновлює її продукти, непідтримувані розміри прибирають геометрію; видалення останньої шафи чистить усі панелі, повторне додавання відновлює вибір; невдала підготовка панелі dispose-ить нові entity; відсутній ULH-шаблон не публікує й не прайсить generic placeholder; підтримка мийки не розширює X/Z панелі й не змінює низ шафи | `./helpers/playcanvas-stub.mjs` |
| `tests/node/countertop-side-panels-group.test.mjs` (2026-09-30) | 8 | Стільниця в free layout рахує панель на зовнішньому краї своєї support group (і при застарілому X entity); ігнорує панелі сторони, якої група не досягає, і панелі іншого ряду; не рахує нижній ряд не на зовнішньому краї; при спільному X-краї рахує лише сусідню панель; standard layout рахує всі панелі; `RuleSidePanels` міряє шафи без піддерева sink mount anchor | `./helpers/playcanvas-stub.mjs` |
| `tests/node/ulh-side-panel-policy.test.mjs` (2026-10-16) | 8 | ULH: стан Handle визначає вигляд панелі; таблиці висоти/глибини/дзеркала від художника; непідтримувані розміри без часткового плану; ULH-кабінети декларують підтримку панелей, спільний addon вантажить ULH-шаблон; `SidePanelAddon` вибирає ULH-шаблон, зберігаючи legacy API; addon синхронізує вигляд і матеріал з крайовою шафою; `RuleSidePanels` ресинхронізує матеріал при зміні `CabinetColor`; scene rule застосовує один повний ідемпотентний план | `./helpers/playcanvas-stub.mjs` |
| `tests/node/ulh-side-panel-materials.test.mjs` (2026-10-16) | 6 | ULH-панелі мають власне material rule колекції; legacy material rules не містять ULH node names; `CabinetColor` на панель, активний groove color на inlay; fallback inlay на `CabinetColor`; legacy rule лишає активний inlay `RuleChangeHandleGrooveColor`; legacy rule повертає `CabinetColor` неактивному inlay | `./helpers/playcanvas-stub.mjs` |
| `tests/node/uf-side-panel.test.mjs` (2026-10-14) | 4 | UF: end panel — частини за висотою корпусу, stretch по mesh-local осях, непідтримувані висота й сторона; joint strip лише для 88+53; group plan 88/53 дає два кінці й один joint на вищій шафі; layout rule ідемпотентно на fake nodes | `./helpers/playcanvas-stub.mjs`; `planGroupSidePanels` з `AC/domain/addons/side-panel-group-policy.mjs`; `AC/domain/product/rules/CabinetUrbanFreestanding/RuleUFSidePanelLayout.mjs` |
| `tests/node/tricot-side-panel.test.mjs` (2026-10-16) | 2 | Tricot: ряд SC/SB/SC дає по одній plain-панелі на кожному зовнішньому кінці, registry підключає шаблон; layout rule показує панель і дзеркалить за стороною, ідемпотентно | `./helpers/playcanvas-stub.mjs`; `planGroupSidePanels` |

Результат `node --test tests/node/*side-panel*.test.mjs`: **55 tests / 51 pass / 4 fail / 0 todo**.

- Усі 4 падіння у `tests/node/uf-side-panel.test.mjs` (усі 4 тести файлу). Перше: `height 50` → `actual 'unresolved'`, `expected 'resolved'` (рядок 39).
- Тест викликає `resolveUFSidePanelPlan({ side: 'right', height, depth: 45 })` (рядок 38). Коміт `9463eab` (2026-10-15, «fix(uf): depth 46 instead of 45, as in the price list») змінив `AC/domain/product/logic/uf-side-panel-policy.mjs`, `UFConfig.mjs`, правила глибини UF, `collection-presets.mjs`, `side-panel-guide.mjs`. Сам тест востаннє змінено в `4b4e97e` (2026-10-14), тобто після переходу на 46 його не оновлювали.

### 1.2 Суміжні тести, де є side panels

| Файл | Що стосується панелей |
|---|---|
| `tests/node/ulh-side-cabinet-visibility.test.mjs` (2026-10-16), 1 тест | `ULH side cabinet hides inactive boolean cutters from layout AABB`. Це pinning-тест фіксу з `_fixes/2026-09-24-side-panel-depth-drift.md` |
| `tests/node/addon-rehydration.test.mjs` | Регідрація addon `SidePanel` з продуктами `SidePanel_Left/Right` і `ULH-SidePanel_Right` (`SidePanelType`) |
| `tests/node/countertop-collision-profiles.test.mjs` | Профілі колізій `side-panel-left/v1` / `side-panel-right/v1` для `SidePanel_*` і `ULH-SidePanel_*`; фікстура `sidePanelUpperG46Fixture` (`tests/node/fixtures/collision/archive-geometry.mjs`) |
| `tests/node/ulh-rule-structure.test.mjs` | Структура правил для `ULH-SidePanel_Left/Right` разом з іншими ULH-типами |
| `tests/node/collision-config.test.mjs` | Роль `side-panel` у `supportedPartRoles` / `excludedPartRoles` |
| `tests/node/countertop-overlay-box-collision.test.mjs` | Продукт `ULH-SidePanel_Right` у сцені колізії overlay |
| `tests/node/lame-undertop.test.mjs`, `lame-cabinet-pattern.test.mjs`, `lame-cabinet-materials.test.mjs`, `tricot-cabinet-materials.test.mjs` | Ноди `*_SidePanel*` у матеріалах/патернах; `separate or unready side panel never blocks cabinet patterns; late targets retry` |
| `tests/node/spatial-manipulation-playcanvas-adapter.test.mjs` | Entity `Side_Panel` як дочірня в transform-hierarchy snapshot |
| `tests/node/cabinet-cover-composition-adapter.test.mjs` | Addon `SidePanel` у списку |
| Goldens: `tests/node/goldens/countertop-collision-outcomes.json`, `countertop-collision-scenes.mjs`, `countertop-snap-harness.mjs`, `countertop-snap-vectors.mjs` | Містять side-panel продукти у сценах колізій/снепу стільниці |

Прогін `*side-panel*` + `ulh-side-cabinet-visibility` + `addon-rehydration` + `countertop-collision-profiles` + `ulh-rule-structure`: **69 / 65 pass / 4 fail** (ті самі 4 з `uf-side-panel`).

Файли з `side` в назві, але за назвами вони про бічні шафи/полиці, а не про панелі: `ud-open-shelves-side`, `ud-open-side-shelf-rules` (3 тести про дзеркалення й висоту UD open side shelf), `uf-open-shelves-side`, `mako-side-cabinet-type`. Тестів з `towel`/`snapshot`/`rows` у назві, присвячених саме панелям, немає. Панелі в towel bars і snapshot перевіряє `side-panels-groups-integration`.

Хелпери в `tests/node/helpers/`: `playcanvas-stub.mjs`, `playcanvas-stub-hooks.mjs`, `countertop-vm.mjs`, `countertop-sweep-fixture.mjs`. Фікстури: `tests/node/fixtures/{collision,placement,spatial-manipulation}/`, `preset-goldens.json`.

### 1.3 Базова лінія повного прогону

`node --test tests/node/*.test.mjs` (171 файл, близько 11.4 с): **tests 1083 / pass 1054 / fail 22 / todo 7 / skipped 0** (`1..1068` верхнього рівня).

Падіння (не TODO):
- **UF:** `uf-side-panel` ×4 (див. 1.1), `uf-cabinet-dimensions.test.mjs` і `uf-cabinet-type.test.mjs` (падають на рівні файлу), `baseboard sums UF widths…`, `service centers UF mesh…`, `UrbanFreestanding materials…`, `UF side shelves: all height/depth transitions…`, `UF open shelves follow size tables…`, `UF sink applies visibility and Boolean…`, `UF Sink leaves visibility unchanged…`.
- **Tricot:** `Tricot registers sink and side products…`, `Tricot drawer transitions…`, `Tricot materials follow the table…`, `Tricot products register Satin by default…`.
- **UD:** `Urban Duplex registers sink and side and restores size transforms…`, `Urban Duplex: Drawers decides whether the top handle exists…`.
- **Інше:** `Lame material groups…`, `sink mount metadata maps every collection to its scene anchor`, `test UI mounts only behind the flag and only talks to ConfiguratorAPI`.

TODO (7, очікувані): B5, B6, A5b, A3, A4, B1, B3 (rows/compact preset).

---

## 2. Dev-panel (тестова панель)

**Як відкрити:** додати `?testUI=1` до URL сторінки (`Scripts/dev-panel/README.md:6`; `Scripts/dev-panel/test-ui.mjs:9`). Монтування відбувається в `AC/bridge/global-bridge.mjs:195-196` (regex `/[?&]testUI=1(?:&|$)/`, модуль вантажиться на вимогу). Панель працює тільки через `window.ConfiguratorAPI`.

**Структура:** `Scripts/dev-panel/{README.md, components.mjs, test-ui.mjs, data/{collection-presets.mjs, side-panel-guide.mjs, urban-duplex-presets.mjs}, sections/{cabinets,countertop,presets,side-panels,urban-duplex}.mjs}`.

### 2.1 Секція `sections/side-panels.mjs` (371 рядок, id `side-panels`, title `Side panels`)

- **Set:** select типу (NoG / UpperG / CenterG / DoubleG); кнопки `On left` / `On right` / `On both` / `Off left` / `Off right` / `Off all` / `Left only` / `Right only`. Виклик `setConfigBatch({}, { SidePanel, SidePanelSide })` (README:16-17).
- **Handle:** поля ручки з `HANDLE_CONTROLS` застосовуються до all / left-edge / right-edge / selected шаф кнопкою `Apply` (`setConfigBatch({ productIds }, { field: value })`, рядки 301-309).
- **State (readout):** збережений вибір, кожен продукт-панель (side, type, H × D, anchor cabinet, group, X), краї кожного ряду з панеллю чи без. Біля кожної панелі показано очікуваний тип за гайдом (✓ / ✗, через `expectedPanelType`).
- **Guide test cases:** select `Case` з `GUIDE_TEST_CASES` і кнопка `Load preset` (рядки 313-332, через `loadPresetPayload` з `sections/presets.mjs`).
- **Edges plan (ULH, UF) → `Measure edges`** (рядки 337-344, 356): викликає `ConfiguratorAPI.config.compositionManager.sidePanelAddon.prepareGroupPlan({})` зі свіжим `shared`, тобто без кешу циклу правил. Потребує `addon.usesGroupPanels()`, інакше `GROUP_PLAN_UNAVAILABLE`. Повертає `{ status, panels }`. View показує exposed / covered / partial для кожного краю й joint і причину, чому на вибраній грані немає панелі.
- Читання йде через debug escape hatch `ConfiguratorAPI.config.compositionManager` (публічного read API для панелей немає; README:20, side-panels.mjs:12, 43-48). Єдиний імпорт поза текою: `AC/bridge/clients/cabinet-api-client.mjs`.

### 2.2 `Scripts/dev-panel/data/side-panel-guide.mjs` (140 рядків, останній коміт `f0653f0` 2026-10-16)

Джерело: клієнтський «Hastings Config Guide» (xlsx, версія 14.10.2026). У заголовку «checked 14.10.2026»:
- ULH реалізовано;
- UF реалізовано (`UF-SidePanel_Left/Right`, шаблон `UF_SidePanel`, joint 88+53);
- Tricot реалізовано (`Tricot-SidePanel_Left/Right`, шаблон `Tricot_SidePanel`, 40 × 52, NoG, дзеркало scale x −1 зліва);
- UD є тільки в гайді (legacy-панель, тип = запитаний);
- Class / Mako / Urban Standard: правил у гайді немає.

**`HANDLE_CONTROLS`:**

| Колекція | Поля |
|---|---|
| ULH | `Handle` (`handle_pto` / `handle_urban_topcut`) |
| UD | `HandleSide`, `HandleStyle`, `Drawers`, `Height` |
| UF | `Handle` (`UG` / `PTO` / `CG` / порожнє), `Height` (91 / 88 / 85 / 53 / 50) |
| MAKO | `HandleStyle` (G57 / G50) |
| CLASS, TRICOT, URBAN | — |

**`expectedPanelType`:**

| Колекція | Правило | `implemented` |
|---|---|---|
| ULH | `handle_pto` → NoG, `handle_urban_topcut` → UpperG | true |
| UF | за висотою корпусу (`resolveUFBodyHeight`): 50/85 → NoG, 53/88 → UpperG | true |
| UD | `expectedUrbanDuplexType` | false |
| TRICOT | завжди NoG | true |

**`GUIDE_TEST_CASES` (15):**

| id | Колекція | Пресет | Кроки | Очікування |
|---|---|---|---|---|
| `ulh-handle-switch` | ULH | `ulh-sb` | On both (NoG) → Handle `handle_urban_topcut` на всіх → `handle_pto` | NoG → UpperG (inlay видно) → NoG, панелі не перестворюються (ULH:88-101) |
| `ulh-handle-wins` | ULH | `ulh-sb` | Type UpperG, On both → Handle `handle_pto` на всіх | обидві NoG, запитаний UpperG ігнорується |
| `ulh-mixed-edges` | ULH | `ulh-sc-sb-sc` | On both → `handle_urban_topcut` тільки Left edge | ліва UpperG, права NoG; зміна на середній SB нічого не дає |
| `ulh-gap-four` | ULH | `ulh-two-groups` | On both → Off right | 4 панелі (дві дивляться в розрив), потім 2 ліві, по одній на групу |
| `ulh-stack` | ULH | `ulh-stack-flush` | On both | 4 панелі, висота ряду 38, Y від низу ряду, без сумування |
| `ulh-height-depth` | ULH | `ulh-sb` | On both → Height 25 → 38 → Depth 46 → 50.5 | NoG StretchY 0 → 0.323; StretchZ 0 → 0.09; висоти поза 25/28/35/38/50/56 лишають стару панель (тільки warning) |
| `ulh-open-shelf-edge` | ULH | `ulh-sb-os` | On both | гайд чекає панель біля OS; зараз панелі з боку OS немає (OS без підтримки) — «report if so» |
| `ud-lateral-side` | UD | `ud-row-56` | On both → HandleSide Right → Left на крайових | гайд: Right → DoubleG, Left → NoG (UD:176-179); зараз лишається запитаний тип |
| `ud-53-upper` | UD | `ud-row-56` | Height 53, Drawers 1D на всіх → On both | гайд: UpperG, NoG mesh 56H → 53H; 1DWID / лівий lateral у гайді не визначено |
| `uf-height-handle` | UF | `uf-sb` | On both → Handle порожнє, Height 88 → 85 → 53 → 50 → Depth 50 → 45 | 88 Bot+Top+обидва inlay (UpperG), 85 Full на 3 см вища (NoG), 53 Bot+inlay (UpperG), 50 Bot (NoG) (UF:121-127); «Depth 46: фронт панелі відходить на 4 см, StretchZ −0.08». Кроки кажуть 45, очікування 46 |
| `uf-handle-body` | UF | `uf-sb` | On both → PTO + Height 88 → UG + 91 → CG | PTO: корпус 85, NoCut, без пазів, Full (NoG) на 3 см вища; UG/91: корпус 88, пази + TopCut, UpperG; CG як UG + console warning (немає CG mesh) |
| `uf-joint-88-53` | UF | `uf-joint-88-53` | On both → Off right | 3 панелі: лівий кінець на 88, правий на 53, joint на 88 праворуч (Inlay_Top + Panel_Top); Off right прибирає правий кінець і joint; стільниця не подовжується через joint |
| `uf-joint-unknown` | UF | `uf-joint-unknown` | On both → Edges plan → Measure edges | тільки два кінці; грань 88 до 50 = «partial → unsupported-joint» |
| `tricot-move` | TRICOT | `tricot-sc-sb-sc` | On both | `Tricot_SidePanel` на обох зовнішніх кінцях, 40 × 52, дзеркало зліва, `CabinetColor`, не pattern (Tricot:76-87, 115) |
| `mako-no-rule` | MAKO | `mako-sb` | On both → HandleStyle G57 → G50 | у гайді немає; legacy-панелі без 52-mesh, перевірити неправильну/відсутню панель і спитати, чи потрібні панелі Mako |

### 2.3 Пресети з панелями (`Scripts/dev-panel/data/collection-presets.mjs`)

Колекції (рядки 162-168): `ULH`, `UD`, `URBAN`, `CLASS`, `MAKO`, `UF`, `TRICOT`. Лоадери: `products` = `presetProducts` (один ряд) і `compact` = `composition.importCompactPreset` (кілька рядів/колонок, тільки ULH і UD).

| Колекція | Пресети |
|---|---|
| ULH (69-93) | `ulh-sb`, `ulh-sb-sc`, `ulh-sc-sb-sc`, `ulh-sb-sc-sb`, `ulh-sb-os`; compact: `ulh-two-groups` («both → 4 panels»), `ulh-three-groups` («→ 6»), `ulh-stack-flush` («→ 4»), `ulh-stack-lower-longer` («→ 4») |
| UD (109-111) | `ud-row-56` (`udCase('case4')`), `ud-columns` (`EXAMPLE_COMPACT_PRESET`), `ud-shifted-column` (`case1`). Кейси UD — у `data/urban-duplex-presets.mjs`: `example`, `case1`…`case6`, `multiLevel61OpenShelf` |
| UF (146-155) | `uf-sb`, `uf-sc-sb-sc` (через `sinkAndSidePresets('UF', { Height: 88, Depth: 50 })`), `uf-joint-88-53` («→ 3 panels»), `uf-joint-unknown` («→ 2 panels») |
| TRICOT | `tricot-sb`, `tricot-sc-sb-sc` (Height 40, Depth 52, Satin) |
| MAKO / CLASS | `mako-sb`, `mako-sc-sb-sc`, `class-sb`, `class-sc-sb-sc` (Height 52) |
| URBAN | `ush-sb`, `ush-sc-sb-os` |

Усі `presetId` з `GUIDE_TEST_CASES` є серед цих пресетів (частина генерується через `sinkAndSidePresets`, тому прямим grep по `id: '…'` їх не видно).

---

## 3. Документація в репо

| Файл | Що в ньому | Останній коміт | Стан |
|---|---|---|---|
| `docs/features/ulh-side-panels/` | Єдиний файл: `_fixes/2026-09-24-side-panel-depth-drift.md`. Spec, ADR чи `SIDE_PANEL_API.md` у цій теці **немає** | — | — |
| `docs/features/ulh-side-panels/_fixes/2026-09-24-side-panel-depth-drift.md` | Фікс: ULH-панелі зсувалися на −0.05684 м по Z, бо видимі `ULH_Cabinet_SBBoolBox` / `ULH_Drawer_SBBoolBox` у `RuleTypeSideCabinetULH.mjs` розширювали raw AABB у `RuleSidePanels`. Pinning-тест у `ulh-side-cabinet-visibility.test.mjs` (проходить). Frontmatter `triage: no-spec`, `commit: pending`. Прямо сказано, що спеки немає (рекомендація `/sdd:survey`). Follow-up: runtime-сценарій у сцені (див. 5) | `39b8d24` 2026-10-16 (refactoring-коміт lexa-shamr) | зміст датований 2026-09-24, до group pipeline |
| `docs/verification/ulh-side-panel-points.md` (76 рядків) | Консольний сніпет: обходить `pc.app.root`, шукає `ULH_UniSidePanelPoint`, `ULH_UniSidePanel_Panel`, `ULH_UniSidePanel_Inlay`, `ULH_SidePanel_Point`; пише в `globalThis.__ULH_SIDE_PANEL_POINTS__`. Очікування: окремі типи `ULH-SidePanel_Left/Right`, `ULH_SidePanel_Point` може бути відсутня | `00f173c` 2026-09-24 | застарілий: стверджує, що `RuleSidePanels` позиціонує крайні панелі за AABB композиції, а після `bdd0f85` (2026-10-14) панелі ставляться по рядах/групах (інтеграційний тест «positioned at actual row X/Y/Z»). UF/Tricot не охоплює |
| `AC/services/side-panels/README.md` (161 рядок, укр.) | Legacy `SidePanelsService`: `COUNTERTOP_OFFSET_VALUE = 0.5/100`, `setSidePanelType(type, cabinetId)`, `ensureSidePanelsExist`, `createSidePanel`, `removeSidePanels`, `calculateCountertopOffset`, інтеграція з `RuleCountertopLayout`, імпорт `'../../services/side-panels/index.mjs'` | `eaa21cc` 2026-09-24 | застарілий: 0 згадок `side-panel-addon`, `side-panel-group-policy`, `ulh-side-panel-policy`, `planGroupSidePanels`, `SupportGroup`. Не описує `AC/domain/addons/side-panel-{addon,group-policy,group-measurement,profiles}.mjs` і `AC/domain/product/logic/{ulh,uf,tricot}-side-panel-policy.mjs`, `side-panel-tables.mjs` |
| `AC/services/side-panels/SIDE_PANEL_API.md` (376 рядків, англ.) | Panel Types/Sides; розділ «ULH rows and groups» (спільний `SidePanelSide`, `both` на кожному відкритому краї, 4 панелі для двох рядів, стек без сумування, параметри з крайової шафи); Usage, Legacy API, Bridge API (`setConfigBatch`, `getEdgeCabinets`, `getConfig`), CompositionManager, `SidePanelAddon` (`setType`, `getState`, `getGlobalTypes`, `setGlobalTypes`, `calculateCountertopOffset`, `syncPanelWithCabinet`, `buildConfig`), AddonManager, State Machine, Internal Rules, Files | `bdd0f85` 2026-10-14 | частково актуальний: ULH-групи описані; шляхи з таблиці Files існують (`domain/addons/{side-panel-addon,addon-manager,addon-state-machine}.mjs`, `domain/composition/rules/RuleSidePanels.mjs`, `bridge/plugins/product-config.plugin.mjs`). 0 згадок UF / Tricot і group-policy / measurement / logic-файлів. Internal Rules посилається на `rules/SidePanel/` (`RuleChangeSidePanelVariant`, `RuleChangeSidePanelDepth`, `RuleChangeCabinetColorSidePanel`) — існування не перевірено |
| `Scripts/dev-panel/README.md` (75 рядків), частина `side-panels` (рядки 16-24) | Описує Set, State, Measure edges, Handle, Guide test cases | `215de64` 2026-10-14 | частково застарілий: «Measure edges (ULH)», хоча в коді «Grouped panels (ULH, UF)»; «UD / UF rules are guide-only, not in code yet» суперечить `side-panel-guide.mjs` (UF implemented); для UF вказано тільки `Height`, а в коді `Handle` + `Height`; Tricot не згаданий (`f0653f0` 2026-10-16 новіший за README) |
| `docs/rules-manifest.md` (91 рядок) | Правила `HR-PL-*`, `HR-RW-*` тощо | `5664a75` 2026-10-16 | правил про side panels **немає** (єдина згадка «бічна» — SC / OSS у глосарії, рядок 15) |
| `docs/onboarding/02-core.md` | Порядок правил `CountertopLayout → CountertopBooleanCutouts → SidePanels → TowelBars → SlinkMaterial` (рядок 32); `RuleCountertopCollisionRefresh` останній, читає геометрію після SidePanels (рядок 70) | 2026-10-09 | — |
| `docs/onboarding/05-current-state.md:28` | «Бічні панелі й Towel Bar ULH — Працюють з багами — `CabinetUrbanLowHeight/SidePanel/RuleULHSidePanel*`, `RuleTowelBars`» (тека існує: `RuleULHSidePanelLayout.mjs`, `RuleULHSidePanelMaterials.mjs`) | 2026-10-16 | згадує тільки ULH |
| `docs/onboarding/04-patterns.md:54` | Приклад conventional-коміту `fix(side-panels): …` | 2026-10-16 | — |
| `docs/onboarding/README.md:31-37` | Швидкий старт: `node --test tests/node/*.test.mjs`; `node tools/server.js` (батьківська тека), `https://localhost:3000`, Launch з `?local=true` | 2026-10-09 | — |

---

## 4. Історія (з 2026-09-15)

`git log --since=2026-09-15 -- '*side-panel*' '*SidePanel*' '*side-panels*' docs/features/ulh-side-panels` разом з `--grep` по subject:

| Хеш | Дата | Автор | Subject | fix? |
|---|---|---|---|---|
| `f0653f0` | 2026-10-16 | Andriy Lobatskyi | feat(tricot): side panels on the Tricot_SidePanel template | |
| `6202419` | 2026-10-16 | Elementals-technical | Merge branch 'phase-2-main' into feture/part-2 | |
| `39b8d24` | 2026-10-16 | lexa-shamr | [refactoring]: Create base method _applyTransformConfig in BaseProductRule | |
| `fa60a84` | 2026-10-15 | Andriy Lobatskyi | fix(uf): setConfigBatch keeps a short UF cabinet's own Height | **fix** |
| `9463eab` | 2026-10-15 | Andriy Lobatskyi | fix(uf): depth 46 instead of 45, as in the price list | **fix** (зачепив `uf-side-panel-policy.mjs`, `side-panel-guide.mjs`; після нього червоний `uf-side-panel.test.mjs`) |
| `3767740`, `909fb1d`, `7000a24`, `d80d904`, `39225aa` | 2026-10-15 | Elementals-technical | Merge PR #84 / #82 / #81 / #80 / #79 from `feature/ulh-group-side-panels` | |
| `215de64` | 2026-10-14 | Andriy Lobatskyi | feat(dev-panel): collection presets and side panel test section | |
| `4b4e97e` | 2026-10-14 | Andriy Lobatskyi | feat: add UF side panels through the group panel pipeline | |
| `bdd0f85` | 2026-10-14 | Ruslan Krasiuk | feat: add per-row ULH side panels for exposed group edges | |
| `36ec522` | 2026-10-13 | Andriy Lobatskyi | feat(countertop): per-collection countertop table; UF main top on the sink cabinet, covers for UF and UD | |
| `229873d` | 2026-09-30 | Andriy Lobatskyi | fix(side-panels): X from the clean body (no sink/handles); countertop counts only its group's panels | **fix** |
| `1cb4b64` | 2026-09-29 | Andriy Lobatskyi | fix(countertop): show collisions with ULH cabinets in Drag & Drop | **fix** (знайдено по subject/grep) |
| `2b76546` | 2026-09-26 | Andriy Lobatskyi | feat(ulh): guard legacy writers with private publication authority | |
| `eaa21cc` | 2026-09-24 | Andriy Lobatskyi | update: readme | |
| `00f173c` | 2026-09-24 | Andriy Lobatskyi | feat: add collection-specific ULH side panels | |
| `8d584d1` | 2026-09-21 | lobatskiy-repo | spatial V2 P6: composition modules as the second consumer | |
| `53dab0f` | 2026-09-21 | lobatskiy-repo | feat(countertop): the countertop as a manipulable spec, proven on the goldens | |

---

## 5. Live-перевірка

- **Launch URL:** `https://launch.playcanvas.com/2596616?debug=true&local=true` (`docs/features/ulh-cabinet-addition/local-dev-workflow.md:13`, останній коміт 2026-09-30). `debug=true&local=true` потрібні dev-завантажувачу локальних файлів (рядок 14). Тестова панель додається параметром `&testUI=1` (`AC/bridge/global-bridge.mjs:196`), разом: `…/2596616?debug=true&local=true&testUI=1`.
- **Локальний сервер:** `node tools/server.js` у батьківському репо моста, `https://localhost:3000`, потрібні `localhost.pem` / `localhost-key.pem` (`docs/onboarding/README.md:35-37`; `docs/countertop-collisions.md:7`). Без `local=true` нові модулі треба publish-ити окремо (`local-dev-workflow.md:235`).
- **Маркери свіжості бандла:** у `docs/`, `Scripts/dev-panel/`, `AC/bridge/` не знайдено (grep по `bundle…marker|fresh`, `__BUILD`, `buildStamp`, `BUILD_ID`; у `local-dev-workflow.md` нічого по `кеш|cache|fresh|маркер`).
- **У сцені через dev-panel:** завантажити пресет (Presets або `Load preset` у Guide test cases), виставити `On both` / `Off …`, змінити Handle-поля, звірити readout State (side, type, H × D, anchor, group, X, ✓/✗ проти гайду) і `Measure edges` (exposed / covered / partial, `unsupported-joint`) з колонкою «Очікування» кейсу (2.2).
- **Консольний сніпет точок ULH:** `docs/verification/ulh-side-panel-points.md` запускати в консолі Launch після створення ULH-композиції з хоча б однією панеллю. Read-only, результат у `globalThis.__ULH_SIDE_PANEL_POINTS__`: counts, local/world position, localScale, `smartStretch.stretchAmount` для кожної точки.
- **Програмний план:** `ConfiguratorAPI.config.compositionManager.sidePanelAddon.prepareGroupPlan({})`, як робить `Measure edges` (`Scripts/dev-panel/sections/side-panels.mjs:337-344`).
- **Що міряти (з `_fixes/2026-09-24-side-panel-depth-drift.md`, Follow-ups):** `ULH-side-cabinet + ULH-sink-cabinet`, Depth 46, `handle_pto`, дві панелі; Z-діапазон панелей `0…0.46` з толерансом `0.002` (симптом бага: зсув −0.05684 м; хибний AABB до `z = −0.11369`, центр 0.17316 замість 0.23).
- **Числа з кейсів гайду для сцени:** ULH NoG StretchY 0 → 0.323 (25 → 38), StretchZ 0 → 0.09 (46 → 50.5); UF depth 46: StretchZ −0.08; UF PTO: стільниця на 0.85 над root шафи.

---

## Не перевірено

- Live-сцену не відкривав: жоден кейс з `GUIDE_TEST_CASES` і сніпет `ulh-side-panel-points.md` у браузері не запускав.
- Причини 18 падінь поза `uf-side-panel` (UF / Tricot / UD / Lame / sink mount / test UI) не розбирав; чи пов'язані вони з side panels — невідомо. Для `uf-side-panel` зв'язок з `9463eab` встановлено тільки за датами, параметром `depth: 45` у тесті й переліком файлів коміту, без запуску з `depth: 46`.
- Чи існує `AC/domain/product/rules/SidePanel/` з правилами `RuleChangeSidePanelVariant` / `RuleChangeSidePanelDepth` / `RuleChangeCabinetColorSidePanel` (таблиця Internal Rules у `SIDE_PANEL_API.md`).
- `SIDE_PANEL_API.md` прочитано вибірково (заголовки, рядки 21-30 і 355-376, список `.mjs`-шляхів), не повністю.
- `sections/side-panels.mjs` прочитано grep-ом і фрагментом 334-356. Формат readout State і `describePlan` детально не дивився.
- Чи коректно вантажаться UD-пресети (`ud-row-56` тощо) і чи збігаються числа в `title` пресетів («→ 4 panels» тощо) з реальним результатом.
- `docs/onboarding/*` переглянуто тільки grep-ом по `side.?panel`.
- Тести `ud-open-shelves-side`, `uf-open-shelves-side`, `mako-side-cabinet-type`, goldens стільниці детально не розбирав.
- Коміти, що змінювали side panels без `side-panel` / `SidePanel` у шляху чи subject, могли не потрапити в розділ 4.
