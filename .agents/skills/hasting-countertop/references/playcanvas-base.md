# Стільниця — база і композиція (scope `playcanvas` › `base`)

Читай разом із `contract.md`. Коли сюди: що таке `Top_Solid`/`Cabinet_Cover`, конфіг-поля CT, як CT прив'язана до тумб (`countertopSupport`, `SupportGroupId`, таблиця колекцій), що робить `RuleCountertopLayout` / `BooleanCutouts` / `CollisionRefresh`, кавер, hosted sink і `moveSink/liftSink/landSink`, публічний API. Рух/offset → `playcanvas-positioning.md`; причини невалідності → `playcanvas-validation.md`; жести/снап/колізії → `playcanvas-dnd.md`.

## Сценарії
- **CT не там по X/Y або не тієї довжини в спокої** → `RuleCountertopLayout` (§4): basin top знайдено? група (`SupportGroupId`) порожня? early return через side-panel plan? → `resolveCountertopSupportBase` (`non-coplanar-supports`) → `updateStandardLayout`.
- **Отвір мийки не той / зник / не перерізається** → `RuleCountertopBooleanCutouts` (§4): cutters лише під sink anchor; сигнатура відносних трансформ; `forceRebuild` на drag-end; `COUNTERTOP_MESH_BOOLEAN_MISSING`.
- **Кавер не там / імпорт пресета падає з `CABINET_COVER_RESTORE_FAILED`** → `countertop-collections.mjs` (тип тумби в `sourceTypes` / `lineTypes` / `freeLayoutSourceTypes`?) → `cover-composition-adapter` діагностики (`unsupported-cover-profile-source`, `invalid-ulh-source`…) → `cover-policy`.
- **Нова колекція** → `countertopSupport` + anchor `<Col>_Countertop_Point` на тумбах, запис у таблицю колекцій (кавер, basin top policy), `RuleChangeSinkType`/`RuleSinkMountPosition` для sink-тумб, тест `collection-countertop-anchors`.
- **Зміна API** → `countertop.plugin.mjs` + `countertop-contract.mjs` + 4 копії контракту (`contract.md` → розриви) + `docs/countertop/ui-integration-phase1.md`; узгодити з UI.

## Інваріанти
- Стандартні X/Y і авто-довжину пише лише `RuleCountertopLayout`; усі інші лише читають.
- Мийки шукаються в одному місці — `resolveCountertopAssembly().sinks`; один sink host на anchor.
- Порядок handlers: LameUndertop → UD OSS → **CountertopLayout → BooleanCutouts** → SidePanels → TowelBars → … → CabinetCoverReconcile → **CollisionRefresh (останній)**.
- Неоднозначний basin top (кілька `basinTop`) → reset, не «перший ліпший».
- AABB тумби для layout — без мийки й cutters (`cabinetFootprintIgnoreNodes`), інакше offset «з'їжджає».
- Attached ⇒ довжина композиції; повернення в attached скидає `CountertopLengthM`.

---

# Стільниця (countertop): базова логіка в PlayCanvas

Репо `hasting-modular-playcanvas-flow-git/src`, гілка `feture/part-2`. `AC/` = `Scripts/app-configuration/`.
Рядки дійсні на 2026-10-20. Позначка «(за назвою)» означає, що файл не відкривали і опис узято з назви.

## 1. Карта файлів

### domain/countertop: база
| Файл | Що робить |
|---|---|
| `AC/domain/countertop/countertop-contract.mjs` | Публічний контракт v1: enum-и readiness / placementState / motionState / interactionState, `COUNTERTOP_CHANGE_REASON`, `COUNTERTOP_ERROR_CODE` (L3–57) |
| `AC/domain/countertop/countertop-collections.mjs` | Таблиця колекцій ULH / UD / UF: кавери і basin top policy; закрита в модулі, назовні лише функції (L1–149) |
| `AC/domain/countertop/basin-top-policies.mjs` | Політика `'highest-plane'`: на яких тумбах лінії лежить основна CT (L32–65) |
| `AC/domain/countertop/countertop-role.mjs` | Роль продукту `basinTop` / `cabinetCover` / `unknown`, `resolveBasinTopProduct` (found / ambiguous / missing) (L2–42) |
| `AC/domain/countertop/countertop-hosted-sink.mjs` | Ключі для мийки на стільниці (HR-CT-02): `CountertopSinkType`, `CountertopSinkLocalM`, `Countertop_SinkPoint` (L8–20) |
| `AC/domain/countertop/countertop-layout-policy.mjs` | Чиста математика X і авто-довжини, правило attached і довжини (L8–177) |
| `AC/domain/countertop/countertop-support-resolver.mjs` | Вертикаль: `COUNTERTOP_POSITIONING`, `COUNTERTOP_PLACEMENT`, вибір групи за `SupportGroupId`, резолв support plane (L8–127) |
| `AC/domain/countertop/countertop-length-limits.mjs` | Ліміти довжини (за замовчуванням 0.6 м … 120″), мінімум за вирізами мийки (`resolveBasinMinLengthM`), clamp (імпорти в adapter L20–27) |
| `AC/domain/countertop/countertop-resize-bounds.mjs` | Межі ресайзу з кожного боку: край мийки ≥ 10 см від торця, SB накрита (adapter L28, JSDoc L507–513) |
| `AC/domain/countertop/countertop-resize-snap.mjs` | Snap ресайзу: крок 0.1″, прилипання в межах 1″ (`docs/rules-manifest.md` HR-CT-03) (за manifest) |
| `AC/domain/countertop/countertop-units.mjs` | Переведення дюймів у метри і назад (L1–10) |
| `AC/domain/countertop/README.md` | Опис полів, наприклад `CountertopPositioning` (L26), `CountertopPlacement` (L27) |
| `AC/domain/countertop/adapters/countertop-composition-adapter.mjs` | Runtime-прив'язка однієї CT активної композиції (CT-07): стан, offset, довжина, мийки, CSG, події (клас L158, factory L1790) |
| `AC/domain/countertop/adapters/countertop-geometry-adapter.mjs` | Застосування довжини (SmartStretch + MeshBoolean), `COUNTERTOP_GEOMETRY_RESULT_STATUS` (adapter L10–13, L1562–1564) |
| `AC/domain/countertop/adapters/countertop-support-measurement.mjs` | Вимір Y опори тумби (anchor, інакше fallback mesh) і монтажної площини CT (L1–94) |
| `AC/domain/countertop/adapters/countertop-dimension-adapter.mjs` | Розмірні лінії, `measureCountertopMeshBoundsM` (adapter L15–18) |
| `AC/domain/countertop/adapters/countertop-edit-overlay.mjs` | Оверлей edit-size (adapter L14) (за назвою) |
| `AC/domain/countertop/debug/countertop-sink-log.mjs` | Debug-лог мийки (`?debug=true` / `?sinkLog=1`, `countertopSinkDump()`) (adapter L195–199) |

