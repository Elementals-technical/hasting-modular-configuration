# Side panels — UI (scope `ui`)

Читай разом із `contract.md`. 3D-деталі тут навмисно відсутні — потрібен факт про сцену → розділ «Що 3D робить із цим» у `contract.md`; глибше → `playcanvas.md` (scope `both`).

## Робочі сценарії
**Баг у контролі / стані** → `useSidePanelState.ts` (сітка, краї, доступність) → `sidePanelEdgeCompatibility.ts` (сторона, блок OS/OSS) → `sidePanelRules.ts` + `product-profile.json → ruleData.sidePanels` → `sidePanelService.ts` (сценарії apply/delete/auto-remove/restore) → `changeSidePanels.ts` → `createSidePanelPort.ts`. Readback з 3D лише через `getEdgeCabinets` / `getConfig` (§2).
**Баг у ціні / SKU** → `buildSidePanelSku.ts` (URSP) або `buildCollectionSidePanelSku.ts` (Tricot) → `buildCollectionPricingLines.ts` §sidePanel → `usePricingInput.ts` (звідки `sidePanelsOption/Left/Right`) → `calcCountertopWidth.ts`. Пам'ятай: кількість у ціні = `activeSideCount` (0..2), не кількість панелей у сцені.
**Нова колекція в UI** → `ui.json` поле `SidePanels` + `product-profile.json → ruleData.sidePanels` (матриця, групи, blockedCabinetTypes) + `sku-profile.json → sidePanel` (`pricedAs` або `baseSku`) + `runtime-bindings.json` нотатка + тести за зразком Tricot (`tricotPanels.test.ts`, `tricotRuntimeBindings.test.ts`).
**Пресет / відновлення** → `ModelPage.tsx` (`clearSidePanels` → `reapplySidePanelsForPreset`), `CabinetBuilderPage.tsx`, `restoreSidePanelState`; пресети даних панелей не несуть.
**Перед комітом** → `npx vitest run src/features/sidePanel src/shared/lib/pricing src/features/playCanvasAdapter`; `tsc -b`. Не ламати одно-патчевий контракт (`createSidePanelPort.test.ts`). Якщо зміна зачіпає, що саме UI шле чи читає з 3D — scope `both`.

## Інваріанти UI
- Один `setConfigBatch` = один патч `{ SidePanel, SidePanelSide }`; `None`+`both` = два патчі; одна тумба = `both`.
- Redux-статус сторони пишеться **лише після** успішного `port.apply`; `partial` → `markRuntimeOutOfSync`.
- `auto-removed` ≠ `none`: авто-зняту сторону UI повертає сам, зняту користувачем — ні.
- Groove при зміні Handle/Height/Depth перевибирає `resolveGroove` за `groovePriorityByHandle`; сторони лишаються.
- Доступність і ціна беруться з профілю колекції, а не зі сцени; колекції без `ruleData.sidePanels` контролу не показують.

---

# UI: бокові панелі (side panels)

Репо `UI-APP-config-react`, гілка `package-3/fix` (HEAD `91257118`). Шляхи відносно кореня репо.

## 1. Карта файлів

