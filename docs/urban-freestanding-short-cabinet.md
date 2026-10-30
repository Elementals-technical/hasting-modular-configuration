# Urban Freestanding: 1DW Floor-Mount Short Cabinet

Запис станом на 2026-10-16, гілка `phase2/ui-fixes`. Описує, як коротку підлогову тумбу
(«New 1DW Floor-Mount Short Cabinet», docx P1097/P1110/P1112) показано в UI як окремий Cabinet Type
`Short-Cabinet` («Floor-Mount Short Cabinet», стиль «1 Drawer»). До 2026-10-16 вона була стилем
«1 Drawer Short» у Side Cabinet (коміт 81a0f733).

## Джерела

- `data-modular-configuration/_shared/vz-modular-current-phase/_Urban Standard Height Logic (25_07) (2).docx`,
  розділ Urban Freestanding: P1097 (модель), P1102 (Cabinet Type → Cabinet Style), P1108–P1113 (впритул,
  «wrinkle», власна нижча стільниця «same logic as here» → P0861), P1125 (бокові панелі двох висот).
- Рішення команди 2026-10-15: короткої Sink Base з умивальником немає; ширини, глибини й handles — як у
  Side Cabinet; висота з цоколем 56 (UG, CG) і 53 (PTO), корпус 53/50; SKU — як у Side Cabinet, з `1DW` і своєю висотою.
- Рішення 2026-10-16: окремий продукт у конструкторі; UFS змішує 1- і 2-шухлядні продукти лише тоді,
  коли 1-шухлядний — це Short Cabinet.
- RenderAdmin datatable 590 (`matrix-cabinet-UFS`): рядок `Short-Cabinet` (1DW, `heights_cm` 53|56,
  `forced_height_cm` `UG/1DW:56|PTO/1DW:53|CG/1DW:56`); Sink-Base і Sink-Cabinet — лише 2DW. Джерело
  завантаження — `public/collections/urban-freestanding/matrix-cabinet-urban-freestanding.csv`.
- Сцена v60+ (`public/HastingCabinetsParametrization/js/esm.mjs`, `ufCabinetHeightPolicy`): будь-яка висота
  < 60 см — коротка тумба; корпус береться з handle (UG/CG 53, PTO 50). Окремого продукту немає: це
  `UF-side-cabinet`. Ряд UF тримає високі одним блоком: сцена ховає «+», який би їх розірвав
  (`applyUFPlusRule`), і відмовляє у вставці чи обміні (`UF_HEIGHT_RUN_VIOLATION`). Висоту композиції
  коротким тумбам сцена не розсилає (`configForShortUFCabinet`), а `Handle` — розсилає.

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

## Як окремий тип ділить продукт сцени з Side Cabinet

`Sink-Cabinet` і `Short-Cabinet` обидва ставляться як `UF-side-cabinet`. Тип поставленої тумби
читається з її runtime id (`resolveCabinetTypeOfSceneId` / `findPlacedCabinetRule`), тож без підказки
коротка прочиталася б як Side Cabinet. Підказка — стиль шафи (`placedCabinetStyles`, пишеться одразу при
add / preset / adopt / history restore): з типів, що ділять продукт сцени, перемагає той, чий
stepped-стиль має шафа. Без стилю лишається Side Cabinet (він іде першим).

## Як це працює

| Шар | Що робить |
|---|---|
| Таблиця 590 | Окремий рядок `Short-Cabinet`: 1DW, власні висоти 53/56, ширини й handles як у Side Cabinet. |
| Каталог (`matrixCabinet.withSteppedModules`) | Стиль з `ruleData.steppedModules` позначається `steppedDrawers`, його висоти переносяться з `forcedHeightByHandle` у `steppedHeightByHandle`. Тип, усі стилі якого stepped, бере `heights`, `supportsHeight` і форсовану висоту кожного handle (UG 91 / PTO 88 / CG 91) у першого типу категорії `requiresPlacedCategory` (Sink-Base): вибір короткої картки не опускає високі тумби. |
| `product-profile.json` | Опція `CabinetType` `Short-Cabinet` («Floor-Mount Short Cabinet», order 50 — остання картка, `drawer-cabinet`); `steppedModules` `{ cabinetType: "Short-Cabinet", drawers: "1", placement: composition-end, requiresPlacedCategory: drawer-cabinet }`; `drawerStyleGroups` лишаються `[["1"],["2"]]`. |
| `runtime-bindings.json` | `productTypes["Short-Cabinet"] = "UF-side-cabinet"`; `Drawers` "1" → `{ Drawers: "1D" }`. |
| `buildSteppedSceneProducts` | Короткі продукти для мосту сцени: `UF-side-cabinet`, `{ Drawers: "1D" }`, висота за handle з таблиці. |
| Сцена (`sceneBridge`, `setConfigBatch`, `steppedSceneProducts.ts`) | Коротка тумба ставиться зі своєю висотою (add / insert / preset); після команди з `Handle` міст повертає їй висоту за новим handle (56 ↔ 53), бо сцена `Handle` розсилає, а збережена висота йде в підпис і SKU. |
| Cabinet Builder | Стиль «1 Drawer» короткої тумби недоступний, доки немає поставленої високої drawer-шафи. Він не обмежується `drawerStyleGroups`, а поставлені короткі тумби не входять у стилі композиції — без модалки «Update Design?». Місце на краю тримає сцена; Move Left / Right перестрибує блок високих (`resolveMoveSwaps`). |
| `sku-profile.json` | `CabinetType` `Short-Cabinet` → `SC`, `Drawers` "1" → `1DW`: `VAN-URFS-SC/1DW/<handle>/<fluting>-<W>-<H>-<D>-CAB-…`, висота з цоколем у дюймах (56 см → 22H, 53 см → 20.9H). |
| Summary / pricing | Коротка тумба — звичайний рядок. Бокова панель біля неї не ціниться (gap `sidePanel`, P1125/UFS-SP-01) і в Summary не показується: рядок `sidePanel` називає замовлені краї (`sides`), і Summary показує панель лише для них. Панелі описуються за першою високою шафою (обидві сторінки Summary). |

## Відомі обмеження

- Цін для `VAN-URFS-SC/1DW/…` немає: `/pricing-v2/resolve` відповідає «No best match» (перевірено
  2026-10-16 для всіх ширин, висот 56/53 і глибин 50/46). Рядок показується з відсутньою ціною.
- Картка типу `Short-Cabinet` доступна й на порожній сцені; недоступний лише її стиль, доки не стоїть висока шафа.
- Після зміни таблиці 590 в RenderAdmin перезняти фікстуру `datatable-590.json`, щоб тести бачили ті самі дані.
- Обмеження максимальної довжини стільниці рахує й ширину коротких тумб, хоча верхня стільниця над ними не
  лежить. Лишено консервативним до відповіді на UFS-TOP-01.

## Відкриті питання до клієнта

1. **Нижня стільниця (UFS-TOP-01, P1113 → P0861).** Матеріал/колір за замовчуванням, товщина, SKU і ціна.
2. **Бокові панелі (UFS-SP-01, P1125).** Висота й SKU нижньої панелі біля короткої тумби.
3. **OSS поруч (UFS-CMP-02 / Q31).** Чи можуть коротка тумба й Open Side Shelf ділити один край і хто крайній.
4. **Towel bar біля короткої тумби (Q27)** і **розділювачі шухляд 1DW** — розміри й SKU.
5. **Ціни 1DW** (UFS-SIZ-01) — рядки в прайсі.