### Cover (кавер)
| Файл | Що робить |
|---|---|
| `AC/domain/countertop/cover/cover-policy.mjs` | `planCabinetCovers`, `planCabinetCoverFootprints` (L282, L287) |
| `AC/domain/countertop/cover/cover-service.mjs` | `createCabinetCoverService({ port, onChange })` (L21) |
| `AC/domain/countertop/cover/cover-reconcile-plan.mjs`, `cover-contracts.mjs`, `index.mjs` | План reconcile, контракти, barrel (за назвою) |
| `AC/domain/countertop/cover/adapters/cover-composition-adapter.mjs` | Збирає вхід плану з композиції; aggregation handler `CabinetCoverReconcile` (L262, L827–844) |
| `AC/domain/countertop/cover/adapters/cover-product-port.mjs` | Створює продукти `Cabinet_Cover` (`CountertopRole: 'cabinetCover'`, `generatedBy`) (L118, L160) |
| `AC/domain/countertop/cover/adapters/cover-support-adapter.mjs` | Support descriptor тумби для кавера (`createUlHSupportDescriptor` L153, `coverCompatibilityKey` L164) |

### Composition rules
| Файл | Що робить |
|---|---|
| `AC/domain/composition/rules/RuleCountertopLayout.mjs` | Повний стандартний X/Y/length-план CT, викликає `adapter.updateStandardLayout` (L41–411) |
| `AC/domain/composition/rules/RuleCountertopBooleanCutouts.mjs` | CSG-вирізи: `BoolB_*` під sink anchor-ами і клони `Vessel_BoolCut`, викликає `adapter.updateBooleanCutouts` (L20–375) |
| `AC/domain/composition/rules/RuleCountertopCollisionRefresh.mjs` | Останнє правило: відкриває відкладений collision refresh; `COUNTERTOP_COLLISION_GEOMETRY_PARAMS` (L3–80) |
| Дотичні: `RuleChangeBasinStyleMaterial.mjs`, `RuleSidePanels.mjs`, `RuleOpenSideShelfNeighboursUrbanDuplex.mjs` (L210–213 basin-top groups), `RuleTowelBars.mjs` | Читають роль, групу або `sinks` CT |

### Product rules продукту `Top_Solid` (`product-config-loader.mjs` L285–288)
`AC/domain/product/rules/RuleChangeCountertopHeight.mjs` (priority 25), `RuleChangeCountertopDepth.mjs` (30), `RuleChangeCountertopPositionByStrategy.mjs` (35; читає `CountertopPositioning`, L30/L34), `RuleCountertopSinkPointPosition.mjs` (60; тримає `Countertop_SinkPoint` у `CountertopSinkLocalM` з поправкою на Thickness, L32/L48). Ще є `RuleChangeCountertopColor.mjs` і `RuleChangeCountertopPosition.mjs`, але в rules продукту `Top_Solid` їх немає.

### Bridge / API
| Файл | Що робить |
|---|---|
| `AC/bridge/plugins/countertop.plugin.mjs` | `window.ConfiguratorAPI.countertop` (фасад над adapter) і `countertopOverlay` (L1–210) |
| `AC/bridge/plugins/cabinet-local-runtime.mjs` | `moveSink` / `liftSink` / `landSink` (pure-функції над документом L92–165, API L1133–1162), перенесення `CABINET_COVER_RESTORE_FAILED` у reasons (L812–830) |
| `AC/bridge/global-bridge.mjs`, `cabinets.plugin.mjs`, `cabinet-local-scene.mjs`, `product*.plugin.mjs`, `selection.plugin.mjs` | Згадують countertop (не розбирали) |

### Spatial / D&D / валідація (частини інших агентів, лише перелік)
`AC/domain/countertop/spatial/countertop-assembly-resolver.mjs` (тут описано лише частину про sink host, див. §3), `spatial/countertop-spatial.mjs`, `spatial/countertop-snap-targets.mjs`, `spatial/countertop.manipulable.mjs`, `adapters/countertop-drag-overlay.mjs`, `trap/trap-keepout.mjs`, `AC/domain/composition/spatial/*` (`composition-spatial.mjs` з `SPATIAL_OFFSET_KEY`, `collision-outline.mjs`, `composition-scene.mjs`, `hasting-collision-profiles.mjs`), `AC/domain/spatial-manipulation/*`, `AC/domain/collision/collision-config.mjs`.

### Cabinet-placement (дотичні)
`AC/domain/cabinet-placement/basin-top-home.mjs`, `portable-basin-top.mjs`, `compact-preset.mjs` (поля CT у пресеті L36, L366–375, L492), `adapters/cabinet-rows-layout.mjs` і `adapters/cabinet-columns-layout.mjs` (пишуть `SupportGroupId`: L304/L340/L403 і L342/L409/L446).

### Тести (`tests/node/`)
- CT: `countertop-*.test.mjs` (layout-rule, collections, support-resolver, resize-bounds / from / pointer, sink-hosts / sweep / together, hosted-sink-cutters, boolean-cutters-discovery, side-panels-group, lowered-remote, position-strategy, stale-world-sync, active-handoff, manipulation, drag-overlay, overlay-box-collision, collision-profiles, dimension-units-suppression).
- Мийка: `hosted-sink-adapter|document|scene.test.mjs`, `sink-mount-config.test.mjs`, `sink-mount-ud-tricot-uf.test.mjs`, `assign-support-groups-sink-delete.test.mjs`.
- Кавер: `cabinet-cover-*.test.mjs`, `cover-policy-carried.test.mjs`, `risk-basin-top-groups.test.mjs`, `collection-countertop-anchors.test.mjs`.
- Хелпери: `helpers/countertop-vm.mjs`, `helpers/countertop-sweep-fixture.mjs`, `goldens/countertop-*.mjs`.

### Docs
`docs/features/countertop-collections/README.md`, `docs/rules-manifest.md` (CT L53–69, CV L71–80), `docs/countertop/ui-integration-phase1.md`, `docs/countertop-collisions.md`, `docs/countertop-snapping.md`, `docs/features/cabinet-cover/*`, `docs/features/counttop/relocation and remote positions/*`, `docs/onboarding/03-countertop-and-movement.md`, `docs/features/ulh-cabinet-addition/_fixes/2026-09-29-countertop-*.md`.

## 2. Модель даних

### Продукти
- **`Top_Solid`**: єдиний продукт основної стільниці. `category: 'countertops'`, mesh `Top_Solid` (`AC/domain/product/registry/product-config-loader.mjs:260–303`).
  - subProduct для мийки на стільниці: `attachPoint: Countertop_SinkPoint`, `configKey: CountertopSinkType`, `anchorLocalKey: CountertopSinkLocalM`, `required: false`. `sinkMount` немає (`:269–280`).
  - `defaultConfig: { Thickness: 0.375, CountertopLengthM: null, CountertopRole: 'basinTop' }` (`:292–296`).
  - `countertopMount: { anchorName: 'Countertop_Mount_Point', fallbackMeshName: 'TopSolid', baseLocalYM: -0.00635 }` (`:297–302`).
  - `thicknessOffsets.countertop`: ключі Thickness у дюймах (0.375 … 5.5) → поправка Y (`:303–316`).
