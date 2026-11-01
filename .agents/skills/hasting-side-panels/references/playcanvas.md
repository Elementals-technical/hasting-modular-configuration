# Side panels — PlayCanvas (scope `playcanvas`)

Читай разом із `contract.md`. UI-деталі тут навмисно відсутні — потрібен факт про UI → розділ «Що UI припускає» у `contract.md`; глибше → `ui.md` (scope `both`).

## Робочі сценарії
**Баг у сцені** → dev-panel (`?testUI=1` → Side panels → Guide test cases, `Measure edges`) → `faces[].reason` плану (`incompatible-cabinet`, `unsupported-height/depth/joint/face`, `cabinet-bounds-missing`) → policy колекції → `RuleSidePanels` → залежний модуль (countertop / towel bars / collision). Data-flow по кроках — §2, пастки — §7, тести й базова лінія — `playcanvas-testing.md`.
**Нова колекція / тип тумби** → профіль у `side-panel-profiles.mjs` + `sidePanelSupport` на тумбах у loader + продукти `<Col>-SidePanel_Left/Right` на власному шаблоні + policy у `product/logic/` + Layout/Materials rules + collision profile + dev-panel preset і `side-panel-guide.mjs` + 2–4 тести. Зразок — Tricot, коміт `f0653f0`. Тумба профілю без `sidePanelSupport` дає `incompatible-cabinet` на своєму торці.
**Зміна геометрії/типу** → лише policy (`{ulh,uf,tricot}-side-panel-policy.mjs`) + таблиці з Config Guide (`rules-by-collection.md`); Layout rule не має власних чисел.
**Перед комітом** → `node --test tests/node/*side-panel*.test.mjs` (55; 4 відомі червоні в `uf-side-panel.test.mjs` — тест шле depth 45, код чекає 46), повний прогін проти базової лінії (`playcanvas-testing.md` §1.3). Зміни лишати в stage; коміт — лише за командою Андрія. Якщо змінилась кількість/тип/ціна панелей — це зміна контракту → scope `both`.

## Інваріанти 3D
- Тип: ULH — з `Handle`; UF — з body height (`uf-cabinet-height-policy`); Tricot — завжди NoG. Запит UI переважає лише в ULH без Handle; `CenterG/DoubleG` там = NoG.
- Висота в плані — `profile.bodyHeightOf(config)`, не AABB меша; Y root = низ тумби (UF, Tricot) або видимий низ = низ тумби (ULH).
- Панель лише на `exposed` торці; `partial`/`covered` — немає; сусіди з інших груп/рівнів теж закривають; disabled тумби не закривають.
- Один план на цикл: будує `RuleCountertopLayout` (кеш у `shared`), `RuleSidePanels` лише читає. `unresolved` план → стільниця в цьому циклі **не** перераховується, панелі не видаляються.
- Вибір сторони живе в `features.sidePanelSelection` навіть при 0 панелей.
- Стек = окрема панель на ряд; gap-торці отримують панелі (рішення Райана немає).
- Group ↔ legacy перемикається автоматично: group лише коли **усі** тумби покриті одним профілем; змішана композиція = legacy.
- Ключ панелі `cabinetId:side`; зміна крайньої тумби = новий продукт з новим id.

---

# Side panels — PlayCanvas (playcanvas-hasting, гілка `feture/part-2`, HEAD `5310d1f` 2026-10-16)

Шляхи — від `src/Scripts/app-configuration/` (`AC/`), крім `tests/`, `docs/`, `Scripts/dev-panel/` (від `src/`). `Lнн` — номер рядка.

## 1. Карта файлів

**Addon / group-pipeline (`AC/domain/addons/`)**
- `side-panel-addon.mjs` — клас `SidePanelAddon extends AddonStateMachine`: перемикач group/legacy lifecycle (`usesGroupPanels` L42, `_usesGroupLifecycle` L49), `setType` L60, `rehydrate` L89, `prepareGroupPlan` L148, `materializeGroupPlan` L159, `reconcileGroupPanels` L170, `_buildProfileConfig` L298.
- `side-panel-profiles.mjs` — 3 профілі `ulh`/`uf`/`tricot` (L34/L63/L93), `sidePanelProfileOf` L127, `groupPanelProfileForTags` L143.
- `side-panel-group-measurement.mjs` — `measureGroupSidePanels` L27 (вимірює AABB кабінетів → `planGroupSidePanels`), `cabinetBodyHeightM` L16, `cabinetFootprintIgnoreNodes` L5 (також імпортує `RuleCountertopLayout` L28).
- `side-panel-group-policy.mjs` — чиста логіка плану: `classifySidePanelExposure` L23, `planGroupSidePanels` L58, edge/joint, `buildPanelItem` L189.
- `addon-state-machine.mjs` — базова машина станів (2 слоти left/right, legacy `setType`/`_onCreate`, `_validateType` L417, `_getReferenceCabinet` L456).
- `addon-manager.mjs` — `register(new SidePanelAddon(...))` L28, геттер `sidePanel` L114.
- `towel-bar-addon.mjs` — лише коментар L9 (позиціювання через `RuleTowelBars` з урахуванням SidePanel AABB).

**Політики по колекціях (`AC/domain/product/logic/`)**
- `ulh-side-panel-policy.mjs` — таблиці ULH (Height×Depth), тип за Handle, план `point/panel/inlay`.
- `uf-side-panel-policy.mjs` — таблиці UF (body height → parts), joint-пари, depth stretch.
- `tricot-side-panel-policy.mjs` — одна геометрія Tricot (40 см), тільки дзеркалення.
- `side-panel-tables.mjs` — `finiteNumber` L5, `tableValue` L14 (lookup за числовим ключем, `null` якщо ключа нема).
- `uf-cabinet-height-policy.mjs` — `resolveUFBodyHeight` L55 (body height UF з Handle+Height), використовують UF-профіль і `RuleUFSidePanelLayout`.