### Контрол у UI
- `public/collections/{urban-standard-height,urban-low-height,urban-freestanding,tricot}/ui.json` — поле `{ attributeId: "SidePanels", control: "options-grid", availabilityRef: "SidePanels.available" }` (USH `ui.json:352,371`; ULH `ui.json:284-286`; UF `ui.json:165`; Tricot `ui.json:115`). В UD/Class/Mako/Lame поля немає.
- `src/widgets/AccessoriesSections/ui/AccessoriesSections.tsx:46` — `useSidePanelState(fieldOf("SidePanels"))`; `:77` `SidePanelNoticeBox`; `:161` `SidePanelSyncConfirmModal`.
- `src/widgets/AccessoriesSections/lib/useSidePanelState.ts` — хук сітки: читає крайні шафи зі сцени (`useEdgeCabinets`, `:51-79`, rAF×2 + 250 мс), рахує `edgeState`/`targetSide` (`:106-113`), доступність (`:115-139`), опції (`:168-181`), автоприбирання при довжині 340 (`:183-185`), зміну groove через `applyGroove` (`:202-212`, `changeGroove` `:214+`).
- `src/widgets/AccessoriesSections/lib/sidePanelOptions.ts` — `resolveSidePanelFieldAvailability` (`:32`), `projectedTotalAfterGrooveChange` (+1 см на сторону, `:65-77`), `buildSidePanelOptions` (`:94`, вимикає опції за матрицею / Syntesi / довжиною).
- Користувач обирає не «Left/Right/Both/None», а **groove**: `NoG | UpperG | CenterG | DoubleG | None` (`src/features/sidePanel/lib/sidePanelService.ts:24`). Сторону визначає `resolveSidePanelTargetSide` (`src/features/sidePanel/lib/sidePanelEdgeCompatibility.ts:136-171`): одна шафа → `both`; виділена панель (за id) → її сторона; виділена крайня шафа → її сторона; інакше `both`/`left`/`right` за придатністю країв.
- `src/features/sidePanel/ui/SidePanelSyncConfirmModal.tsx:29` — підтвердження, коли активна й інша сторона; `SidePanelNoticeBox.tsx` — інфо-нотатки (`sidePanelReasons.ts:172`).
- 3D-контекстне меню: видалення панелі — `src/widgets/Player/components/PlayCanvasIntegration/PlayCanvasIntegration.tsx:2168-2190`; розпізнавання сутності-панелі — `:2955-2966`.

### Стан (Redux)
- `src/entities/product/model/store/slice.ts:92-94` — `productOptions.SidePanels: string` (groove), `SidePanelLeft` / `SidePanelRight: "active" | "none" | "auto-removed"`; дефолти `:270-272` (`""`, `"none"`, `"none"`).
- `slice.ts:716` `setSidePanelsOption`; `slice.ts:719-726` `setSidePanelSideStatus({ side, status })`.
- `src/features/configurationCommands/lib/commitChange.ts:155,161` — атрибути `SidePanelLeft/Right` → `setSidePanelSideStatus`.
- `src/features/sidePanel/model/selectors.ts:11-13` — `getSidePanelsOption`, `getSidePanelLeftStatus`, `getSidePanelRightStatus`; `mapCabinetTypeToGroup` (`:30-43`, групи `SBSC | OS | OSS` з `ruleData.sidePanels.cabinetGroups`); `selectSidePanelAvailability` (`:54-95`: Syntesi → матриця за висотою/handle/групою).
- Поза Redux: модульний стан «що сцена взяла» `src/utils/functions/playcanvas/sidePanels.ts:12-27` (`{ left, right }`, `rememberSidePanelSelection`, `getRememberedSidePanels`).

### Команди до 3D
- `src/features/sidePanel/lib/sidePanelService.ts` — усі сценарії: `applyGroove` (`:114`), `deleteSide` (`:145`), `autoRemoveSide` (`:162`), `autoRestoreSide` (`:170`), `bootBothSides` (`:183`), `applyGrooveToActiveSides` (`:196`), `autoRemoveBoth` (`:219`, довжина 340), `clearSidePanels` (`:231`), `reapplySidePanelsForPreset` (`:240-297`), `restoreSidePanelState` (`:303-328`); `resolveGroove` (`:59-73`).
- `src/features/sidePanel/hooks/useSidePanelActions.ts:29-45` — обгортки з `dispatch`.
- `src/features/configurationCommands/lib/changeSidePanels.ts:57-82` — єдина команда: `port.apply(placements)` → лише після успіху пише `SidePanelLeft/Right/SidePanels` (`:43-55`, `:72-74`); `partial` → `markRuntimeOutOfSync` (`:76-79`).
- `src/features/playCanvasAdapter/lib/createSidePanelPort.ts:35-71` — порт до сцени (див. розд. 2).
- `src/entities/configuration/model/runtimePort.ts:268-285` — типи `SidePanelPlacement { panel; side: left|right|both }`, `SidePanelApplyResult`, `ConfigurationSidePanelPort`.
- `src/features/playCanvasAdapter/lib/testSidePanelPort.ts` — фейк-порт для тестів (записує `calls`, `answerNext`).
- `src/utils/functions/playcanvas/sceneBridge.ts:118-146` — `applySceneConfig` → `ConfiguratorAPI.setConfigBatch`.
- `src/features/sidePanel/lib/sidePanelEnforce.ts:14-66` + `hooks/useSidePanelEnforce.ts:13-40` — авто-remove/restore за типом крайніх шаф.
- `src/features/sidePanel/lib/sidePanelMiddleware.ts:64-140` — listener на зміну handle/висоти/глибини/стилю/кольору стільниці; зареєстровано `src/app/store/optionsListener.ts:34`.