- **`Cabinet_Cover`**: `category: 'countertops'`, той самий mesh `Top_Solid`, `rules: []`, `defaultConfig: { CountertopRole: 'cabinetCover', generatedBy: 'cabinet-cover-v1' }` (`product-config-loader.mjs:322–337`).
- **Інші `Top_*` (`Top_HPLPrisma`, `Top_Glass_Nettuno`, `Top_HPLQuadra`, `Top_HPLCover`, `Top_HPLStrip`, `Top_HPL/Fenix_Cover_Gres` …) не є стільницями.** Це мийки: `category: 'sinks'`, `isSubProduct: true`, `parentAttachPoint: 'Sink_Point'` (`:1290`, `:1310`, `:1330`, `:1350`, `:1368`; усього 34 продукти з `category: 'sinks'`).
- Автостворення `Top_Solid` разом із першою тумбою: `AC/domain/composition/composition-manager.mjs:~496–540`. Config (`:518–533`): `Depth`, `Height`, `Thickness` і `sinkType` беруться з першої тумби; `CountertopPositioning` = `resolveCountertopPositioningProfile().strategy`; `CountertopRole: 'basinTop'`; `CountertopPlacement: 'supported'`; `SupportGroupId: 'group-1'`. Fallback Thickness тут 0.5, а в defaultConfig продукту 0.375.

### Ролі
Визначає `getCountertopRole` (`AC/domain/countertop/countertop-role.mjs:2–18`):
- Явна `CountertopRole` ∈ {`basinTop`, `cabinetCover`}. Будь-яке інше значення дає `unknown`. Згенерований (`generatedBy === 'cabinet-cover-v1'`) продукт з `basinTop` теж дає `unknown`.
- Ключа немає: `generatedBy` дає `cabinetCover`, `productType === 'Top_Solid'` дає `basinTop`, решта `unknown`.
- `isCabinetCoverProduct` також впізнає `productType === 'Cabinet_Cover'` (`:21–27`).
- `resolveBasinTopProduct(products)` збирає всіх кандидатів `basinTop`, сортує за id і повертає `{ status: 'found'|'ambiguous'|'missing', productId, snapshot, candidateIds }` (`:30–42`). Вибір від порядку вставки не залежить.
- Роль «primary» у коді не знайдена. Основна стільниця тут називається `basinTop`.

### Конфіг-поля стільниці
| Поле | Значення | Оголошено | Пише | Читає |
|---|---|---|---|---|
| `CountertopPositioning` | `'legacy'` \| `'support-plane'`: **вертикальна** стратегія, НЕ standard/offset/remote | `countertop-support-resolver.mjs:8–11` | `composition-manager.mjs:529`; compact-preset defaults (`compact-preset.mjs:366`) | `RuleCountertopLayout.mjs:281` (fallback: профіль тумб `:277–280`), `RuleChangeCountertopPositionByStrategy.mjs:34` |
| `CountertopPlacement` | `'supported'` \| `'independent'` | `countertop-support-resolver.mjs:13–16` | `composition-manager.mjs:531`, `cabinet-local-runtime.mjs:973` | `RuleCountertopLayout.mjs:283` |
| `CountertopRole` | `basinTop` \| `cabinetCover` | `countertop-role.mjs` | `composition-manager.mjs:530`, `cover-product-port.mjs:118,160`, defaultConfig | `countertop-role.mjs`, `composition-scene.mjs:85`, cover adapter WATCH `:17` |
| `SupportGroupId` | рядок, за замовчуванням `'group-1'` | `DEFAULT_COUNTERTOP_SUPPORT_GROUP_ID` `countertop-support-resolver.mjs:18` | `composition-manager.mjs:532,1121`, `cabinet-rows-layout.mjs:304,340,403`, `cabinet-columns-layout.mjs:342,409,446`, `side-panel-group-policy.mjs:198`, `compact-preset.mjs:375` | `selectCountertopSupportGroup` `:31–35`, `RuleCountertopLayout.mjs:234,285`, `countertop-support-measurement.mjs` (groupId), `RuleOpenSideShelfNeighboursUrbanDuplex.mjs:211` |
| `CountertopLengthM` | м або `null` (власна довжина) | `COUNTERTOP_LENGTH_KEY` `countertop-composition-adapter.mjs:44` | adapter `setLengthM` (`:504`), `resizeFromM` (`:552–556`) | `_syncLength` (`:1550–1554`), `getState().customLength` (`:339`) |
| `SpatialOffsetM` | `{x, y}` м від стандартної пози | `SPATIAL_OFFSET_KEY` (`composition/spatial/composition-spatial.mjs`; import у adapter `:32`) | adapter `_commitOffset` / `_offsetPatch` (`:1245`, `:1457`); `lowerCountertop` ставить `y = 0` (`cabinet-local-runtime.mjs:75–81`) | Layout і Boolean watchParams; `liftSinkDocument` (`:127`) |
| `CountertopSinkShiftM` | X мийки (м) відносно sink point + offset.x, поки підняла CT несе мийку тумби; інакше null | `COUNTERTOP_SINK_SHIFT_KEY` adapter `:47–48` | adapter `_sinkShiftToWrite` (`:777–786`); видаляють `lowerCountertop`/`liftSinkDocument` (`cabinet-local-runtime.mjs:81,141`) | adapter, `compact-preset.mjs:492` |
| `CountertopSinkType` | тип мийки на стільниці; наявність ключа означає, що CT хостить мийку | `countertop-hosted-sink.mjs:8` | `liftSinkDocument` (`cabinet-local-runtime.mjs:136`) | `isHostedSinkConfig` `:17–20`; Boolean watchParams `RuleCountertopBooleanCutouts.mjs:25` |
| `CountertopSinkLocalM` | `{x,y,z,thickness?}` у локальному кадрі кореня CT | `countertop-hosted-sink.mjs:11` | `liftSinkDocument` (`:140`) | `RuleCountertopSinkPointPosition.mjs:48` |
| `Thickness` | дюйми (ключі `thicknessOffsets`) | defaultConfig `0.375` (`product-config-loader.mjs:293`) | composition-manager з першої тумби (`:523`) | Layout/Boolean watchParams; `liftSinkDocument` фіксує його в `CountertopSinkLocalM.thickness` (`:138–140`) |
| `sinkType` | тип мийки **на тумбі** (SB) | subProduct `configKey: 'sinkType'` тумб | UI / moveSink / landSink | Boolean `aggregateFn` (`:40`), resolver `sinkId` |

### Пороги
- `COUNTERTOP_INTRINSIC_LENGTH_M = 0.6` (`countertop-layout-policy.mjs:11`).
- `COUNTERTOP_ATTACHED_EPSILON_M = 1e-6` (`:157`).
- `COUNTERTOP_REST_TOLERANCE_M = 0.01` (adapter `:46`).
- `LIFTED_M = 0.01` (`cabinet-local-runtime.mjs:91`).

## 3. Прив'язка до тумб

### `countertopSupport` у продуктах тумб
Опис: `{ strategy: 'support-plane', anchorName, fallbackMeshNames }`. Anchor-и (`product-config-loader.mjs:204–211`, `COUNTERTOP_SUPPORT_ANCHOR_BY_COLLECTION`):