**Product rules (меш панелі)**
- `AC/domain/product/rules/CabinetUrbanLowHeight/SidePanel/RuleULHSidePanelLayout.mjs` — застосовує ULH-план (visibility/scaleX/stretch/moveY) до `ULH_UniSidePanel`.
- `.../CabinetUrbanLowHeight/SidePanel/RuleULHSidePanelMaterials.mjs` — CabinetColor → Panel, HandleGrooveColor (або CabinetColor) → Inlay.
- `AC/domain/product/rules/CabinetUrbanFreestanding/RuleUFSidePanelLayout.mjs` — застосовує UF-план до 5 parts шаблону `UF_SidePanel`.
- `.../CabinetUrbanFreestanding/RuleUFSidePanelMaterials.mjs` — Panel_* → CabinetColor, Inlay_* → HandleGrooveColor/CabinetColor.
- `AC/domain/product/rules/CabinetTricot/SidePanel/RuleTricotSidePanelLayout.mjs` — показує `Tricot_SidePanel_Panel` і дзеркалить сам меш.
- `.../CabinetTricot/SidePanel/RuleTricotSidePanelMaterials.mjs` — CabinetColor → `Tricot_SidePanel_Panel`.
- Legacy (`AC/domain/product/rules/SidePanel/`): `RuleChangeSidePanelHeight.mjs` (NoG-меші 50/53/56H), `RuleChangeSidePanelDepth.mjs` (точки 46D/50D), `RuleChangeCabinetColorSidePanel.mjs` (watch CabinetColor/HandleGrooveColor L27), `RuleSidePanelOverlayDepth.mjs` / `RuleSidePanelOverlayHeight.mjs` (grain overlay, L12).
- Legacy variants (`AC/domain/product/rules/variants/`): `RuleChangeSidePanelVariant.mjs` (watch SidePanelType L18), `RuleSidePanelOverlayVariant.mjs` (L14).
- `AC/domain/product/rules/RuleChangeHandleGrooveColor.mjs` — фарбує legacy inlay-вузли `SidePanel_{UpperG,CenterG,DoubleG}_{46D,50D}_Inlay` (L46–61) залежно від `SidePanelType` (L209, L225–227).
- `.../CabinetUrbanDuplex/RuleMaterialsHandleGrooveUrbanDuplex.mjs` — список вузлів L14–18 включає legacy inlays і `ULH_UniSidePanel_Inlay`.
- `.../CabinetTricot/RuleMaterialsCabinetTricot.mjs` — список вузлів L14 включає `Tricot_SidePanel_Panel`.
- `.../Overlay/overlay-texture-config.mjs`, `.../CabinetLame/*` (README, RuleMaterials/RulePattern) — збіг за grep, не відкривав.

**Composition rule**
- `AC/domain/composition/rules/RuleSidePanels.mjs` — aggregation handler: group-гілка L60–88 (план → materialize → `_updatePanel` кожної цілі), legacy-гілка L90–124; позиціювання `_updatePosition` L234, `_panelRootY` L273.

**Реєстрація**
- `AC/domain/product/registry/product-config-loader.mjs` — `sidePanelSupport` у 6 кабінетах (розд. 3), продукти панелей у `_loadSceneAddons` L1914–2076.
- `AC/domain/product/registry/product-registry-v2.mjs` — `sidePanelSupport: config.sidePanelSupport || null` L68, `getSidePanelSupport(productType)` L127–128.
- `AC/domain/product/registry/product-entity-builder.mjs` — L80: ключ варіанта legacy-меша = `config.SidePanelType || config.variant || meshConfig.defaultVariant || 'None'`.

**Store / manager**
- `AC/domain/composition/composition-store.mjs` — `setSidePanelSelection` L196–200, `getSidePanelSelection` L202–204, serialize `features` L252, deserialize L279–281.
- `AC/domain/composition/composition-manager.mjs` — `sidePanelAddon` L148 (+ аліас `sidePanelsService` L152), реєстрація handlers L809–879, `setSidePanelType` L2029–2037, `getEdgeCabinets` L2066–2087.
- `AC/domain/composition/scene-aggregator.mjs` — L325: один обхід cabinets AABB для `RuleSidePanels` + `RuleTowelBars` (не відкривав детально).

**Bridge / API**
- `AC/bridge/plugins/product-config.plugin.mjs` — `setConfigBatch` L213, гілка `config.SidePanel` L264–269, `_resolveSidePanelSide` L487–510.
- `AC/bridge/plugins/cabinet-local-runtime.mjs` — `documentOf` L309–326 (featureSettings = `features` без rows/connections), імпорт L425.
- `AC/services/side-panels/index.mjs` — L5 `export { SidePanelAddon as SidePanelsService }`.
- `AC/services/side-panels/side-panels-service.mjs` — старий клас `SidePanelsService` (L19); ніде не імпортується (rg: лише сам файл і `SIDE_PANEL_API.md` L375 «Legacy service»).
- `AC/services/side-panels/SIDE_PANEL_API.md` — публічний API (setConfigBatch, getEdgeCabinets, getConfig; розділ «ULH rows and groups» L21–65).
- `AC/services/side-panels/README.md` — застарілий опис `SidePanelsService` (L121–124 `new SidePanelsService(...)`, L85/L137 `COUNTERTOP_OFFSET_VALUE`).

**Колізії / spatial**
- `AC/domain/composition/spatial/hasting-collision-profiles.mjs` — профілі obstacle `side-panel-left/right/v1` L95–122, `uf-side-panel-left/right/v1` L123–138, `UF_SIDE_PANEL_PROXY_STRATEGY` L32–44.
- `AC/domain/composition/spatial/composition-scene.mjs` — теги тіл панелей L91–107.
- `AC/domain/composition/spatial/module.manipulable.mjs` — snap-feature `panel` L32, collision `against` L53.
- `AC/domain/countertop/spatial/countertop.manipulable.mjs` — x-edge → `side-panel-edge` L65, structure L83.
- `AC/domain/countertop/spatial/countertop-snap-targets.mjs` — ids `<cabinet|side-panel>:<id>:left|right` L6, L29.
- `AC/domain/countertop/adapters/countertop-drag-overlay.mjs` — `isSidePanelType` L38, колізія з boxes панелей L203, L219.

**Залежні модулі**
- `AC/domain/composition/rules/RuleCountertopLayout.mjs` — будує/матеріалізує group-план L142–151, рахує end-панелі L235–254.
- `AC/domain/countertop/countertop-layout-policy.mjs` — `SIDE_PANEL_WIDTH_LEGACY_CM = 1` L9, `SINGLE_SIDE_PANEL_OFFSET_M = 0.005` L10, L66–72, L93.
- `AC/domain/composition/rules/RuleTowelBars.mjs` — розширення AABB панелями L78–107.
- `AC/domain/composition/rules/RuleCountertopCollisionRefresh.mjs` — watch `SidePanel`, `SidePanelType` L12–13; останній handler.
- `AC/domain/countertop/cover/adapters/cover-composition-adapter.mjs` — watch `'SidePanel'` L21.
- `AC/domain/composition/rules/RuleLameUndertop.mjs` / `RuleLameLegs.mjs` — watchParams містять `SidePanel*` (L8).
- `AC/domain/product/services/CabinetLame/LameUndertopService.mjs` L188–191 + `LameUndertopCalcLayout.mjs` L3, L22 — `hasSidePanels` → undertop `stretchX += 0.09`.
- `AC/domain/product/services/CabinetLame/LameLegsService.mjs` — збіг за grep, не відкривав.
- `AC/domain/cabinet-placement/compact-preset.mjs` (L309, L388, L500) / `portable-preset.mjs` (L33, L77, L146) — прозоро передають `featureSettings`.
- `AC/domain/spatial-manipulation/README.md` — збіг за grep, не відкривав.

**Dev-panel (`Scripts/dev-panel/`)**
- `sections/side-panels.mjs` — секція dev-panel: ставить через `setConfigBatch({}, { SidePanel, SidePanelSide })`, читає `features.sidePanelSelection` і план через `ConfiguratorAPI.config → compositionManager` (коментар L1–23).
- `data/side-panel-guide.mjs` — кейси з guide клієнта, `HANDLE_CONTROLS` (за коментарем у sections L17–18).
- `test-ui.mjs`, `README.md` — збіг за grep, не відкривав.