### Правила
- `src/features/sidePanel/lib/sidePanelRules.ts` — `mapSidePanelDrawersToHandleType` (`:48`), `sidePanelSpecRule` (`:60`), `sidePanelCountertopLengthRule` (`:79`), `syntesiSidePanelRule` (`:93`), `sidePanelAvailabilityRule` (`:110-154`).
- `src/features/configurator-rule-core/options/rules/sidePanelRules.ts:1-6` — лише ре-експорт з `features/sidePanel/lib/sidePanelRules`.
- `src/features/sidePanel/lib/sidePanelEdgeCompatibility.ts` — стан країв (`buildSidePanelEdgeState` `:53-95`), fallback-доступність (`:97-134`), `targetSide` (`:136-171`).
- `src/features/sidePanel/lib/sidePanelReasons.ts` — причини/нотатки; довжина 340 (`:176-190`).
- `src/entities/product/model/store/derivedSelectors.ts:93,99,115` — використання spec/countertop-length/Syntesi правил.

### SKU / pricing
- `src/shared/lib/sku/buildSidePanelSku.ts` — URSP SKU (USH/ULH/UF).
- `src/shared/lib/sku/buildCollectionSidePanelSku.ts` — власна панель колекції (Tricot).
- `src/shared/lib/sku/skuSeries.ts:14` — `sidePanel: "URSP"`.
- `src/shared/lib/pricing/ushSidePanelLines.ts` — рядок ціни USH-панелі.
- `src/shared/lib/pricing/buildPricingLines.ts:528-561` — USH.
- `src/shared/lib/pricing/buildCollectionPricingLines.ts:250-260, 426-475, 550-585` — ULH/UF (`pricedAs`) і Tricot (`baseSku`).
- `src/shared/hooks/usePricingInput.ts:100-102,162-164,205-207` — передає `sidePanelsOption/Left/Right` у pricing.
- `src/shared/lib/pricing/types.ts:23,114-116`; `summaryLinePrice.ts:89,107` (група `sidePanel`, підпис «Side Panel»).
- `src/entities/countertop/lib/calcCountertopWidth.ts:4,24` — `getActiveSidePanelCount`, +`SIDE_PANEL_WIDTH_CM` на кожну активну сторону.

### Маніфести колекцій
- `product-profile.json` → `ruleData.sidePanels` є тільки в USH, ULH, UF, Tricot. Ключі: `heightTokenByCm, blockedCabinetTypes, cabinetGroups, drawersByHandleType, groovePriorityByHandle (не в Tricot), exactBlockedCabinetLengthCm, countertopLengthIncrementCm, defaultQuantityUnlessHeightTypeLow, availability`.
  - USH: `heightTokenByCm {50:50H,53:53H,56:56H}`; `cabinetGroups { OSS:[Side-Shelf,OSS], OS:[Open-Shelf,OS], SBSC:[Sink-Base,Sink-Cabinet,Side-Cabinet,SB,SC,SBSC] }`; `drawersByHandleType {1D:[1D,1DWID,1,1+inner], 2D:[2D,2]}`; `groovePriorityByHandle { handle_urban_topcut:[UpperG,DoubleG], handle_urban_botcut:[CenterG], handle_pto:[NoG] }`; `exactBlockedCabinetLengthCm 340`; 6 рядків `availability` (напр. 50H → тільки NoG; 53H/1D → NoG,UpperG).
  - USH/ULH/UF: `blockedCabinetTypes ["OS","OSS"]`, `countertopLengthIncrementCm 2`, `defaultQuantityUnlessHeightTypeLow 2`.
  - Tricot: `heightTokenByCm {40:40H}`, `blockedCabinetTypes []`, SBSC включає `Tricot-sink-cabinet, Tricot-side-cabinet`, availability тільки `NoG`, increment 2.
  - UD: немає секції; нотатка `urban-duplex/product-profile.json:600` («sourced from USH/ULH … wait for GEN-SP-01; not offered»). Lame: нотатка `lame/product-profile.json:366` (власний SKU `VAN-LAMEV-SP`, не в профілі). Class/Mako: нічого.