| Колекція | Anchor |
|---|---|
| ULH | `ULH_Countertop_Point` |
| CLASS | `Class_Countertop_Point` |
| MAKO | `Mako_Countertop_Point` |
| LAME | `Lame_Countertop_Point` |
| UF | `UF_Countertop_Point` |
| TRICOT | `Tricot_Countertop_Point` |
| UD | `'UD_Countertop_Point'`, задано прямо в продукті (`:847`, `:900`) |

Продукти з `countertopSupport` (рядок `registerProduct`):
- ULH: `ULH-sink-cabinet` 499 (fallback `ULH_Cabinet_Walls`), `ULH-side-cabinet` 575, `ULH-Open-Shelf` 628.
- Class: `Class-sink-cabinet` 660, `Class-side-cabinet` 712.
- Mako: `Mako-sink-cabinet` 741, `Mako-side-cabinet` 799.
- UD: `UD-sink-cabinet` 841, `UD-side-cabinet` 894, `UD-open-shelves` 925, `UD-open-shelves-side` 949.
- UF: `UF-sink-cabinet` 970, `UF-side-cabinet` 1028, `UF-open-shelves` 1061, `UF-open-shelves-side` 1081.
- Lame: `Lame-sink-cabinet` 1103, `Lame-side-cabinet` 1162.
- Tricot: `Tricot-sink-cabinet` 1201, `Tricot-side-cabinet` 1254.

У `Sink-Base` (UniBox, `:346`) `countertopSupport` немає, тож для нього strategy дорівнює legacy.

### Вимір опори
- `measureCabinetCountertopSupport` (`countertop-support-measurement.mjs`): спершу Y anchor-а (`source: 'anchor'`), інакше max верхнього Y з AABB fallback-мешів (`'verified-mesh-bounds'`). Strategy ≠ support-plane дає `'unsupported-product'`, нічого не знайдено дає `'support-unavailable'`. Повертає `{ id, groupId, worldY, source }`.
- `measureCountertopMountWorldY`: `Countertop_Mount_Point`, fallback нижній край `TopSolid`.
- `resolveCountertopSupportBase` (`countertop-support-resolver.mjs:72–119`):
  - `legacy` або `independent` → `passthrough`;
  - опори не копланарні (>1 мм) → `unresolved: 'non-coplanar-supports'`;
  - інакше `rootWorldY = avg(supportY) − (mountY − rootY)`.
- `resolveCountertopPositioningProfile` (`:42–59`): strategy тумб має збігатися у всіх, інакше `legacy`.

### Ряд під стільницею
- Free layout (`compositionManager.preserveCabinetPositions === true`): `selectCountertopSupportGroup` залишає тумби з тим самим `SupportGroupId`, що в CT (`countertop-support-resolver.mjs:31–35`; `RuleCountertopLayout.mjs:152–154`). Порожня група → warn + return (`:165–168`).
- Legacy-лінія: `basinTopPolicyOf(productTypes)` → `selectBasinTopCabinets` (`RuleCountertopLayout.mjs:157–160`, `:333–349`).
- `topCoversPartOfCabinets = freeLayout || cabinetsUnderTop < all` (`:163`). У цьому разі бокові панелі фільтруються за суміжністю до групи (`:230–254`).
- `topGroupId` = `SupportGroupId` CT; панелі group-плану беруться лише з `panel.groupId === topGroupId` (`:234–237`).
- Вертикаль рахується лише по `cabinetSupportFacts` з `groupId === supportGroupId` (`:294`).

### Таблиця колекцій (`countertop-collections.mjs:23–58`)
| id | compatibilityKey | sourceTypes | lineTypes | freeLayoutSourceTypes | enabledByDefault | basinTopPolicy |
|---|---|---|---|---|---|---|
| ULH | `ulh-flat` | ULH-sink-cabinet, ULH-side-cabinet | — | ULH-Open-Shelf | false | null |
| UD | `ud-flat` | UD-sink-cabinet, UD-side-cabinet | UD-open-shelves-side | UD-open-shelves | false | null |
| UF | `uf-flat` | UF-sink-cabinet, UF-side-cabinet | UF-open-shelves, UF-open-shelves-side | [] | true | `'highest-plane'` |

Функції:
- `coverCompatibilityKey(type)` (`:82–84`).
- `isCoverSource(type, { freeLayout })` (`:87–92`).
- `isLineOnlyType(type)` (`:99–102`).
- `ownerOf(types)`, приватна (`:109–115`): усі типи мають належати одній колекції, інакше null.
- `basinTopPolicyOf` (`:118–120`).
- `defaultCoverSettingsFor(composition)` (`:127–149`): повертає `{ enabled: true, profileId: 'ulh-v1', eligibilityMode: 'all', thicknessM: 0.0128, tolerances: { contactM: .001, adjacencyM: .001, numericalM: 1e-6 } }` лише коли всі тумби (без згенерованих каверів) належать колекції з `enabledByDefault`, тобто лише UF.
- Підключення колекції = 1 запис у таблиці + робочий `countertopSupport` (`:1–6`).

### Basin top policy (`basin-top-policies.mjs`)
`highestPlanePolicy(items, { levelM = .001, gapM = .005 })` (`:32–55`):
- `items = [{ id, worldY, xMinM, xMaxM }]`, щонайменше 2.
- Усі на одному рівні або є невиміряний → `null`, тобто CT лягає на всі.
- Інакше береться перший зліва ряд найвищих тумб, що стоять впритул. Решта отримують кавер.
- `selectBasinTopCabinets(policyId, items)` (`:62–65`).

### Sink host: `countertop-assembly-resolver.mjs` (лише модель sinks)
- `resolveCountertopAssembly` (`:58`) повертає `{ countertop, sinks, cutters, transformTargets, … }`. Це єдине місце пошуку мийок (`:5–9`). Правила і adapter власного пошуку не мають (`:17–28`).
- `sinks`: по 1 запису на тумбу з рівно одним вузлом sink mount (`getSinkAnchorName`), останнім іде CT з рівно одним `Countertop_SinkPoint`. Якщо в anchor-а немає живої дитини (Vessel placeholder), то `entity: null`.
- `SinkHost` = `{ sinkId, entity, anchor, host: { kind: 'cabinet'|'countertop', id, root }, cutters }` (`:33–38`, `:117`).
- `cutters`: `BoolB_*` під sink anchor-ами + `Vessel_BoolCut_Clone_<i>` / `Vessel_BoolCut_Clone_Countertop` (`:10–13`, `HOSTED_VESSEL_CUTTER_CLONE_NAME` `:49`).
- `transformTargets`: CT root, живі мийки тумб, cutters (`:14–16`, `:73–97`).
- Resolver read-only: нічого не шукає в `app.root`, не перепідв'язує й не трансформує (`:30–31`).

### SB ↔ SC (`cabinet-local-runtime.mjs`)
- `moveSinkDocument` (HR-CT-01, `:92–115`): SB↔SC у межах однієї колекції (`sinkPairOf`), нові id (тип у префіксі), sink-ключі переносяться, id перейменовуються у connections/rows/посиланнях CT, CT опускається.
  - Помилки: `UNKNOWN_CABINET` / `NOT_SINK_BASE` / `ALREADY_SINK_BASE` / `NOT_SIDE_CABINET` / `INVALID_INPUT`.