**Тести**
- `tests/node/side-panels-group-policy.test.mjs` — чиста політика: 4 панелі на 2 рядах (L16), незалежність від порядку вставки (L23), вертикальний стек (L36), `None` (L43), оклюзія між групами (L50), partial (L57), стек із двох сусідів (L65), incompatible edge (L77), unsupported розміри/невідомі bounds (L84), split/regroup (L95).
- `tests/node/side-panels-groups-integration.test.mjs` — інтеграція addon+rule: 4 продукти (L110), split рядка без заміни зовнішніх ID (L135), covered/partial → видалення і відновлення (L167), стек (L186), snapshot restore (L199), selection зберігається при 0 панелей (L216), міграція старих ULH (L235), countertop у першому циклі (L252), collision scene (L266), towel bars (L281), реальний aggregator (L295), зміна розміру/матеріалу (L317), видалення останнього кабінету (L344), rollback при збої (L360).
- `tests/node/countertop-side-panels-group.test.mjs` — free/standard layout підрахунок панелей стільницею (L119–157), `RuleSidePanels` без sink anchor (L163).
- `tests/node/uf-side-panel.test.mjs` — UF end (L30), joint 88+53 (L68), group plan 88|53 (L95), layout rule idempotent (L141).
- `tests/node/tricot-side-panel.test.mjs` — SC|SB|SC → 2 панелі (L31), layout rule (L68).
- `tests/node/ulh-side-panel-policy.test.mjs` — тип за handle (L30), таблиці (L37), unsupported (L61), реєстрація (L76), addon legacy API (L107), sync (L157), resync матеріалу (L196), layout rule (L217).
- `tests/node/ulh-side-panel-materials.test.mjs` — ULH material rule vs legacy (L53–123).
- `tests/node/addon-rehydration.test.mjs` — rehydrate/removeAll addon-машин (L27–127).
- Інші збіги (не відкривав): `tests/node/{cabinet-cover-composition-adapter,collision-config,countertop-collision-profiles,countertop-overlay-box-collision,spatial-manipulation-playcanvas-adapter,ulh-rule-structure,lame-*,tricot-cabinet-materials}.test.mjs`, `tests/node/goldens/countertop-*`, `tests/node/fixtures/collision/archive-geometry.mjs`; браузерні `AC/tests/suites/{side-panel,towel-bar,handle-groove}.test.mjs`, `AC/tests/index.mjs`, `AC/tests/test-runner.mjs`.

**Docs (не відкривав)**: `docs/features/ulh-side-panels/_fixes/2026-09-24-side-panel-depth-drift.md`, `docs/verification/ulh-side-panel-points.md`, `docs/features/ulh-cabinet-addition/*`, `docs/features/ud-columns/commit-plan.md`, `docs/onboarding/02-core.md`, `04-patterns.md`, `05-current-state.md`, `docs/countertop-collisions.md`, `docs/countertop-snapping.md`, `docs/verification/countertop-snapping-testing.md`.

## 2. Data-flow від вибору до меша

1. **`AC/bridge/plugins/product-config.plugin.mjs:setConfigBatch(options, config)`** (L213) → якщо `config.SidePanel !== undefined` (L264): `side = _resolveSidePanelSide(...)` → `compositionManager.setSidePanelType(config.SidePanel, side)` (L266) → **завжди `return true`** (L268), результат `setType` відкидається; решта ключів того ж batch не обробляється (ранній return).
   - `_resolveSidePanelSide` (L487–510): 1) `config.SidePanelSide`; 2) legacy `options.cabinetId` → `getEdgeCabinets()`: left/right/`both` (якщо ліва==права або кабінет не крайній — warn + `both`); 3) default `'both'`.
2. **`composition-manager.mjs:setSidePanelType(type, side='both')`** (L2029–2037): `assertCompositionMutable()` → `_invalidateSpatial('side-panel-variant-changing', null, true)` → `sidePanelAddon.setType(type, side)` → `finally spatial?.endSettle()`.
3. **`side-panel-addon.mjs:setType`** (L60–72): якщо `!_usesGroupLifecycle(composition)` → legacy `AddonStateMachine.setType` (розд. 5). Group: `assertMutable` → `_validateType(type)` (false → `return false`) → `sides = both ? ['left','right'] : [side]` → `selection = {...getGroupSelection(), [s]: type}`, `_sides[s].type = type` → `composition.setSidePanelSelection(selection)` → `aggregator.onCompositionStructureChanged(...)`.
   - `_usesGroupLifecycle` (L49–54): `usesGroupPanels(composition)` **або** (selection != null і в композиції нема кабінетів).
   - `usesGroupPanels` (L42–47): теги **кожного** кабінету → `groupPanelProfileForTags` ≠ null.
   - `_validateType` (`addon-state-machine.mjs` L417–430): `'None'` ок; інакше тип має бути серед `meshConfig.variants` першого продукту `SidePanel_Left` = `None | UpperG | CenterG | DoubleG | NoG` (loader L1923–1927).
4. **`composition-store.mjs:setSidePanelSelection(selection)`** (L196–200) → `_features.sidePanelSelection = clone(selection)`, `_touch()`. Форма: `{ left: <type>|null, right: <type>|null }` (ключі — з `getGlobalTypes`, `addon-state-machine.mjs` L141–147; `'both'` не зберігається, `'None'` зберігається рядком). `getSidePanelSelection` повертає `null`, якщо не задано (L202–204). Також пишуть: `ensureExists` (L77, якщо нема — `getGlobalTypes()`), `setGlobalTypes` (L81–87), `reconcileGroupPanels` (L173).
5. **Цикл агрегації** — handlers у порядку реєстрації (`composition-manager.mjs` L809–879): `RuleLameUndertop` L811 → UD open side shelves L816 → **`RuleCountertopLayout` L827** → `RuleCountertopBooleanCutouts` L832 → **`RuleSidePanels` L837** → `RuleTowelBars` L842 → `RuleSlinkMaterial` L846 → `RuleHandleStretchForSideShelf` L851 → `RuleUFBaseboard` L858 → `RuleLameLegs` L866 → `CabinetCoverReconcile` L872 → `RuleCountertopCollisionRefresh` L876 (коментар L869–870: має бути останнім).
6. **`RuleCountertopLayout.mjs`** L142–151 (першим у циклі): `usesGroupPanels` → `await panelAddon.prepareGroupPlan(shared)`; `status !== 'ready'` → warn + `return` (L145–147); інакше `await panelAddon.materializeGroupPlan(shared, plan)` (L151). Обидва кешуються в `shared`, тому `RuleSidePanels` отримує той самий план/цілі.
7. **`side-panel-addon.mjs:prepareGroupPlan(shared)`** (L148–157): кеш `shared.sidePanelGroupPlan` (L149) → `await SceneTransformHelper.waitForFrames(2)` (L151) → `measureGroupSidePanels({ composition, entities: shared.entities?.cabinets || cm.getProductEntitiesByCategory('cabinets'), registry, selection: getGroupSelection(composition) })`.
   - `getGroupSelection` (L56–58): `composition.getSidePanelSelection() || this.getGlobalTypes()`.