- `sku-profile.json` → `sidePanel`: ULH і UF `{"pricedAs":"urban-standard-height"}`; Tricot `{ baseSku:"VAN-TRIC-SP-.8W-15.7H-20.5D", status:"confirmed", selection:{attributeId:"SidePanels", enabledValues:["NoG"]}, quantitySource:"activeSides", countertopWidthOffsetCm:1, colorAttributeId:"CabinetColor", elementCode:"CAB" }`; Class/Lame/Mako/UD — `null`. USH не має `sku-profile.json` (є `cabinet-sku-mappings.json`).
- `runtime-bindings.json` — `SidePanels`/`SidePanelLeft`/`SidePanelRight` усюди `status: "unbound"` (див. розд. 6).
- `presets.json` — `SidePanel*` трапляється лише в Tricot: `"SidePanels": "None"` ×86.

## 2. Контракт з 3D (`window.ConfiguratorAPI`)

Доступ: `window.containerRef.current.contentWindow.ConfiguratorAPI` (`sceneBridge.ts:44-65`). Готовність: `window.playCanvasReady === true` і є `setConfigBatch` (`sceneBridge.ts:71-74`).

Виклики, що стосуються панелей:
| Метод | Аргументи | Де | Що UI читає |
|---|---|---|---|
| `setConfigBatch(selector, patch)` | `selector = {}`, `patch = { SidePanel: <groove>, SidePanelSide: "left" \| "right" \| "both" }` | `createSidePanelPort.ts:27-33,49` → `sceneBridge.ts:118-146` | `true` = composition-wide add-on прийнято; `[]` = not-ready; `{updatedIds}` для продуктів (`sceneBridge.ts:80-111`) |
| `getEdgeCabinets()` | — | `src/utils/functions/playcanvas/getEdgeCabinets.ts:13-21` | `{ leftCabinetId, rightCabinetId }` |
| `getConfig(productId)` | runtime id крайньої шафи | `src/utils/functions/playcanvas/getConfig.ts:6`; виклик `sidePanelEnforce.ts:40` | `productType / ProductType / name` → група SBSC/OS/OSS (`sidePanelEnforce.ts:42-48`) |

Правила порту (`createSidePanelPort.ts`):
- одна шафа → `side` примусово `both` (`:46`);
- `None` + `both` розбивається на два патчі left/right, бо сцена не прибирає «both» за раз (`:27-33`);
- один патч на виклик — сцена робить early-return для `SidePanel/TowelBar/TowelBarColor` (`sceneBridge.ts:114-117`);
- після кожного прийнятого placement — `rememberSidePanelSelection(panel, side)` (`:66`).

Не знайдено в `src` (крім тестів): `exportSnapshot`, `features.sidePanelSelection`, `SidePanel_Left`, `SidePanel_Right`, `-SidePanel`. UI **не перелічує продукти-панелі сцени** і не читає їхню кількість/id. Кількість панелей UI знає лише зі свого стану: `SidePanelLeft/Right === "active"` (максимум 2) і з `getRememberedSidePanels()` (`sidePanels.ts:27`).

Звідки UI дізнається про панель у сцені:
- клік по сутності: `selectedSceneProduct` / `selectedProductConfig.{ProductType,productType,type,entityName}` містить `sidepanel` або `side-panel` (`PlayCanvasIntegration.tsx:2955-2966`);
- сторона виділеної панелі — за id: `resolveSelectedSidePanelSide` нормалізує та шукає `sidepanelleft` / `sidepanelright` (`sidePanelEdgeCompatibility.ts:46-51`);
- видалення з меню: `spName.includes("left"/"right")`; одна шафа або сторона не визначена → `deleteSide` left і right; інакше одна сторона з `remainingSideStatus` (`PlayCanvasIntegration.tsx:2168-2190`).

Тригери повторних викликів до 3D:
- middleware (`sidePanelMiddleware.ts:66-72`): `setSelectedDimensions` (лише height/depth, `:86-94`), `setSelectedProductConfig` (той самий продукт, змінився `Handle`, `:46-57`), `commitRuleSelection`, `switchAllCabinetsDrawerStyle`, `setCountertopColorSku` → `applyGrooveToActiveSides` (`:122-138`);
- swap шаф → `enforceSidePanelEligibilityForEdgeCabinets()` (`PlayCanvasIntegration.tsx:2489`);
- дублювання Side-Shelf на краю → `autoRemoveSide` (`PlayCanvasIntegration.tsx:2315-2319`; також `CabinetBuilderPage.tsx:1726`, `RightCabinetStyleSidebar.tsx:891`);
- зміна `SidePanels/Left/Right` → `syncCountertopConfig` через 300 мс (`PlayCanvasIntegration.tsx:1958-1963`).