- `liftSinkDocument` (HR-CT-02, `:117–144`):
  - умова: `SpatialOffsetM.y > LIFTED_M (0.01)` і CT ще не хостить мийку;
  - SB стає SC з новим id без sink-ключів;
  - CT отримує `CountertopSinkType = SB.sinkType` (або default), `VesselColor`, `CountertopSinkLocalM = sinkLocalM + thickness`;
  - `CountertopSinkShiftM` видаляється, поза CT не змінюється.
- `landSinkDocument` (HR-CT-02, `:146–165`): SC стає SB з новим id; `sinkType` і `VesselColor` переходять із CT на тумбу; з CT видаляються `CountertopSinkType`, `CountertopSinkLocalM`, `VesselColor`; `lowerCountertop`.
- API (`:1133–1162`):
  - `moveSink({ fromCabinetId, toCabinetId })` → `{ …receipt, idMap, sinkHostId }`, виділяє новий SB;
  - `liftSink({ fromCabinetId, sinkLocalM })` → `{ …receipt, idMap, sideCabinetId }`, виділення переходить на SC, якщо був виділений SB;
  - `landSink({ toCabinetId })` → `{ …receipt, idMap, sinkHostId }`;
  - усі йдуть через `remember` → `held` → `assertIdle` → `committed`.

## 4. Цикл агрегації

### Порядок handlers
`composition-manager.mjs:_registerDefaultHandlers` (`:809–880`). Агрегатор виконує їх у порядку реєстрації (коментар `:813–815`):
1. `LameUndertop` (`:811–812`): ставить support planes Lame до layout.
2. `RuleOpenSideShelfNeighboursUrbanDuplex` (`:816–817`): підганяє UD OSS до того, як layout їх виміряє.
3. **`CountertopLayout`** (`:827–830`).
4. **`CountertopBooleanCutouts`** (`:832–835`).
5. `SidePanels` (`:837–840`).
6. `TowelBars` (`:842–845`).
7. `SlinkMaterial` (`:846–849`).
8. `HandleStretchForSideShelf` (`:851–855`).
9. `UFBaseboard` (`:858–864`).
10. `LameLegs` (`:866–867`).
11. **`CabinetCoverReconcile`** = `cabinetCoverCompositionAdapter.toAggregationHandler()` (`:872–875`).
12. **`CountertopCollisionRefresh`** (`:876–879`): «Must remain the final project rule» (`:869–870`).

Adapter створюється в `composition-manager.mjs:163–167` («CT-07: one countertop runtime binding for the active composition»). Cover adapter створюється з `countertopAdapter` і `allowFreeLayout: () => preserveCabinetPositions` (`:174–182`).

### `RuleCountertopLayout` (`AC/domain/composition/rules/RuleCountertopLayout.mjs`)
- name `CountertopLayout`, `watchCompositions: ['cabinets']`. watchParams (`:53–57`): Width, Depth, Height, Thickness, sinkType, SidePanel, SpatialOffsetM, ShowUndertop, CountertopPositioning, CountertopPlacement, SupportGroupId, Handle, SidePanelType, SidePanelRequestedType, productType, enabled.
- `applyFn` (`:135–324`):
  1. `resolveBasinTopProduct(allProducts)` (`:140`).
  2. Якщо side panel addon `usesGroupPanels`, викликається `prepareGroupPlan`. **`status !== 'ready'` → warn + early `return` без виклику adapter** (`:143–148`). Інакше `materializeGroupPlan` до вимірювання довжини (`:149–151`).
  3. Відбір тумб: free layout за `SupportGroupId`, legacy-лінія за basin policy (`:152–160`).
  4. 0 тумб → `adapter.resetForComposition(…, 'countertop-layout-empty')`. Немає CT → `'countertop-role-ambiguous'` або `'countertop-entity-missing'` (`:170–226`).
  5. Тумби вимірюються AABB з `cabinetFootprintIgnoreNodes`: мийка під sink mount разом із cutters не входить у footprint, бо інакше offset CT повертався б у стандартний X і мийка «з'їжджала» б від CT (`:184–207`, `:371–379`). Side-shelf має фіксовану ширину 15 legacy-см (`:194`, `countertop-layout-policy.mjs:8,19–23`).
  6. Бокові панелі: з group-плану беруться лише end-панелі (`SidePanelFace !== 'joint'`, `:68–70`) своєї групи. Legacy: продукти `*SidePanel_Left/Right`, при частковому покритті лише суміжні (`:235–254`). X панелі виводиться з тумб, бо правило працює ДО `RuleSidePanels` (`:96–97`).
  7. Горизонталь: `calculateStandardCountertopLayout` (`:262–269`; `countertop-layout-policy.mjs:125–150`).
     - `autoLengthM` = Σ Width (legacy-см / 100) + (n−1)·`CABINET_LAYOUT_GAP_METERS` + **1 см на кожну бокову панель** (`SIDE_PANEL_WIDTH_LEGACY_CM = 1`, `:9`, `:82–96`).
     - `baseXM` = центр групи − intrinsic pivot ± **0.005 м**, якщо панель лише з одного боку (`SINGLE_SIDE_PANEL_OFFSET_M`, `:10`, `:66–73`, `:101–119`).
     - `stretchXM = autoLengthM − 0.6`.
  8. Free layout: `autoLengthM` вимірюється, а не сумується: `groupMaxX − groupMinX + sidePanels·0.01` (`RuleCountertopLayout.mjs:270–274`).
  9. Вертикаль: `CountertopPositioning` (або профіль) + `CountertopPlacement` → `resolveCountertopSupportBase` → локальний Y. Fallback: у free layout з тим самим root береться `binding.basePositionM.y`, інакше поточний local Y (`:276–302`). `support-plane` + unresolved → warn (`:304–310`).
  10. Один виклик `adapter.updateStandardLayout({ composition, compositionId, entities (обрізані до групи при частковому покритті), layout, basePositionM: {x: baseXM, y, z} })` (`:312–323`).

`adapter.updateStandardLayout` (`countertop-composition-adapter.mjs:920–1003`):
- Викликає `resolveCountertopAssembly`.
- Неготовий план → `resetForComposition(…, 'countertop-layout-not-ready')`.
- `_anchorRemoteOffset` перебазовує offset remote-CT ще до `_bind`.
- Змінилась ідентичність (composition / product / root / mesh) → `_bind`. Інакше `rebase` + `invalidateCollisionGeometry('countertop-layout-rebound')`.
- Записує `_binding` = `{ basePositionM, baseLengthM: autoLengthM, sizeM.depth, thicknessM, assembly }`.
- Далі `_syncLength('countertop-layout', { skipDebounce: true })`, планує collision refresh, емітить `change: 'layout'`.

Довжина (`_syncLength`, `:1542–1572`): `resolveCountertopLengthM` (`countertop-layout-policy.mjs:172–177`). Attached дає авто-довжину, moved дає custom або авто. Те саме значення → `NO_OP`. Інакше `geometry.setLengthM(length, { booleanOptions })`. Debounce за замовчуванням зливає CSG-перебудови під час drag-ресайзу; layout передає `debounceMs: 0` (`:1560–1563`). Після завершення: `change: 'length-settled'`.