8. **`side-panel-group-measurement.mjs:measureGroupSidePanels`** (L27–48): для кожного `category === 'cabinets'`: нема entity → `boxM: null` (L33); `enabled === false` → виключається (не оклюдує) (L34). `boxM` (L41–42): X — footprint AABB без `aabbIgnoreNodes` реєстру + піддерева sink anchor (`cabinetFootprintIgnoreNodes` L5–9); Y — від `entity.getPosition().y` (pivot) до `+ cabinetBodyHeightM` (L39; `profile.bodyHeightOf(config)` або `Height`, у метрах, L16–20); Z — AABB без лише sink anchor (`depthBoxM`). Плюс `rowId` = рядок з `composition.getCabinetRows()` що містить id (L44), `support = registry.getSidePanelSupport(productType)` (L45) → `planGroupSidePanels(cabinets, selection)`.
9. **`side-panel-group-policy.mjs:planGroupSidePanels(cabinets, selection)`** (L58–74) → `{ status: 'ready' | 'unresolved', reason?, panels[], faces[] }`:
   - будь-який невалідний `boxM` → `{ status:'unresolved', reason:'cabinet-bounds-missing', panels:[], faces:[] }` (L59–61);
   - `groupCabinetsByRow` (L79–88): ключ = `rowId || SupportGroupId || DEFAULT_COUNTERTOP_SUPPORT_GROUP_ID`;
   - `planEdgePanels` (L107–132) для кожного рядка і `left/right`: `pickEdgeCabinet` (L91–96, min X / max X, tie → `id.localeCompare`) → `classifySidePanelExposure` → push `face {cabinetId, groupId, side, face:'end', exposure}`; панель лише якщо тип обрано (`!= 'None'`, L98) **і** `exposure === 'exposed'` (L115); нема профілю/`productTypes[side]` → `face.reason = 'incompatible-cabinet'` (L118–121); `profile.resolvePlan({..., face:'end'})` не `resolved` → `face.reason = plan.reason` (L125–129);
   - `planJointPanels` (L134–161): лише профіль з `supportsJoints` (UF), exposure `'partial'`, і `findShorterNeighbourAtSameBottom` (L168–176: дотик до грані, той самий profile id, низи в межах `SAME_BOTTOM_TOLERANCE_M = 0.005` L7, нижчий, перекриття по Z) → `resolvePlan({face:'joint', neighbourConfig})`; не resolved → `faces.push({..., face:'joint', exposure:'partial', reason})` (L153).
   - `classifySidePanelExposure(cabinet, side, cabinets, contactM = DEFAULT_ROW_TOLERANCES.contactM)` (L23–47): сусіди `isBesideFace` (L13–20, по X у межах contactM) з усіх груп/рівнів → прямокутники перекриття Y/Z; нема → `'exposed'`; sweep по Y з об'єднанням Z-інтервалів → дірка → `'partial'`, інакше `'covered'`.
   - **`buildPanelItem`** (L189–207): `key = \`${cabinet.id}:${side}\`` (L190); item `{ key, cabinetId, groupId, side, boxM, depthBoxM, config }`; `config` = `{ productType: support.productTypes[side], category:'addons', side, SidePanelLayout:'group-edge', SidePanelEdgeKey:key, SidePanelAnchorCabinetId, SupportGroupId, SidePanelProfile, SidePanelRequestedType, SidePanelType: plan.appearance, SidePanelFace: 'end'|'joint', SidePanelNeighbourHeight: profile.bodyHeightOf(neighbour)|null, Height, Depth, Handle, CabinetColor, GrainDirection||'None', HandleGrooveColor||null }` (L195–206) — копія з edge-кабінету.
   - «Gap edges»: окремі рядки — окремі ключі групування, тож кожен рядок має свої 2 зовнішні грані, включно з гранями біля проміжку (тест `side-panels-group-policy.test.mjs` L16).
10. **`side-panel-addon.mjs:materializeGroupPlan(shared, plan)`** (L159–167): кеш `shared.sidePanelGroupTargets` → `reconcileGroupPanels(plan, composition)` → оновлює `shared.allProducts`, `shared.entities.addons`.
11. **`reconcileGroupPanels`** (L170–217): `plan.status !== 'ready'` → `[]` (нічого не видаляє) (L172). Існуючі = `panelEntries` (addons з `productType` `/SidePanel_(Left|Right)$/`, L9–10). Для кожної панелі плану: match за `SidePanelEdgeKey === panel.key` + той самий `productType` + entity в сцені (L178–179); інакше міграція (L180–186, див. розд. 6); інакше `ProductFactory.createProductEntity(productType, config)` (L192) → перевірка `_hasRequiredPanelNodes` (L219–222, `profile.requiredNodes`) → помилка `code: 'SIDE_PANEL_ASSET_UNAVAILABLE'` (L196–197) → `app.root.addChild` → `cm._executeProductRules(entity, {...config, entityName})` (L202). Будь-який throw → `destroy()` усіх нових entity і rethrow (L206–209). Після циклу: `composition.addProduct(entity.name, {...existing, ...panel.config, entityName})` (L210–213); не claimed → `_removeGroupPanel` (`removeProduct` + `destroy`) (L214); `_refreshGroupState` (L138–146: `_sides[side].entityNames`).
12. **`RuleSidePanels.applyFn`** group-гілка (L60–88): той самий `prepareGroupPlan` (з кешу); `status !== 'ready'` → `warn('Group plan unresolved', reason)` + return (L62–65); warn для кожного `face` з `reason` і `face === 'end'` (L22, L66–68); `materializeGroupPlan` (з кешу) → для кожного `{panel, entity}` `_updatePanel(entity, BoundingBox(panel.boxM), BoundingBox(panel.depthBoxM), panel.side, panel.config, cm)` (L78–81) → оновлює `shared.allProducts`/`shared.entities.addons` для наступних handlers (L83–86).
13. **`RuleSidePanels._updatePanel`** (L185–232): `changes` = Depth/Height/Handle/CabinetColor/GrainDirection/HandleGrooveColor + для `group-edge` `SidePanelFace`, `SidePanelNeighbourHeight` (L194–200) → `composition.addProduct(panel.name, {...current, ...changes})` (L220) → `cm._executeProductRulesWithChanges(panel, changes, updatedConfig)` (L225) → product rules продукту панелі: **Layout (priority 25) → Materials (priority 35)** → для `group-edge` `waitForFrames(2)` (L227–229) → `_updatePosition` (L231).
14. **Layout/materials**: `RuleULHSidePanelLayout` / `RuleUFSidePanelLayout` / `RuleTricotSidePanelLayout` перевіряють `SidePanelProfile` і заново викликають policy (`resolve*SidePanelPlan`) з `currentState`; unresolved → warn і **сцена лишається як була** (ULH L33–36, UF L44–47, Tricot L35–38); відсутні вузли → warn і return (ULH L46–53, UF L50–58, Tricot L42–47). Materials — розд. 4.
15. **`RuleSidePanels._updatePosition`** (L234–267): профільовані панелі (`sidePanelProfileOf(SidePanelProfile) !== null`) — root `setLocalEulerAngles(0,0,0)` (дзеркалить product rule); legacy left — `(0,180,0)` (L235–242). AABB панелі без `_Inlay`/`_Overlay` (`_getPanelPositionAabb` L283–285). X: зовнішня грань панелі до грані `boxM` (L251–259); Z: центр `depthBoxM` (L260); Y: `_panelRootY` (L273–281) — `group-edge` + `rootAtCabinetBottom` (UF, Tricot) → root = низ кабінету; `group-edge` без нього (ULH) → видимий низ панелі = низ кабінету; legacy → Y не змінюється.