## 3. SKU і ціна

### URSP (USH; ULH і UF через `pricedAs`)
- Формат: `VAN-{series.sidePanel}-{code}-{W}W-{H}H-{D}D[-CAB-{mat}-{color}][-HDL-{mat}-{color}]` (`buildSidePanelSku.ts:46-79`), приклад `VAN-URSP-1GU-.4W-20.9H-19.7D-CAB-LACM-90-HDL-LACM-DD` (`:43`).
- `code`: `NoG→0G, UpperG→1GU, CenterG→1GC, DoubleG→2G`, інше → `X` (`:28-33,49`); `None` → SKU немає (`:47`).
- W = `SIDE_PANEL_WIDTH_CM = 1` (`:36`); H, D — см→дюйми; глибина 46 → 45.5, інакше `toSkuDepth` (`:54-57`).
- `CAB` — завжди, якщо є матеріал; `HDL` — лише для grooved (не `NoG`), без власного кольору бере CAB (`:60-75`).
- `series.sidePanel = "URSP"` (`skuSeries.ts:14`); для ULH/UF явно `SKU_SERIES_BY_COLLECTION["urban-standard-height"]` (`buildCollectionPricingLines.ts:465`).
- Рядок: один `{ id: "sidePanel", group: "sidePanel", sku, quantity: activeSideCount }` (`ushSidePanelLines.ts:37-53`); `activeSideCount` = кількість `"active"` серед Left/Right (0..2). Окремого рядка на кожну панель немає.
- Джерела значень:
  - USH: `buildPricingLines.ts:531-561` — groove з `SidePanels` (UI-стан), колір шафи з пресетів або UI, матеріал через `resolveCabinetMaterialSku` / `inferSidePanelMaterialSku`.
  - ULH/UF: `buildCollectionPricingLines.ts:428-475` — розмір (`dimensionsByCabinet`) і `CabinetColor` / `HandleGrooveColor` першої **не короткої** шафи; `HandleGrooveColor` лише якщо `isChosenColor`.
  - UF short cabinet (`ruleData.steppedModules`): панель біля неї не ціноутворюється, gap `blocksTotal` «P1125, UFS-SP-01» (`:438-453`, `:467-468`).
- Ширина стільниці в pricing: `calcTotalCountertopWidthCm(width, left, right)` = +1 см на активну сторону (`calcCountertopWidth.ts:24`; виклики `buildPricingLines.ts:488`, `buildCollectionPricingLines.ts:258,351`).

### Tricot (власна панель)
- `buildCollectionSidePanelSku.ts:10-38`: потрібні `status:"confirmed"`, ціла `quantity > 0`, `colorAttributeId` та `elementCode`; колір має бути в профілі або в секції конфігуратора. SKU = `${baseSku}-${elementCode}-${material}-${code}` (`:37`) → `VAN-TRIC-SP-.8W-15.7H-20.5D-CAB-{mat}-{code}` (розмір зашитий у `baseSku`).
- `buildCollectionPricingLines.ts:550-585`:
  - `selected = SidePanels`, `enabled`, якщо значення в `enabledValues` (`["NoG"]`);
  - `quantitySource:"activeSides"` → `activeSideCount` за умови відомого readback обох сторін (`:252-254`);
  - вибір вимкнено, а сторони активні або readback невідомий → gap «selection and actual side activation disagree; scene synchronization is required» (`:553-560`);
  - рядок `id: "sidePanel:composition"` (`:577`), колір — `CabinetColor` першої шафи (`:563,570`).
- `countertopWidthOffsetCm === 1` → ширина стільниці +1 см на активну сторону (`:255-260`).

### Інше
- UD, Class, Mako, Lame: `sku-profile.sidePanel = null` → рядків панелі немає.
- Joint strip (UF): у `src/shared/lib/pricing/*` збігів `joint` немає — у ціну/SKU не потрапляє.