### `RuleCountertopBooleanCutouts` (`RuleCountertopBooleanCutouts.mjs`)
- name `CountertopBooleanCutouts`, `watchCompositions: ['cabinets']`. watchParams: Width, Depth, Height, ShowUndertop, sinkType, Thickness, SpatialOffsetM, SupportGroupId, `CountertopSinkType` (`:21–27`).
- `applyFn` (`:60–…`):
  1. Basin top, mesh `TopSolid`. Обов'язковий `script.meshBoolean`, без нього error + return (`:64–82`).
  2. Тумби у free layout фільтруються за групою, `syncHierarchy` (`:84–89`).
  3. `_resolveSinks` → `_findSinkCutters`: беруться лише `BoolB_*` **під sink anchor-ом**; сторонні `BoolB` (наприклад `Class_Top_Drawer_BoolB`) ігноруються. MeshBoolean вимикає cutter після різу, тому disabled `BoolB_*` теж рахується (тіло `:183–220`).
  4. `_syncVesselCutouts`: клон шаблону `Vessel_BoolCut` на кожну vessel-мийку, `Vessel_BoolCut_Clone_<i>` / `…_Countertop`; шаблон вимикається, зайві клони прибираються (`:264–320`).
  5. Немає cutters → `updateBooleanCutouts([], 'countertop-cutters-cleared')` (`:103–113`).
  6. Неготові cutters (без meshInstances) → **`SceneTransformHelper.waitForFrames(1)`**, повторне виявлення. Vessel-клони при цьому не перестворюються (`:118–129`).
  7. 0 валідних → `'countertop-cutters-unready'` (`:131–140`).
  8. `_updateResolvedCutters` → `adapter.updateBooleanCutouts({ …, validCutters, forceRebuild: true, reason })`. Fallback без adapter: `meshBoolean.cutters` + `requestBoolean` напряму (`:352–374`).
- `adapter.updateBooleanCutouts` (`countertop-composition-adapter.mjs:1026–1110`):
  - Не прив'язаний → `CANCELLED 'countertop-assembly-unbound'`.
  - Повторний resolve assembly, `rebase`.
  - `meshBoolean.cutters = cutters`. Сигнатура відносних трансформ cutters (`createRelativeCutterSignature` `:97–125`) не змінилась і немає `forceRebuild` → без rebuild.
  - Якщо йде `_lengthOperation`, rebuild бере на себе resize.
  - Інакше `meshBoolean.requestBoolean({ reason, skipWhenNoActiveCutters: false })`.
  - Помилки: `COUNTERTOP_MESH_BOOLEAN_MISSING`, `COUNTERTOP_BOOLEAN_REQUEST_FAILED`.

### `RuleCountertopCollisionRefresh` (`RuleCountertopCollisionRefresh.mjs`)
- `watchCompositions: ['cabinets', 'addons', 'countertops']`. watchParams = `COUNTERTOP_COLLISION_GEOMETRY_PARAMS` (`:3–25`), серед них `CountertopLengthM`, `SpatialOffsetM`, `Handle`, `SidePanel*`, `sinkType`, `Boolean/cutters/mesh/model`.
- `applyFn` → `spatial.requestRefresh('composition-structure-settled' | 'composition-geometry-settled')` (`:68–79`).
- `releaseSpatialSettleWhenIdle`: не можна await-ити з handler-а, що зараз виконується, бо буде deadlock черги (`:34–46`).
- `isCountertopCollisionGeometryChange` використовує `_invalidateSpatial` у composition-manager (`:729–730`).

### Cover (кавер)
- `CabinetCoverReconcile` handler (`cover-composition-adapter.mjs:827–844`): `acceptFn` → `acceptSourceChange`; `applyFn` → `runReservation(accepted)` або `requestReconcile(reason 'aggregation-without-reservation')`.
- Налаштування: збережені, інакше `defaultSettingsFor(composition)` (`:337`). Дозволені поля: enabled, profileId, eligibilityMode, materialId, thicknessM, tolerances (`:14`). `eligibilityMode` ∈ `'all'` \| `'sc-with-adjacent-open'` (`:61–62`).
- Вибір джерел (`:373–416`):
  - `profileId` ≠ підтримуваного → `unsupported-cover-profile`;
  - `isLineOnlyType` пропускається;
  - не `isCoverSource(type, { freeLayout: allowFreeLayout() })` → діагностика **`unsupported-cover-profile-source`**, і план відхиляється.
- Інші діагностики: `missing-cover-composition`, `invalid-ulh-source`, `ambiguous-basin-top` / `missing-basin-top`, `missing-basin-top-geometry` / `unsupported-basin-top-geometry`, `cover-geometry-barrier-failed`, `cover-input-extraction-failed`, `inactive-cover-composition`, `cover-revision-reservation-rejected` (`:376–599`). Support-adapter додає: `invalid-ulh-support-plane`, `missing-ulh-cabinet-color`, `missing-ulh-support-capability`, `unknown-ulh-eligibility`, `missing-ulh-structural-support`, `unsupported-ulh-orientation`, `invalid-ulh-measurement` (`cover-support-adapter.mjs:126–247`).
- Restore (`composition-manager.mjs:~1879–1891`): після `aggregator.recalculateAll` спершу `countertopCompositionAdapter.whenSettled()`; статус ∈ error/invalid/unsupported/cancelled → `COUNTERTOP_RESTORE_FAILED`. Потім `cabinetCoverCompositionAdapter.whenSettled()` → **`CABINET_COVER_RESTORE_FAILED`** (`{ result: coverResult }`).
- `cabinet-local-runtime.mjs:812–830` перетворює `result.diagnostics` на `error.reasons`, код лишається. Перевірка наперед: `:979`.
- Довжина або поза CT змінились → adapter викликає `_notifyCoverSourceChanged(patch)` (`:1522`, виклики `:506`, `:563`).
- Manifest: HR-CV-01..03 (`docs/rules-manifest.md:71–80`).

## 5. Публічний API

`window.ConfiguratorAPI.countertop` = `CountertopPlugin.api`, frozen (`AC/bridge/plugins/countertop.plugin.mjs:82–122`). Це фасад над `app.compositionManager.countertopCompositionAdapter` (`:160–162`). Одиниці: метри, world XY; offset рахується від стандартної пози (`:1–5`). Немає adapter → `COUNTERTOP_NOT_READY` (`:164–169`). Після `destroy` → `COUNTERTOP_DESTROYED` (`:207–209`).