## 3. Профілі

`AC/domain/addons/side-panel-profiles.mjs`:

| поле | `ulh` (L34–61) | `uf` (L63–91) | `tricot` (L93–113) |
|---|---|---|---|
| `id` | `ULH_SIDE_PANEL_PROFILE = 'ulh'` | `'uf'` | `'tricot'` |
| `collectionTags` | `['urban-low-height']` L36 | `['urban-freestanding','urban-freestanding-sink','urban-freestanding-side']` L67 | `['tricot-sink','tricot-side']` L95 |
| `requiredNodes` | усі `ULH_SIDE_PANEL_NODES` L37 | `UF_SidePanel_Point` + 5 parts L68 | `Tricot_SidePanel_Panel` L96 |
| `supportsJoints` | `false` | `true` | `false` |
| `rootAtCabinetBottom` | `false` | `true` | `true` |
| `bodyHeightOf(config)` | `finiteNumber(Height)` L41–43 | `resolveUFBodyHeight({handle, height})` L73–75 | завжди `TRICOT_BODY_HEIGHT_CM = 40` L102–104 |
| `resolveAppearance` | `resolveULHSidePanelType({handle, requestedType})` L45–47 | `resolveUFSidePanelType({height: body})` — requestedType ігнорується, `null` для невідомої висоти L78–80 | `'NoG'` L106–108 |
| `resolvePlan` | `face !== 'end'` → `{unresolved, 'unsupported-face'}` L50–52, далі `resolveULHSidePanelPlan` | `resolveUFSidePanelPlan({side, face, height: body, depth, neighbourHeight})` L82–90 | `resolveTricotSidePanelPlan({side, face})` L110–112 |
| template / продукти | `ULH_UniSidePanel` / `ULH-SidePanel_Left/Right` | `UF_SidePanel` / `UF-SidePanel_Left/Right` | `Tricot_SidePanel` / `Tricot-SidePanel_Left/Right` |

- `groupPanelProfileForTags(tagLists)` (L143–147): перший профіль, чиї `collectionTags` перетинаються з тегами **кожного** кабінету; порожній список → `null`. Коментар L65–66: UF open shelves (`urban-freestanding`) лишаються в group-pipeline, але без панелей на своїх гранях.

**`sidePanelSupport` у loader** (`product-config-loader.mjs`; імпорти L68, L83, L84):

| продукт (registerProduct) | теги | `sidePanelSupport` |
|---|---|---|
| `ULH-sink-cabinet` L499 | `cabinet, urban-low-height` | L508–510 `{ profile: 'ulh', productTypes: ULH_SIDE_PANEL_PRODUCTS }` |
| `ULH-side-cabinet` L575 | `cabinet, urban-low-height, ulh-side` | L584–586 (ulh) |
| `UF-sink-cabinet` L970 | `cabinet, urban-freestanding-sink` | L979–981 `{ profile: 'uf', productTypes: UF_SIDE_PANEL_PRODUCTS }` |
| `UF-side-cabinet` L1028 | `cabinet, urban-freestanding-side` | L1037–1039 (uf) |
| `Tricot-sink-cabinet` L1201 | `cabinet, tricot-sink` | L1210–1212 `{ profile: 'tricot', productTypes: TRICOT_SIDE_PANEL_PRODUCTS }` |
| `Tricot-side-cabinet` L1254 | `cabinet, tricot-side` | L1263–1265 (tricot) |

Кабінети з тегом профілю, але **без** `sidePanelSupport` (у group-pipeline дають `incompatible-cabinet` на своїй грані): `ULH-Open-Shelf` L628 (`urban-low-height`), `UF-open-shelves` L1061 (`urban-freestanding`), `UF-open-shelves-side` L1081 (`urban-freestanding`, `side-shelf`).

**Продукти панелей** (`_loadSceneAddons` L1914):
- `SidePanel_Left` L1916 / `SidePanel_Right` L1948 — `meshConfig.type: 'variants'`: `None`(null), `UpperG`→`SidePanel_UpperG`, `CenterG`→`SidePanel_CenterG`, `DoubleG`→`SidePanels_DoubleG`, `NoG`→`SidePanels_NoG` (L1920–1928); rules `RuleChangeSidePanelVariant` 10, `RuleChangeSidePanelDepth` 20, `RuleChangeSidePanelHeight` 30, `RuleChangeCabinetColorSidePanel` 35, `RuleSidePanelOverlayVariant` 41, `RuleSidePanelOverlayDepth` 42, `RuleSidePanelOverlayHeight` 43 (≈L1930–1938); default `SidePanelType:'None'`, `side`, `GrainDirection:'None'`.
- `ULH-SidePanel_Left` L1980 / `_Right` L2002 — `single`, `ULH_UniSidePanel` required; rules `RuleULHSidePanelLayout` 25, `RuleULHSidePanelMaterials` 35; default `SidePanelType:'NoG'`, `SidePanelProfile:'ulh'`; теги `addon, side-panel, <side>, urban-low-height`.
- `UF-SidePanel_*` (цикл, registerProduct L2027) — `UF_SidePanel` required; `RuleUFSidePanelLayout` 25, `RuleUFSidePanelMaterials` 35; default `NoG`, `SidePanelProfile:'uf'`, `SidePanelFace:'end'`.
- `Tricot-SidePanel_*` (цикл, L2054) — `Tricot_SidePanel` required; `RuleTricotSidePanelLayout` 25, `RuleTricotSidePanelMaterials` 35; default `NoG`, `'tricot'`, `SidePanelFace:'end'`.
- Жоден продукт панелі не має поля `sidePanelSupport` (воно є лише в 6 кабінетах вище).

## 4. Таблиці політик

### ULH — `AC/domain/product/logic/ulh-side-panel-policy.mjs`
- Вузли L9–13: `ULH_UniSidePanelPoint`, `ULH_UniSidePanel_Panel`, `ULH_UniSidePanel_Inlay`.
- Тип (`resolveULHSidePanelType` L52–58): `Handle === 'handle_urban_topcut'` → `UpperG`; `'handle_pto'` → `NoG`; інакше requestedType `UpperG`/`NoG`; будь-що інше (вкл. `CenterG`/`DoubleG`) → `NoG`.
- Height (cm) → значення:

| Height | `NO_GROOVE_STRETCH_Y` L20–27 | `UPPER_GROOVE_MOVE_Y` L29–36 | `UPPER_GROOVE_STRETCH_Y` L38–45 |
|---|---|---|---|
| 25 | 0 | 0 | 0 |
| 28 | 0.123 | 0.03 | 0.06 |
| 35 | 0.263 | 0.1 | 0.2 |
| 38 | 0.323 | 0.13 | 0.26 |
| 50 | 0.563 | 0.25 | 0.5 |
| 56 | 0.683 | 0.31 | 0.62 |