### Тести
- `src/shared/lib/sku/__tests__/ushSkuParity.test.ts:125` — паритет USH SKU (shelves, side panels, dividers, towel bars).
- `src/shared/lib/pricing/__tests__/tricotPanels.test.ts` (7 тестів):
  - `:71` контракт suffix/inheritance/activeSides;
  - `:106` не вигадує 2 панелі до активації;
  - `:121` потрібен readback обох сторін (legacy snapshots);
  - `:171` тільки NoG, «No» з джерела → None;
  - `:207` deselected без gap;
  - `:219` неповні/неоднозначні контракти.
- `src/shared/lib/pricing/__tests__/urbanFreestandingShortCabinetPricing.test.ts:55` — панель біля короткої шафи UF не ціноутворюється.
- `src/shared/lib/pricing/__tests__/regressionLines.test.ts`, `collectionPricing.test.ts`, `fixtures/pricingScenarios.ts` — згадують side panel (зміст не перевірено).
- `src/entities/countertop/lib/__tests__/calcCountertopWidth.test.ts:18`.

## 4. Пресети / snapshot

- Пресети не несуть даних панелей: коментар `src/pages/prebuilt/model/ModelPage.tsx:1115` («Presets carry no side-panel data»). Tricot `presets.json` має лише `"SidePanels": "None"` (×86).
- `columnsCompactPreset.ts` і `applyCompactPreset.ts` (`src/features/playCanvasAdapter/lib/`) — без згадок side panel.
- Зміна пресета (prebuilt):
  - `clearSidePanels` (`ModelPage.tsx:693`);
  - compact preset `applyAndAdoptCompactPreset` (`:695-699`);
  - `reapplySidePanelsForPreset(dispatch, profile, spGroove, effectivePresetProducts, length, sceneProductIds)` (`:733-742`).
  - Логіка `sidePanelService.ts:240-297`: краї = перший і останній продукт пресета (`:85-92`); придатний край — група SBSC; groove перевіряється матрицею і `resolveGroove`; неприйнятні краї → `auto-removed`. Попередній per-side стан не зберігається (`:236-237`).
- Відновлення збереженої конфігурації:
  - prebuilt — `uiStateValues.SidePanels/Left/Right` → `restoreSidePanelState` + `enforceSidePanelEligibility` (`ModelPage.tsx:1118-1145`);
  - custom — `CabinetBuilderPage.tsx:1596-1611` (те саме, дефолт сторони `"active"`).
- `restoreSidePanelState` (`sidePanelService.ts:303-328`): спершу `None/both`, далі groove на кожну активну сторону; одна шафа з обома активними → один `both`.
- Undo/redo: `src/entities/history/lib/restoreSnapshot.ts:200-209` — `SidePanels` переграється лише якщо binding `bound` (зараз скрізь `unbound`), далі `restoreSidePanelState(...)` без `record`.
- Збереження: `src/features/saveConfiguration/lib/selectSavePayload.ts:44-46`, `buildConfigurationMetadata.ts:36-38` — `SidePanels`, `SidePanelLeft`, `SidePanelRight` (рядки).
- Зміна моделі/handle/висоти: middleware перевибирає groove лише для `active` сторін (`sidePanelMiddleware.ts:122-138`, `sidePanelService.ts:196-213`). Groove `None` → сторони `auto-removed`. Зміна колекції окремо не оброблена (не знайдено).

## 5. Правила UI