### Методи
| Метод | Аргументи / валідація фасаду | Adapter | Результат | Помилки |
|---|---|---|---|---|
| `contract` | — | — | `COUNTERTOP_PUBLIC_CONTRACT_V1` (`version: 1` + enum-и, `countertop-contract.mjs:49–57`) | — |
| `getState()` | — | `getState()` | state або `WAITING_STATE = { unit:'m', readiness:'waiting', productId:null }` (`:65`, `:128–130`) | — |
| `isDragEnabled()` | — | `dragEnabled` | boolean | — |
| `setDragEnabled(bool)` | boolean | `setDragEnabled` (`adapter:435–440`): при `true` викликає `composition.assertMutable()` | результат `spatial.setDragEnabled` | INVALID_INPUT, `LEGACY_WRITERS_BUSY` |
| `setOffset({x,y}, opts?)` async | лише ключі x, y, скінченні; `opts = { validation: 'guard'\|'skip' }` (`:52–63`) | `setOffsetM(offset, { constraint:'respect', validation })` (`adapter:453–475`) | state | INVALID_INPUT, `COUNTERTOP_VERTICAL_LOCKED` (y > max(1 см, поточний y)), `COUNTERTOP_POSE_INVALID` (`{ reasons, rejected:{offset,length} }`, спершу revert), `LEGACY_WRITERS_BUSY` |
| `resetOffset()` async | — | `setOffsetM({0,0}, { constraint:'bypass' })` (`:477–479`) | state | як setOffset |
| `setVerticalLocked(bool)` | boolean | `:445–450`: режим тримається між rebind-ами | state, `change: 'vertical-lock'` | INVALID_INPUT |
| `setSize({ length })` async | лише `length`: число > 0 або `null` | `setLengthM` (`:485–510`): clamp до limits, пише `CountertopLengthM` | state, `change: 'length'` | INVALID_INPUT, **`COUNTERTOP_ATTACHED`** (число при attached) |
| `resizeFrom(side, lengthM, opts?)` async | валідацію робить adapter | `resizeFromM` (`:514–588`): `'left'` = −X, `'right'` = +X; протилежний торець стоїть; clamp до `resizeBoundsM[side]`; центр зсувається на Δ/2; attached CT теж (HR-CT-04), зсув на 2e-6 м, щоб не re-attach; одна snapshot-запис (offset + length + sink shift); collision не блокує | state, `change: 'length'` | INVALID_INPUT, POSE_INVALID (з повним revert), `LEGACY_WRITERS_BUSY` |
| `setLengthLimits({minM,maxM}\|null)` | `normalizeCountertopLengthLimits`; помилка → INVALID_INPUT; зберігається у фасаді й переноситься на новий adapter (`:182–185`) | `setLengthLimitsM` (`:591–599`) | state, `change: 'length-limits'` | INVALID_INPUT |
| `whenSettled()` async | — | `whenSettled()` (`:1011–1018`): geometry → pose → cover → refresh → `spatial.handle.whenSettled` | state | — |
| `on(event, cb, { emitCurrent })` | event ∈ `'change'`, `'action'` | `adapter.on` (rebind при зміні adapter-а `:172–190`) | unsubscribe fn; `emitCurrent` одразу шле `{ reason:'current', state }` (`:132–142`) | INVALID_INPUT, DESTROYED |
| `off(event, cb?)` | без cb знімає всі на event | — | — | — |

- Фасад привʼязує до adapter-а `setDragGuard(overlay.dragGuard)` і `setPoseValidator(overlay.dragGuard.evaluate)` (`:175–180`).
- **`previewLength` і `lengthAtPointer` є не в `ConfiguratorAPI.countertop`, а в `ConfiguratorAPI.countertopOverlay`** (= `overlayApi`, `:123–125`; `countertop-drag-overlay.mjs:33–34`, `:336–339`, `:410–419`). Деталі в агента D&D.
- `adapter.emitEditSizeAction()` (`:895–901`) емітить `action { type:'edit-size', state }` лише при `canResize && selected`.

### `getState()`: повна форма (`countertop-composition-adapter.mjs:332–376`)
```
{ unit:'m',
  readiness: 'waiting'|'ready',          // ready = binding && productId && !legacySuspended && !legacyRetired
  compositionId, productId, selected,
  moved, moving, dragging, dragEnabled,
  placementState: 'waiting'|'attached'|'moved',
  motionState: 'idle'|'moving',
  interactionState: 'idle'|'selected'|'dragging',
  attached,                              // |offset.x|,|offset.y| <= 1e-6
  canResize,                             // ready && !attached
  offset: { x, y },
  size: { length /* _appliedLengthM */, depth },
  autoLength /* binding.baseLengthM */, customLength /* null при attached */, thickness /* м, з mesh */,
  lengthLimitsM: { minLengthM, maxLengthM, requestedMinM, requestedMaxM, basinMinLengthM },
  resizeBoundsM /* null коли не ready */,
  collision: { status, collidesWith[] } /* 'unknown' коли не ready */,
  traps: [...],
  sink: { owner: 'cabinet'|'countertop'|null, shiftM, landing, pending: {cabinetId, fromCabinetId, status}|null, hosted },
  verticalLocked, verticalLockViolated /* locked && offset.y > 0.01 */,
  validation: { status: 'valid'|'invalid'|'unknown', reasons[], warnings[] } }
```
- `landing` = `{ status: 'none'|'home'|'fits'|'gap'|'unfit', cabinetId, fromCabinetId, reason, snapDxM }`, за замовчуванням `SINK_LANDING_NONE` (`adapter:49`, `countertop.plugin.mjs:19–28`).
- `'none'` + `reason: 'DETACHED'` означає, що мийка поруч із рядом, і це валідна поза.
- Опускання CT на `gap`/`unfit` невалідне (validation reasons `SINK_LANDING_GAP` / `SINK_LANDING_UNFIT`, CT повертається назад).
- `'fits'` → мийка лишається на CT, `pending` чекає `cabinets.moveSink`. `'home'` з `cabinetId: null` adapter вирішує сам (snap на `snapDxM`).
- `sink.hosted: true` (HR-CT-02) → owner `'countertop'` на будь-якій висоті, `fromCabinetId` null, `'home'` не буває.
- `validation` для attached завжди `valid`. Мемоізація за ключем `generation|offset|length|owner|pendingCabinet` (`:384–400`).

### Події
- `change` → `{ reason, state }` (форма з `countertop.plugin.mjs:140`; тіло `_emitChange` `adapter:1624` не читали).
- `action`: adapter передає як є (`countertop.plugin.mjs:32–36`, `adapter:150–151`):
  - `{ type:'edit-size', state }`;
  - `{ type:'sink-landing', landing }` після release на `'fits'` (hosted: `fromCabinetId: null` → UI викликає `cabinets.landSink({ toCabinetId })`, інакше `cabinets.moveSink`);
  - `{ type:'sink-lift', fromCabinetId, sinkLocalM:{x,y,z} }` один раз на підйом CT з мийкою одного SB (drag-end / setOffset) → UI викликає `cabinets.liftSink`.

### Коди помилок
- `COUNTERTOP_ERROR_CODE` (`countertop-contract.mjs:40–47`): `COUNTERTOP_NOT_READY`, `COUNTERTOP_INVALID_INPUT`, `COUNTERTOP_ATTACHED`, `COUNTERTOP_DESTROYED`, `COUNTERTOP_VERTICAL_LOCKED`, `COUNTERTOP_POSE_INVALID`.
- Поза enum:
  - `LEGACY_WRITERS_BUSY` (adapter `:436`, `:454`, `:486`, `:515`);
  - `COUNTERTOP_MESH_BOOLEAN_MISSING`, `COUNTERTOP_BOOLEAN_REQUEST_FAILED` (`:1068`, `:1099`);
  - `COUNTERTOP_RESTORE_FAILED`, `CABINET_COVER_RESTORE_FAILED` (`composition-manager.mjs:~1882`, `~1889`);
  - помилки `composition.assertMutable()`.