- Depth → `DEPTH_STRETCH_Z` L47–50: `46: 0`, `50.5: 0.09`.
- План (L64–101): `point {visible:true, scaleX: left ? -1 : 1}`; `panel {visible:true, stretchY: UpperG ? UG_STRETCH : NoG_STRETCH, stretchZ: UpperG ? 0 : depthZ}`; `inlay {visible: UpperG, moveY: UpperG ? UG_MOVE : 0, stretchY: 0, stretchZ: UpperG ? depthZ : 0}`; `reason: 'ulh-side-panel-resolved'` L85.
- Unresolved: `'unsupported-side'` L66 (без appearance); `'unsupported-depth'` L72 і `'unsupported-height'` L79 (з `appearance`); профіль додає `'unsupported-face'` для joint.
- `RuleULHSidePanelLayout` (watch L15–16 `SidePanelProfile, SidePanelType, Handle, Height, Depth, side`) передає `requestedType: currentState.get('SidePanelType')` (L27), тобто вже appearance.

### UF — `AC/domain/product/logic/uf-side-panel-policy.mjs`
- Вузли L10–17: `UF_SidePanel_Point`, `UF_SidePanel_Inlay_Bot`, `UF_SidePanel_Inlay_Top`, `UF_SidePanel_Panel_Bot`, `UF_SidePanel_Panel_Full`, `UF_SidePanel_Panel_Top`; faces `end`/`joint` L27–30.
- Висоти — **body heights** (`uf-cabinet-height-policy.mjs`): `UF_BODY_HEIGHTS = [50, 53, 85, 88]` L18; tall за Handle `UG`/`CG` → 88, `PTO` → 85 (L21–25); каталожна 91 (UG/CG з цоколем) L28; short `UG`/`CG` → 53, `PTO` → 50 (L31–35); поріг short `< 60` L38, L45.

| body H | тип `TYPE_BY_HEIGHT` L36–41 | end visible parts `VISIBLE_PARTS_BY_HEIGHT` L44–49 |
|---|---|---|
| 50 | NoG | Panel_Bot |
| 53 | UpperG | Inlay_Bot, Panel_Bot |
| 85 | NoG | Panel_Full |
| 88 | UpperG | Inlay_Bot, Inlay_Top, Panel_Bot, Panel_Top |

- `PANEL_FULL_HEIGHT_STRETCH_BY_HEIGHT` L53–55: `85: 0.06` (коментар: «linear, waits for the artist check»); інші parts height stretch 0 (L82–83).
- `DEPTH_STRETCH` L66–70: `46: -0.08`, `50: 0` — застосовується до всіх 5 parts.
- Осі: `Panel_Full` повернутий −90° по X → `stretch {y: depth, z: height}`; інші `{y: height, z: depth}` (L72–74, L86–91).
- Joint `JOINT_BY_HEIGHT_PAIR` L58–63: лише `88 → 53`: visible `[Inlay_Top, Panel_Top]`, `panelTopMoveY: 0`. Коментар L62: «85+50 waits for the artist».
- Кожна part: `{ visible, stretch:{y,z}, moveY: (Panel_Top ? panelTopMoveY : 0) }` (L93–103); `point {scaleX: left ? -1 : 1}` L155.
- Unresolved (без appearance, L80): `'unsupported-side'` L131, `'unsupported-face'` L132, `'unsupported-height'` L136, `'unsupported-depth'` L141, `'unsupported-joint'` L147.
- `RuleUFSidePanelLayout` (watch L26 `SidePanelProfile, SidePanelFace, SidePanelNeighbourHeight, Height, Handle, Depth, side`): height = `ufBodyHeightOf(currentState)` L40; `_applyPartLayout` ставить локальний Y position = `moveY` (L73–78).

### Tricot — `AC/domain/product/logic/tricot-side-panel-policy.mjs`
- Один вузол `Tricot_SidePanel_Panel` L8–10; тіло 40×52 см, меш змодельований у цей розмір → stretch немає (L12–14).
- Тип завжди `NoG` L17, L27–29.
- План L36–48: `{status:'resolved', face, appearance:'NoG', panel:{scaleX: left ? -1 : 1}}`; Height/Depth не перевіряються.
- Unresolved: `'unsupported-side'` L38, `'unsupported-face'` (будь-що крім `end`) L39.
- `RuleTricotSidePanelLayout` дзеркалить сам меш панелі (нема point-вузла), L50–52.

### Materials
- ULH (`RuleULHSidePanelMaterials`, watch `CabinetColor, HandleGrooveColor` L14, priority 35): Panel ← CabinetColor; Inlay ← HandleGrooveColor, якщо задано і ≠ `'None'`, інакше CabinetColor (L28–49). **Без** перевірки `SidePanelProfile`.
- UF (`RuleUFSidePanelMaterials`): guard `SidePanelProfile === 'uf'` L38; Panel_Bot/Full/Top ← CabinetColor, Inlay_Bot/Top ← HandleGrooveColor/CabinetColor (L7–16, L56–68).
- Tricot (`RuleTricotSidePanelMaterials`, watch `CabinetColor` L15): guard L22; панель ← CabinetColor.
- Усі пропускають, якщо CabinetColor порожній; застосування через `MaterialService.applyMaterialByName`.

## 5. Legacy-шлях