| Правило | Де | Дані | Дублює 3D? |
|---|---|---|---|
| Колекція без `ruleData.sidePanels` → порожньо, `not-in-collection` | `sidePanelRules.ts:116-124` | profile | ні (UI-гейт) |
| OS/OSS на краю → блок; обидва краї OS/OSS → блок на всю сітку | `sidePanelRules.ts:126-135`, `sidePanelEdgeCompatibility.ts:58-80` | `blockedCabinetTypes`, `cabinetGroups` | 3D окремо (не перевірено) |
| Матриця groove за висотою × handle(1D/2D) × група | `sidePanelRules.ts:137-153` | `heightTokenByCm`, `availability` | не перевірено, чи 3D має свою |
| Пріоритет groove за handle | `sidePanelService.ts:59-73` | `groovePriorityByHandle` | — |
| Syntesi-стільниця забороняє панелі | `selectors.ts:64-77`, `sidePanelRules.ts:93-108` | `ruleData.syntesi` | — |
| Довжина шаф рівно 340 см → блок + `autoRemoveBoth` | `sidePanelReasons.ts:176-190`, `useSidePanelState.ts:100,183-185` | `exactBlockedCabinetLengthCm` | — |
| Ліміт довжини стільниці (+1 см на сторону) | `sidePanelOptions.ts:65-77`, `useCountertopLengthGuard` | `countertop.sidePanelsExceedMaxLength` | — |
| Довжина стільниці з панелями | `sidePanelRules.ts:79-91` (+`countertopLengthIncrementCm`=2 разом), `calcCountertopWidth.ts:24` (+1 на активну сторону) | — | так, ширину стільниці рахує й 3D (`syncCountertopConfig`) |
| Side-Shelf на краю «займає місце» панелі → `autoRemoveSide` | `PlayCanvasIntegration.tsx:2315-2319` | — | так, з 3D-логікою країв |
| Auto-restore при поверненні SB/SC на край | `sidePanelEnforce.ts:51-65` | `getEdgeCabinets` + `getConfig` | — |

- Кількість: `sidePanelSpecRule` дає `qty = defaultQuantityUnlessHeightTypeLow` (2), якщо не `LOW` (`sidePanelRules.ts:69`).
- `configurator-rule-core/countertop/lengthLimits.ts`, `parse.ts`, `hooks/useCountertopLengthGuard.ts` згадують side panels (деталі не читав).

## 6. Розбіжності / stale

- **Модель рівно 2 панелей**, зашита в UI:
  - стан `SidePanelLeft` / `SidePanelRight` (`slice.ts:92-94`);
  - remembered `{ left, right }` (`sidePanels.ts:3-15`);
  - краї `leftCabinetId` / `rightCabinetId` (`getEdgeCabinets.ts:1-4`);
  - ціна `quantity` ≤ 2 (`ushSidePanelLines.ts:37`, `buildCollectionPricingLines.ts:251`);
  - стільниця ≤ +2 см (`calcCountertopWidth.ts:24`, `refreshFullDimensions.ts:120-123`, `PlayCanvasIntegration.tsx:1020-1021`);
  - сторона за ім'ям сутності (`sidePanelEdgeCompatibility.ts:46-51`, `PlayCanvasIntegration.tsx:2170-2175`).

  Якщо 3D дає 0..N панелей на сторону (ULH/UF group-pipeline), UI цього не бачить: ціна = 1 SKU × кількість активних сторін, розмір — першої (не короткої) шафи.
- `runtime-bindings.json`, `SidePanels` (усюди `unbound`):
  - USH `:284-287` — посилання на `SIDE_PANEL_API.md`;
  - ULH `:280-283` — «scene places the ULH panels (sidePanelSupport profile ulh)»;
  - UF `:349-352` — «UF scene products declare no sidePanelSupport yet … legacy panels … USH heights (50/53/56) only»;
  - Tricot `:285-288` — «Export v44 has a Tricot_SidePanel template but registers no product … legacy panels … 50/53/56 only»;
  - UD `:366-368` — «Not offered (excludedFromThisProfile.sidePanels)».

  Нотатки UF/Tricot можуть бути stale щодо нинішнього 3D (UF side panels).
- Довжина стільниці рахується трьома різними способами:
  - `sidePanelCountertopLengthRule` додає `countertopLengthIncrementCm` (=2) разом, незалежно від кількості активних сторін (`sidePanelRules.ts:90`);
  - `calcTotalCountertopWidthCm` і `projectedTotalAfterGrooveChange` додають +1 на кожну активну сторону.

  Тест `src/features/sidePanel/__tests__/tricotSidePanels.test.ts:43` названо «1 cm a side when both sides take a panel», а перевіряє він плоске +2 правило.
- Тип `SidePanelSide` задано двічі: `sidePanels.ts:1` (`left|right|both`) і `sidePanelService.ts:22` (`left|right`).
- `restoreSnapshot.ts:201-203` переграє `SidePanels` лише при `bound`, а в усіх колекціях `unbound` — гілка мертва (панелі йдуть через `restoreSidePanelState`).
- `refreshFullDimensions.ts:120` бере ширину панелей з remembered-стану сцени, а pricing — з Redux-статусів; при `partial` вони можуть розійтися (`markRuntimeOutOfSync`, `changeSidePanels.ts:76-79`).
- `PlayCanvasIntegration.tsx:2312` — залишений `console.log("mergedConfig", …)`.