### Change reasons
- `COUNTERTOP_CHANGE_REASON` (`countertop-contract.mjs:25–38`): `current`, `selection`, `reset`, `layout`, `restored`, `offset`, `length`, `length-settled`, `length-limits`, `validation`, `vertical-lock`, `sink-landing`.
- Підтверджені місця емісії: `selection` (adapter `:192`), `layout` (`:1001`), `length` (`:509`, `:587`), `length-settled` (`:1565`), `length-limits` (`:597`), `vertical-lock` (`:448`), `current` (фасад `:140`).
- Також `_spatial.onChange(reason)` → `_emitChange(reason)` передає reasons spatial як є: `drag-start`, `drag`, `drag-end` тощо (`adapter:166–178`).

## 6. Інваріанти і пастки, видимі в коді

- **Один sink host на anchor, одне місце пошуку.** Мийки беруться лише з `resolveCountertopAssembly().sinks`, і власного пошуку ніде немає (`countertop-assembly-resolver.mjs:5–9`, `:17–28`). Перемикання на `host.kind` є лише в `_placeSinks` і `_sinkLanding` (`adapter:152–154`, `:1283–1300`, `:687–700`).
- **«The sink never leaves the top»**: у спокої мийка стоїть у sink point своєї тумби. Підняла CT (>1 см) несе її, і це записується в `CountertopSinkShiftM`. Додому мийка повертається лише точно «вдома»; `'home'` або `'fits'` pending пересувають усю CT на release (`adapter:134–137`). Hosted-мийка є дитиною CT і ніколи не pinned (`:1290–1291`).
- **API-запис не лишає спокійну CT з pending `'home'`** (`setOffsetM` → `_snapHome`, `:472–473`).
- **Порядок handlers важливий.** LameUndertop і UD OSS ідуть до CountertopLayout. CountertopLayout іде ДО SidePanels (X панелі виводиться з тумб, `RuleCountertopLayout.mjs:96–97`). CollisionRefresh стоїть останнім (`composition-manager.mjs:869–870`).
- **Early return у `RuleCountertopLayout`**, коли side-panel group plan unresolved (`:145–148`). У цьому випадку adapter не викликається взагалі: ні reset, ні layout, тож CT лишається в попередній позі.
- **`waitForFrames(1)`** у Boolean-правилі для щойно склонованих `BoolB_*` без meshInstances (`RuleCountertopBooleanCutouts.mjs:118–129`).
- **CSG підміняє mesh `TopSolid`.** MeshBoolean вимикає cutters після різу, тому пошук бере і disabled `BoolB_*`. На drag спокійної CT викликається `meshBoolean.restoreSourceMesh('countertop-drag')` (CT тягнуть без отвору), а на drag-end `forceRebuild` (`adapter:168–176`). Перебудова лише при зміні сигнатури відносних трансформ cutters (`:1074–1088`).
- **AABB тумби без мийки й cutters** (`cabinetFootprintIgnoreNodes`). Інакше offset CT потрапляв би в стандартний X і довжину, і CT з мийкою роз'їжджались (`RuleCountertopLayout.mjs:371–379`).
- **Attached означає довжину композиції завжди.** Повернення на стандартну позу скидає custom-довжину (`countertop-layout-policy.mjs:166–177`). Тому `resizeFromM` не допускає точного 0 і зсуває на 2·1e-6 (`adapter:539–541`).
- **Remote (free layout)**: при detach поточна довжина фіксується в `CountertopLengthM`. Якщо стандартна база зсунулась, offset перераховується, щоб world-поза не змінилась (`adapter:139–144`, `:958–969`).
- **Неоднозначна роль** (кілька `basinTop`) → `resetForComposition('countertop-role-ambiguous')`. CT не обирається за порядком (`RuleCountertopLayout.mjs:213–225`, `countertop-role.mjs:29`).
- **OSS (`UD-open-shelves-side`)** має бути в `lineTypes`. Без нього cover-план відхиляв усю композицію (`unsupported-cover-profile-source`) (`countertop-collections.mjs:37–42`). Для UF open shelves так само: без них лінія втрачала policy (`:51–53`).
- **Не await-ити `releaseSpatialSettleWhenIdle` з handler-а, що зараз виконується**, бо буде deadlock (`RuleCountertopCollisionRefresh.mjs:34–38`).

## 7. Не перевірено / суперечності

- **`CountertopPositioning` у коді означає `'legacy' | 'support-plane'`** (вертикальна стратегія, `countertop-support-resolver.mjs:8–11`, `README.md:26`), а не standard/offset/remote. Як кодуються режими standard/offset/remote, тут не розбирали; це частина агента позиціонування (`docs/features/counttop/relocation and remote positions/*`, `_anchorRemoteOffset` `adapter:1476`).
- Ролі «primary» у коді немає, є `basinTop` / `cabinetCover` / `unknown`.
- `previewLength` і `lengthAtPointer` живуть на `countertopOverlay`, не на `countertop`. Публічного `setLengthM` немає: є `setSize({ length })`.
- У заголовку плагіна `setSize` описано як «only while moved off» (`countertop.plugin.mjs:12–13`), а `resizeFrom` працює і на attached (HR-CT-04, `adapter:525–526`). Тобто CT у стані attached + custom length після `resizeFrom` отримує offset 2e-6 і формально є `moved`.
- Одиниці Thickness змішані: `Top_Solid.defaultConfig.Thickness = 0.375` (дюйми), fallback у composition-manager `0.5`, а `thicknessM` кавера `0.0128 м` («Top_Solid slab thickness», `countertop-collections.mjs:142`) не дорівнює ні 0.375″ (0.0095 м), ні 0.5″ (0.0127 м).
- Не відкривали: тіло `_emitChange`/`_emit` (`adapter:1614–1637`), а отже точну форму payload `change`. Звідки емітяться `reset`, `restored`, `offset`, `validation`, `sink-landing`, не перевірено (є в enum, місце емісії не знайдено). Reasons зі spatial (`drag-start`, `drag`, `drag-end`) не входять до enum контракту.
- Не відкривали: `countertop-geometry-adapter.mjs` (величина debounce за замовчуванням), `countertop-length-limits.mjs`, `countertop-resize-bounds.mjs`, `countertop-resize-snap.mjs` (значення взято з JSDoc і manifest), `cover-policy.mjs` / `cover-service.mjs` / `cover-reconcile-plan.mjs` (алгоритм групування каверів), `side-panel-group-measurement.mjs` (`cabinetFootprintIgnoreNodes`).
- `anchorName` для `ULH-Open-Shelf`, `UD-open-shelves(-side)` і `UF-open-shelves(-side)` у перших 4 рядках `countertopSupport` не знайшовся; можливо, там лише `fallbackMeshNames`.
- Рядки `composition-manager.mjs:~496–540` (автостворення Top_Solid) і `~1879–1891` (restore) взято з виводу `sed` і можуть зміститися на ±2.
- HR-CT-08 (remote: CT на винесених SC, не на OS) за manifest має стан ❌, HR-CT-09 (рух мийки по CT) відкладено на фазу 2 (`docs/rules-manifest.md:68–69`).