- Вмикається, коли `!_usesGroupLifecycle(composition)` (`side-panel-addon.mjs` L49–54) — тобто не всі кабінети покриваються одним профілем. За тегами loader це: `Sink-Base` L346, `Sink-Cabinet` L416, `Open-Shelf` L457, `Side-Shelf` L479, `Class-*` L660/L712, `Mako-*` L741/L799, `UD-*` L841/L894/L925/L949, `Lame-*` L1103/L1162, universal shelves L2135/L2158/L2189 (жодного тегу профілю), а також **змішані** композиції (напр. ULH + UF).
- Також legacy `rehydrate`/`removeAll`, якщо нема group lifecycle і нема продукту з `SidePanelLayout === 'group-edge'` (L91, L125).
- 2 слоти: `SidePanelAddon` constructor `products: ['SidePanel_Left', 'SidePanel_Right']` (L34) → `AddonStateMachine` constructor `_sides.left/right` з `_extractSide` (`addon-state-machine.mjs` L50–60, L445–449).
- `AddonStateMachine.setType` (L73–96): `_validateType` → `_transition(side, type)` для кожної сторони → `onCompositionStructureChanged`.
- `_onCreate` (L311–342): `productType = _resolveProductType(side, type)` → `createProductEntity(productType)` → `buildConfig` → `composition.addProduct` → `_executeProductRules`; помилка → видалення продукту і entity.
- `SidePanelAddon._resolveProductType` (L224–228): `getSidePanelSupport(referenceCabinet.productType).productTypes[side]`, інакше базовий слот (`SidePanel_Left/Right`, L400–402) — тобто у змішаній композиції legacy-lifecycle може створити `ULH-/UF-/Tricot-SidePanel_*`, якщо таким є крайній кабінет.
- `buildConfig` (L235–248): з reference кабінету `Depth || 46`, `Height || 56`, Handle, CabinetColor, GrainDirection, HandleGrooveColor + `_buildProfileConfig` (L298–314: без профілю → `SidePanelProfile: 'legacy'`, `SidePanelType = requestedType`).
- **Edge cabinet** = `compositionManager.getEdgeCabinets()` (`composition-manager.mjs` L2066–2087): кабінети, відсортовані за `composition.getOrderProductIds()` (orderIndex), перший → `leftCabinetId`, останній → `rightCabinetId`. Використовують `_getReferenceCabinet` (`addon-state-machine.mjs` L456–460), `RuleSidePanels._getCabinetDepthHeight` (L168–172, fallback — перший кабінет, defaults 46/56 L160, L166), bridge `_resolveSidePanelSide` (L495).
- `RuleSidePanels` legacy (L90–124): лише enabled кабінети; `waitForFrames(2)` + `syncHierarchy` (L95–96); `cabinetsAabb` — об'єднання footprint усіх кабінетів (ignore як у countertop) і `cabinetsDepthAabb` — лише без sink anchor (L99–104); панель знаходиться за `entity.name.includes('SidePanel_Left'|'SidePanel_Right')` — перша (L112, L118); позиція: X/Z до AABB композиції, Y без змін, left-панель повертається на 180° (якщо не профільована).
- `RuleChangeSidePanelHeight` (watch `Height`, конструктор priority 20, L11–12): breakpoints `[50, 53, 56]`; Enable/Disable лише NoG-мешів `SidePanel_NoG_{50,53,56}H_{50D,46D}_Panel` (heightConfig ≈L15–46); `parseInt(Height)`, NaN → skip.
- `RuleChangeSidePanelDepth` (watch `Depth`, конструктор priority 30, L11–12): breakpoints `[46, 50.5]`; Enable/Disable точок `SidePanel_UpperG_{46D,50D}_Point`, `SidePanel_CenterG_…_Point`, `SidePanels_DoubleG_…_Point`, `SidePanels_NoG_…_Point` (depthConfig ≈L15–40).
- Варіант меша (`product-entity-builder.mjs` L80) = `SidePanelType`.

## 6. Залежні модулі

**Countertop**
- `RuleCountertopLayout.mjs` watchParams L54–56 включають `SidePanel`, `SidePanelType`, `SidePanelRequestedType`.
- `isEndSidePanel` (L68–70): `SidePanelFace !== 'joint'` → рахуються end-панелі і legacy без face; joint не подовжує і не зсуває стільницю.
- Group (L235–238): лише end-панелі плану, `panel.groupId === topGroupId` (SupportGroupId стільниці, L234) і `cabinetId` серед кабінетів під стільницею.
- Legacy (L238–254): усі продукти з `productType` на `SidePanel_Left/Right`; якщо стільниця покриває частину кабінетів — фільтр `isSidePanelAdjacentToGroup` (L99–106; tolerance `SIDE_PANEL_ADJACENCY_TOLERANCE_M = 0.02` L61; X від кабінетів, бо rule працює до `RuleSidePanels`).
- Внесок: `countertop-layout-policy.mjs` — довжина `+ sidePanels.length × SIDE_PANEL_WIDTH_LEGACY_CM (1 см)` (L9, L93); якщо панель лише з одного боку — зсув X на `∓SINGLE_SIDE_PANEL_OFFSET_M = 0.005` (L10, L66–72, L107, L113). Free layout: `autoLengthM = groupMaxX − groupMinX + sidePanels.length × .01` (`RuleCountertopLayout.mjs` L270–273).
- Unresolved group-план → `RuleCountertopLayout` робить `return` (L145–147).
- `SidePanelAddon.COUNTERTOP_OFFSET_VALUE = 0.5/100` (L29) і `calculateCountertopOffset` (L257–272) дублюють ту саму ±0.5 см логіку.

**Towel bars** (`RuleTowelBars.mjs`): `cabinetBodyHeightM` з measurement (L5); watchParams L22 включає `SidePanelType`. Legacy: AABB кабінетів розширюється AABB першої enabled `SidePanel_Left`/`_Right` (L78–91). Group (`usesGroupPanels() === true`, L94): `edgeBounds(side)` = AABB edge-кабінету + лише панелі з `config.side === side` і `SidePanelAnchorCabinetId === edge.entity.name` (L95–107).

**Колізії / spatial**
- `composition-scene.mjs` L91–107: тіло панелі — теги `['side-panel', 'side-panel-left'|'side-panel-right']` + `'side-panel-joint'` для `SidePanelFace === 'joint'`; для `group-edge` `meta.orderIndex = order[anchor] ∓ 0.5`, `meta.anchorCabinetId`.
- `module.manipulable.mjs` L31–32: snap-feature `panel` = `side-panel` без `side-panel-joint`; L53: collision `against: any(tag('cabinet'), tag('side-panel'))` (joint лишається перешкодою).
- `hasting-collision-profiles.mjs`: `side-panel-left/v1` / `side-panel-right/v1` (L95–122) — `productTypes: ['SidePanel_*', 'ULH-SidePanel_*', 'Tricot-SidePanel_*']`, `active-member-union`, suffixes `_Panel`, `_Inlay`, exclude `_Overlay`, cardinality `_Panel [1,1]`, `_Inlay [0,1]`; `uf-side-panel-left/v1` / `uf-side-panel-right/v1` (L123–138) — `['UF-SidePanel_*']`, `UF_SIDE_PANEL_PROXY_STRATEGY` (L32–44: suffixes `_Panel_Bot/_Panel_Full/_Panel_Top/_Inlay_Bot/_Inlay_Top`, кожен `[0,1]`).
- Countertop: `countertop.manipulable.mjs` L65 (`x-edge` → `side-panel-edge`), L83; `countertop-snap-targets.mjs` L29; `countertop-drag-overlay.mjs` L38, L203, L219 (overlap > 1 мм = колізія).
- `RuleCountertopCollisionRefresh.mjs` L12–13 watch `SidePanel`, `SidePanelType`.

**Інші**: Lame undertop `stretchX += 0.09`, якщо є продукт з `SidePanel` у productType, `SidePanelType !== 'None'` і entity enabled (`LameUndertopService.mjs` L188–191, `LameUndertopCalcLayout.mjs` L22). `cover-composition-adapter.mjs` L21 watch `'SidePanel'`.

**Snapshot / export / rehydrate**
- `composition-store.mjs` serialize: `features: clone(this._features)` (L252) → `sidePanelSelection` у snapshot; deserialize L279–281 відновлює `features` як є. `SIDE_PANEL_API.md` L57–58: selection зберігається навіть без панелей.
- Preset: `cabinet-local-runtime.mjs:documentOf` (L309–326) — `featureSettings = clone(saved.features)` мінус `localCabinetConnections` і `localCabinetRows` (L311–313); імпорт `features: {...document.featureSettings, localCabinetConnections, ...}` (L425). `compact-preset.mjs` (L309, L388, L500) і `portable-preset.mjs` (L33, L77, L146) передають `featureSettings` без змін. Ні в одному з цих файлів нема явної згадки `sidePanelSelection` / `SidePanel` (rg).
- Продукти панелей у preset-документі: `primarySources` = усі не-кабінетні продукти як `runtime-product` з `cabinetReferences` за `SupportGroupId` (`cabinet-local-runtime.mjs` L321–325).
- `SidePanelAddon.rehydrate` (L89–122): збережена selection або (якщо нема) виведена з власних продуктів сторони (`SidePanelRequestedType ?? SidePanelType`); різні типи / невалідний тип → `Error` з `code: 'ADDON_REHYDRATE_INVALID'`, `addon`, `side` (L99–100, L106–107, L111–112); `_sides[side].entityNames` = усі продукти сторони.
- Міграція (`reconcileGroupPanels` L180–186): якщо match за ключем нема, для **найзовнішньої** панелі сторони плану береться існуючий продукт без `SidePanelEdgeKey` з тим самим productType і side — зберігає старий ID. Legacy `SidePanel_Left/Right` ніколи не збігаються з group productType → видаляються (коментар L177, L214).