## 7. Як запускати і тестувати

- `package.json` scripts: `dev: vite`, `build: tsc -b && vite build`, `tsc: tsc -b`, `lint: eslint .`, `test: vitest run`, `preview`, `start` (vite preview, порт `${PORT:-4173}`).
- Конфіг: `vitest.config.ts:12-15` — `environment: "node"`, `include: ["src/**/__tests__/**/*.test.{ts,tsx}"]`.
- Один файл: `npx vitest run <шлях>`.
- Тести панелей:
  - `src/features/sidePanel/lib/__tests__/sidePanelRules.test.ts` (20): матриця USH `:35`, групи `:82`, інші дані `:112`, Syntesi `:157-169`, +2 см `:177`;
  - `src/features/sidePanel/lib/__tests__/sidePanelService.test.ts` (14): auto-removed при groove None `:44`; user-removed не чіпає `:62`; restore multi `:92` / single `:103`; preset-край OS → auto-removed `:109,139`;
  - `src/features/sidePanel/lib/__tests__/sidePanelHandleChange.test.ts` (3): PTO скидає UpperG `:90`;
  - `src/features/sidePanel/__tests__/tricotSidePanels.test.ts` (2);
  - `src/features/playCanvasAdapter/__tests__/createSidePanelPort.test.ts` (4): `both` для 1 шафи `:28`; None двома патчами `:37`;
  - `src/shared/lib/pricing/__tests__/tricotPanels.test.ts` (7);
  - `src/shared/lib/pricing/__tests__/urbanFreestandingShortCabinetPricing.test.ts` (2);
  - `src/shared/lib/sku/__tests__/ushSkuParity.test.ts` (4);
  - `src/entities/countertop/lib/__tests__/calcCountertopWidth.test.ts` (1);
  - `src/entities/collection/lib/runtimeBindings/__tests__/tricotRuntimeBindings.test.ts` (12);
  - `src/entities/history/__tests__/restoreSnapshot.test.ts:26-142` (мок `restoreSidePanelState`);
  - також згадують панелі: `src/features/configurationRestore/__tests__/{commandAttributesRoundtrip,tricotPersistence}.test.ts`, `src/widgets/AccessoriesSections/__tests__/AccessoriesSections.test.tsx`, `src/features/playCanvasAdapter/__tests__/{createPlayCanvasRuntimePort,tricotRuntimeHandoff}.test.ts`.
- Fixtures:
  - `src/entities/collection/__tests__/fixtures/remote/` (`README.md`, `configurator-{4,9,11,12,13,14}.json`, `datatable-4xx/5xx.json`);
  - `src/shared/lib/pricing/__tests__/fixtures/{pricingScenarios,collectionPricingScenarios}.ts`.

## Не перевірено / суперечності

- Тести не запускав; гілку не порівнював з `main`.
- `selectSidePanelAvailability`: `useSidePanelState.ts:5` імпортує її з `entities/product/model/store/derivedSelectors`, а визначення бачив у `features/sidePanel/model/selectors.ts:54`. Чи це той самий ре-експорт — не перевірено.
- Як USH (`buildPricingLines.ts`) бере висоту/глибину панелі (перша шафа чи `selectedDimensions`) — рядки після `:561` не читав.
- `heightTokenByCm` і `availability` для ULH/UF не виписував (лише USH і Tricot). Чи збігаються вони з висотами, які 3D реально підтримує для ULH/UF-панелей, — не перевірено.
- Чи 3D сам блокує панелі біля OS/OSS і на 340 см — UI робить це сам (розд. 5); паралель у 3D не перевіряв.
- `SIDE_PANEL_API.md` (згадано в `urban-standard-height/runtime-bindings.json:286`) у репо не шукав.
- Суперечність +2 см разом проти +1 см на сторону (розд. 6) не розв'язана. Яке значення бере 3D для стільниці — не перевірено.
- `configurator-rule-core/countertop/{lengthLimits,parse}.ts`, `useCountertopLengthGuard.ts`, `useSceneTotalWidthWithSidePanels.ts`, `summaryFormatters.ts`, `buildInfoTooltip.ts` — є згадки side panel, вміст не читав.
- Поведінку при зміні колекції (а не пресета) окремо не знайшов.
