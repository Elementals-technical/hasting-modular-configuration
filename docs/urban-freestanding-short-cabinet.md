# Urban Freestanding: 1DW Floor-Mount Short Cabinet

Запис станом на 2026-10-15, гілка `feature/urban-duplex`. Описує, як коротку підлогову тумбу
(«New 1DW Floor-Mount Short Cabinet», docx P1097/P1110/P1112) додано в UI як стиль Side Cabinet.

## Джерела

- `data-modular-configuration/_shared/vz-modular-current-phase/_Urban Standard Height Logic (25_07) (2).docx`,
  розділ Urban Freestanding: P1097 (модель), P1102 (Cabinet Type → Cabinet Style), P1108–P1113 (впритул,
  «wrinkle», власна нижча стільниця «same logic as here» → P0861), P1125 (бокові панелі двох висот).
- Рішення команди 2026-10-15: коротка буває лише Side Cabinet (короткої Sink Base з умивальником немає); ширини, глибини й handles — як у
  2DW; висота з цоколем 56 (UG, CG) і 53 (PTO), корпус 53/50; SKU і ціна — як у 2DW, з `1DW` і своєю висотою.
- RenderAdmin datatable 590 (`matrix-cabinet-UFS`): 1DW записано в `drawer_configs` і `forced_height_cm`.
- Сцена v60 (`public/HastingCabinetsParametrization/js/esm.mjs`, `ufCabinetHeightPolicy`): будь-яка висота
  < 60 см — коротка тумба; корпус береться з handle (UG/CG 53, PTO 50), тому сцені однаково, чи прийде 56/53
  з цоколем, чи 53/50 без нього. Ряд UF тримає високі одним блоком (`UF_HEIGHT_RUN_VIOLATION`).

## Шлях даних колекції

```text
RenderAdmin datatable 590 (matrix-cabinet-UFS) ──┐   фікстура: src/entities/collection/__tests__/
RenderAdmin datatable 591 (matrix-coutnertop-UFS) │   fixtures/remote/datatable-590.json
RenderAdmin configurator 11 (кольори)            │
public/collections/urban-freestanding/*.json ────┘
   └─ loadResolvedCollection → buildCabinetCatalogFromMatrix (+ withSteppedModules) → cabinetCatalog у Redux
        → CabinetBuilderPage (Cabinet Type / Cabinet Style) + RightCabinetStyleSidebar (Width/Depth/Handle, «+»)
        → composition.addCabinet → createCompositionPort (runtime-bindings productTypes, Drawers map)
        → sceneBridge (withSteppedSceneHeight) → ConfiguratorAPI.addProduct / setProductByParams / setConfigBatch
```

## Рішення: стиль «1 Drawer Short», не окремий Cabinet Type

1. Сцена малює коротку тумбу тим самим `UF-side-cabinet`. Окремий CabinetType мав би той
   самий scene type, і `resolveCabinetTypeOfSceneId` прочитав би поставлену тумбу назад як 2DW.
2. Стиль шафи вже зберігається per-cabinet (`placedCabinetStyles`), а `Drawers` іде в сцену (`Drawers: "1D"`).
3. Ширини, глибини й handle — ті самі, що у 2DW; відрізняється лише висота.

## Як це працює

| Шар | Що робить |
|---|---|
| Таблиця 590 | `drawer_configs: 2DW\|1DW`, `forced_height_cm` += `UG/1DW:56\|PTO/1DW:53\|CG/1DW:56` лише для Sink-Cabinet (Side Cabinet). `heights_cm` / `supports_height` — висоти композиції, лишаються 88/91. |
| Каталог (`matrixCabinet.withSteppedModules`) | Стиль з `ruleData.steppedModules` позначається `steppedDrawers`, а його висоти з таблиці переносяться з `forcedHeightByHandle` у `steppedHeightByHandle`: форсована висота — це висота всієї композиції, і вибір короткої тумби чи handle не має її змінювати. |
| `product-profile.json` | Правило, не розміри: опція `Drawers` "1" («1 Drawer Short», aliases 1D/1DW); `steppedModules` для Sink-Cabinet (`placement: composition-end`, `requiresPlacedCategory: drawer-cabinet`); повідомлення `drawers.steppedNeedsTallCabinet`. |
| `runtime-bindings.json` | Лише переклад: `Drawers` "1" → `{ Drawers: "1D" }`, `Handle` як є. Висот тут немає. |
| `buildSteppedSceneProducts` (`entities/product/lib`) | З каталогу й bindings складає для мосту сцени короткі продукти: `UF-side-cabinet`, `{ Drawers: "1D" }`, висота за handle з таблиці. `CollectionStateBridge` передає їх у `setSteppedSceneProducts`. |
| Сцена (`sceneBridge`, `setConfigBatch`, `steppedSceneProducts.ts`) | Коротка тумба ставиться зі своєю висотою (add / insert / preset), а після кожної команди з `Height` або `Handle` міст повертає їй власну висоту: сцена розсилає `Height` усім продуктам (`SHARED_PARAMS`). |
| Cabinet Builder | Картка «1 Drawer Short» недоступна, доки немає поставленої високої drawer-шафи. «+» для короткої — лише на краях композиції (режим сцени `Side-Shelf`); висока шафа, додана через зовнішній «+» короткої, стає з внутрішнього боку (`resolveSteppedEndPlacement`). |
| `sku-profile.json` | `Drawers` "1" → `1DW`: `VAN-URFS-SC/1DW/<handle>/<fluting>-<W>-<H>-<D>-CAB-…`, висота з цоколем у дюймах (56 см → 22H, 53 см → 20.9H). Ціну дає бекенд за SKU (`/pricing-v2/resolve`). |
| Summary / pricing | Коротка тумба — звичайний рядок з висотою й ціною. Бокова панель біля короткої тумби не ціниться (gap `sidePanel`, P1125/UFS-SP-01); інші — за висотою першої високої шафи. |

## Відомі обмеження

- Під час команди з `Height` сцена на мить ставить коротку тумбу на висоту композиції, потім міст повертає
  її висоту. Правильне місце — правило сцени (не розсилати `Height` коротким продуктам).
- Після зміни таблиці 590 в RenderAdmin перезняти фікстуру `datatable-590.json`, щоб тести бачили ті самі дані.
- Обмеження максимальної довжини стільниці рахує й ширину коротких тумб, хоча верхня стільниця над ними не
  лежить. Лишено консервативним до відповіді на UFS-TOP-01.
- Кришка короткої тумби (`Cabinet_Cover`) не з'являється на глибині 46 см: сцена малює UF лише на 45/50.
- Чи є ціни для SKU `1DW` у бекенді, перевіряється лише в браузері (з робочого середовища бекенд недоступний).

## Відкриті питання до клієнта

1. **Нижня стільниця (UFS-TOP-01, P1113 → P0861).** Матеріал/колір за замовчуванням, товщина, SKU і ціна.
2. **Бокові панелі (UFS-SP-01, P1125).** Висота й SKU нижньої панелі біля короткої тумби.
3. **OSS поруч (UFS-CMP-02 / Q31).** Чи можуть коротка тумба й Open Side Shelf ділити один край і хто крайній.
4. **Towel bar біля короткої тумби (Q27)** і **розділювачі шухляд 1DW** — розміри й SKU.