## 7. Інваріанти й пастки (з коду/коментарів/тестів)

- **Ідентичність панелі** = `SidePanelEdgeKey = <cabinetId>:<side>` (`side-panel-group-policy.mjs` L50, L190), а не groupId/rowId. Коли змінюється edge-кабінет рядка, ключ змінюється → старий продукт не claimed і видаляється, створюється новий з новим ID (`side-panel-addon.mjs` L178–192, L214). Зовнішні ID зберігаються при split (тест integration L135).
- **План один на цикл**: перший виклик (`RuleCountertopLayout`, зареєстрований раніше за `RuleSidePanels`) вимірює і матеріалізує; `RuleSidePanels` бере з `shared.sidePanelGroupPlan` / `shared.sidePanelGroupTargets` (L149, L160). Коментар `RuleCountertopLayout.mjs` L96–97: rule працює до `RuleSidePanels`, тому entity панелі може стояти на старому X.
- **`waitForFrames(2)`**: перед вимірюванням (`prepareGroupPlan` L151); legacy — перед AABB (`RuleSidePanels` L95, коментар L93–94: SmartStretch оновлює AABB після render frame, depth 50.5); group — після product rules і перед позиціюванням (L227–229; коментар L222–224 про 50D-меш).
- **Unresolved план** (`cabinet-bounds-missing` — кабінет без entity або невалідний AABB): `RuleCountertopLayout` → warn + `return` (стільниця в цьому циклі не перераховується); `RuleSidePanels` → warn + return; `reconcileGroupPanels` → `[]`, існуючі панелі **не видаляються** (L172).
- **Unresolved грань** (incompatible / unsupported-*): панелі нема, а існуюча панель цього ключа видаляється; warn лише для `end` (L21–22, L66–68); тип у selection лишається, панель повертається, коли грань знову сумісна (`SIDE_PANEL_API.md` L33–35; тест integration L216).
- End-панель лише для `exposure === 'exposed'`; `partial`/`covered` → нема (тест policy L57). Оклюдують і сусіди з інших груп/рівнів; disabled кабінети не оклюдують (measurement L34).
- Joint — лише UF (`supportsJoints`), лише `partial`, сусід того самого профілю, нижчий, низи ±5 мм, перекриття по Z; joint з кабінетом-полицею/чужим профілем не будується (коментар L137–138).
- Висота в плані — `profile.bodyHeightOf`, а не AABB меша (measurement L11–19, L39–42): UF рахує body з Handle (`PTO + 88 → 85`), Tricot — завжди 40.
- `_validateType` бере варіанти legacy `SidePanel_Left` → group-selection приймає `CenterG`/`DoubleG`, але ULH рендерить їх як `NoG` (якщо Handle не визначає), UF/Tricot тип ігнорують.
- Bridge `setConfigBatch` з `SidePanel` завжди повертає `true` (L268), навіть якщо `setType` повернув `false`; коментар dev-panel L7 те саме.
- Порядок product rules панелі: Layout 25 → Materials 35 (loader). Layout-rules не змінюють сцену при unresolved плані або відсутніх вузлах (лишається попередній стан).
- Профільовані панелі не обертають root (дзеркалення через `scaleX` point-вузла або, у Tricot, меша) — `RuleSidePanels` L14–15, L235–237.
- Відсутні обов'язкові вузли нового asset → `SIDE_PANEL_ASSET_UNAVAILABLE`, rollback усіх нових entity в цьому reconcile, існуючі продукти не зачіпаються (L195–198, L206–209; тест integration L360).
- `RuleSidePanels._updatePanel` L208 шукає `getSidePanelSupport(cabinetDepthHeight.productType)`: у group-гілці це `panel.config` (productType панелі, у якого нема `sidePanelSupport`, розд. 3) → блок L210–217 спрацьовує лише в legacy-гілці, де передається config edge-кабінету (L181); у group `SidePanelType` береться з `plan.appearance` (`buildPanelItem` L200).
- Будь-яка `setSidePanelType` інвалідовує spatial (`'side-panel-variant-changing'`) і завершує settle у `finally` (`composition-manager.mjs` L2031–2035).

## Не перевірено / суперечності

- `SIDE_PANEL_API.md` розділ «ULH rows and groups» (L21–65) і таблиця полів (L50: `group-edge` «for the ULH row lifecycle») описують лише ULH; у коді group-pipeline також UF і Tricot. Header `side-panel-addon.mjs` L18–21 і JSDoc `usesGroupPanels` L39 згадують лише «ULH / UF», без Tricot.
- `AC/services/side-panels/README.md` описує `SidePanelsService` у `services/` (`new SidePanelsService(...)` L121–124); фактично це `SidePanelAddon` з `domain/addons/side-panel-addon.mjs`, `index.mjs` лише реекспортує його. `side-panels-service.mjs` (387 рядків) ніде не імпортується.
- Priority legacy-правил різний: у конструкторах `RuleChangeSidePanelHeight` 20 / `RuleChangeSidePanelDepth` 30, у loader — Depth 20 / Height 30. Що з них діє (loader перекриває?) — не перевіряв `base-product-rule` / factory.
- Чи викликається `SidePanelAddon.calculateCountertopOffset` десь, крім README/API.md, — не перевіряв (у `RuleCountertopLayout` grep його не знайшов; там використовується `countertop-layout-policy`).
- Значення `DEFAULT_ROW_TOLERANCES.contactM` (`cabinet-placement/cabinet-rows.mjs`) не дивився.
- Відновлення `sidePanelSelection` при preset import виведено з прозорої передачі `featureSettings`; окремого тесту саме на це не бачив (тести `compact-preset-*` / `cabinet-local-runtime.test.mjs` не відкривав).
- `_executeProductRules` / `_executeProductRulesWithChanges` (composition-manager) не читав — як саме watchAttributes фільтрують повторний запуск layout-правил, не перевірено.
- UF: `Panel_Full` 85 stretch 0.06 «waits for the artist check» (L51–52); joint 85+50 «waits for the artist» (L62) — у таблиці лише 88+53.
- `RuleULHSidePanelMaterials` не має guard `SidePanelProfile` (на відміну від UF/Tricot) — працює за назвами вузлів; чи це навмисно, з коду не видно.
- Файли з розд. 1, позначені «не відкривав» (docs, частина тестів, Lame/UD/overlay), — описи за grep-збігом, не за вмістом.
