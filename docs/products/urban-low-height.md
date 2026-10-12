# Urban Low Height (ULH)

## Ідентичність і точка входу

- `collectionId`: `urban-low-height`
- Live: <https://hasting-modular-phase-2-p98qb.ondigitalocean.app/prebuilt/model?collectionId=urban-low-height>
- Package: `public/collections/urban-low-height/`
- Registry entry: `public/collections/registry.json`
- Default collection: ні; без query parameter відкривається USH.

ULH — окрема колекція, а не mode USH. Вона ділить з USH remote configurator 4, але має власні UI,
product profile, SKU profile, countertop table 589, cabinet table 580, presets та runtime bindings.

## Що завантажується

```text
manifest.json
  local: presets.json, ui.json, product-profile.json, sku-profile.json, runtime-bindings.json
  remote: configurator 4, countertop table 589, cabinet table 580
```

Manifest `defaults` порожній. Початкові values походять з preset або з `defaults` у
`product-profile.json`, тому додавання manifest default повинно бути явним product-рішенням.

Prebuilt переносить поточні countertop color і basin з моделі в модель, тож profile default визначає
колір, з яким відкривається prebuilt-модель: це білий Fenix `Bianco Male TFA`. `CountertopColor` і
`sinkType` у `defaults` мусять бути парою, яку дозволяють rules: Porcelain basin виключений на
Fenix-стільниці, а store, що стартує лише з `defaults`, ніхто не узгоджує. Тому `sinkType` — Fenix
Prisma 50 (`Top_HPL/Fenix_Prisma_Gres`): типовий sink base у Create Your Own має 60 см, а Fenix Cover 50
вимагає sink base від 70 см. Змінюючи `CountertopColor` у `defaults`, перевіряйте й `sinkType`.

## UI та моделі

Prebuilt і custom мають по чотири кроки:

- Prebuilt: Model → Color → Countertop & Basin → Summary.
- Custom: Cabinet Builder → Color → Countertop & Basin → Summary.

`presets.json` містить 59 model cards. 53 мають `presetProducts`; 6 Multi-Level моделей навмисно
порожні, бо сцена ще не вміє розкладати нижній рівень. Production-перевірка 2026-09-28 показала всі
59 карток і ті самі чотири кроки.

## Countertop Drag & Drop

Countertop Drag & Drop (Position ▸ Drag & Drop у меню вибраної стільниці) є в ULH, однаково в Prebuilt
і в Create Your Own. Перший вхід у браузерній сесії відкриває модалку «Customize Your Countertop Layout»:
Continue входить у Drag & Drop і позначає intro як побачене (ключ `countertop-layout-intro:seen` у
`sessionStorage`), X і backdrop закривають модалку без входу й без позначки, тож наступний вхід покаже її
знову. Якщо `sessionStorage` заблокований, модалка показується при кожному вході, а Continue все одно
входить. Слайди перелічені в `CountertopLayoutIntroModal.tsx`; крапки з'являються, коли слайдів більше
одного. Gate живе в `CountertopDragMode.enter` (`src/features/countertopPlacement/ui/`).

## Cabinet catalog

Table 580 описує:

| Semantic type | Widths, cm | Heights, cm | Depths, cm | Scene product |
|---|---|---|---|---|
| `Sink-Base` | 60, 70, 80, 90, 105, 120 | 38, 35, 28, 25 | 50, 46 | `ULH-sink-cabinet` |
| `Side-Cabinet` | 25, 35, 50, 60, 70, 80, 90, 105, 120 | 38, 35, 28, 25 | 50, 46 | `ULH-side-cabinet` |
| `Open-Shelf` | 25–70 або 25–120 залежно від height | 38, 35, 28, 25 | 50, 46 | `ULH-Open-Shelf` |
| `Open-Side-Shelf` | 15 | 35, 25 | 50, 46 | відсутній |

`Open-Side-Shelf` є в profile/table, але знаходиться в `unplacedProductTypes`; loader прибирає його
card із builder. Повернення card потребує scene product і перенесення mapping у `productTypes`.

Висоту вирішує handle: Upper Groove — 38/28 cm, Push-to-Open — 35/25 cm. Cabinet catalog читає колонки
`handle_urban_topcut_heights_cm` і `handle_pto_heights_cm` table 580 через
`cabinetMatrixLegacyAdapter.columns.heightsByHandle`, тому builder пропонує лише висоти вибраного handle,
а зміна handle пересуває висоту до найближчої дозволеної (38 ↔ 35, 28 ↔ 25).

Користувач обирає висоту у двох місцях; обидва показують лише дві висоти вибраного handle
(Upper Groove — 28 і 38 cm, Push-to-Open — 25 і 35 cm):

- right sidebar Cabinet Builder — selector Height поруч із Width / Depth / Handle;
- меню поставленої шафи — Resize ▸ Height.

Обидва місця вмикає `ui.json` колекції, а не код:

- `styleSidebar.fields` — selectors правого sidebar у заданому порядку. Без нього sidebar показує
  Width, Depth, Handle; ULH оголошує `["Width", "Depth", "Height", "Handle"]`.
- `playerMenu.resize` — розміри пункту Resize у заданому порядку. Без нього — Width і Depth; ULH
  оголошує `["Width", "Depth", "Height"]`.

Запис у `ui.json` лише дозволяє показати Height. Самі висоти дає table 580: selector і пункт меню
з'являються, коли handle типу шафи приймає кілька висот, тому для колекції з однією висотою на handle
запис нічого не покаже.

Висота спільна для композиції. Поки шаф немає, вибір стосується наступної шафи; після розміщення зміна
йде через `changeDimension` (`{ attributeId: "Height", scope: "global" }`) і змінює всі шафи одразу, як
Depth. Порожній builder стартує з 38 cm — це `defaultValue` атрибута `Height` у `product-profile.json`.

Висоти іншого handle Height не пропонує: щоб їх отримати, користувач змінює Handle. Зміна handle
(`{ attributeId: "Handle" }`) пересуває висоту до найближчої, яку приймає новий handle: з поставленими
шафами спершу з'являється підтвердження `handle.appliesToAllCabinets`, колір groove скидається для
Push-to-Open, side panels втрачають upper groove. Handle і Height ідуть у сцену одним набором.

## Product semantics

- Cabinet types: Sink Base, Side Cabinet, Open Shelf, Open Side Shelf.
- Один drawer style: `1` (`1D` у сцені).
- Handles: `handle_urban_topcut`, `handle_pto`.
- Heights: 38, 35, 28, 25 cm.
- Fluting: None + Vertical/Horizontal A/B; доступність залежить від Lacquer Matte.
- Cabinet/Countertop colors читаються з configurator 4 через `optionsSource`.
- Countertop styles: integrated/vessel; `CountertopStyle` є `state-only` для сцени ULH.
- Basin catalog тимчасово повторює Urban values і фільтрується table 589; це не підтверджена
  власна ULH product map семантика.

Rule data навмисно обмежений `cabinetMatrixLegacyAdapter`, `cabinetColorTraits`, `fluting` і
`countertopFallbacks`. Відсутність USH rule section означає “правила немає”, а не “успадкувати USH”.

## Runtime bindings

`bound`: Handle, Height, Width, Depth, Drawers, CabinetColor, HandleGrooveColor, CountertopColor, Thickness, sinkType,
VesselColor.

`state-only`: CountertopStyle, DrawerPanelFluting, FaucetHolesAmount,
FaucetHolesSpacing, BookMatching, LedOption.

`HandleGrooveColor` передається всій композиції в custom і prebuilt. `RuleMaterialsCabinetULH`
фарбує лише `ULH_Cabinet_HGroove` для Upper Groove (`handle_urban_topcut`), залишаючи корпус у
`CabinetColor`. `None` або порожнє значення повертає паз до кольору корпусу; PTO не використовує
додатковий колір. Binding також зберігає цей ключ при placement і restore через `resolveProductConfig`.

### Handle Groove Color: дослідження flow (2026-10-12)

1. `/custom/cabinet-builder?collectionId=urban-low-height&preset=1` завантажує ULH package і configurator 4.
   Builder записує preset, його handle і початкові кольори; composition adapter розміщує ULH scene products.
2. Color step бере секцію `handle-groove` з `ui.json`, кольори — з profile `optionsSource`;
   секція доступна для `Handle.supportsGrooveColor` (Upper Groove).
3. `useCabinetColorSections` → `useAttributeChangeHandler` → `resolveChangeRequest` адресує першу
   шафу, бо profile scope — `cabinet`. `changeAttribute` перевіряє вибір і передає план runtime adapter.
4. Причина дефекту: старий `state-only` binding означав успіх без scene call; `commitChange`
   записував колір у Redux/presets, а `resolveProductConfig` видаляв його при placement/restore.
   Водночас shipped `RuleMaterialsCabinetULH` уже читав `HandleGrooveColor` і мав окремий groove target.
5. Виправлення: `bound`, identity `HandleGrooveColor`, `target: all`, `emptyValue: None`, `order: 50`.
   Adapter надсилає один `setConfigBatch({}, { HandleGrooveColor: value })`; правило фарбує тільки паз.

Браузерна перевірка локального custom preset 1: swatch **Castagno Chiaro 1C1** записав канонічне
`Castagno chiaro 1C1` у scene config і матеріал активного `ULH_Cabinet_HGroove`. Корпус і фасад лишилися
`Rox Black TKQ`; **None** повернув паз до `Rox Black TKQ`. JavaScript-помилок не було.
Регресійні тести також перевіряють обидва flow, дві шафи, незалежний колір паза при зміні корпусу,
PTO, placement/restore translation та відсутність запису кольору, коли сцена не готова.

`unbound`: CabinetType (визначається placement), pricing metadata, GrainDirection, towel bars,
side panels і dividers. Не надсилати state-only/unbound value напряму в PlayCanvas без зміни contract.

## Pricing і готовність

`sku-profile.json` має `status: partial`. Cabinet series — `URLH` (Open Shelf — `UROS`); Upper Groove
cabinet несе ще й елемент handle groove. Countertop, towel bar і side panel цінуються за граматикою USH
(`pricedAs: urban-standard-height`), а розмір і товщину countertop дає countertop table з manifest. ULH
немає в `SKU_SERIES_BY_COLLECTION`: pricing іде лише через `sku-profile.json`. Не можна використовувати
URSTD SKU лише тому, що ULH ділить configurator 4 з USH.

Основні gaps:

- 6 Multi-Level presets без композицій.
- Open Side Shelf без scene product.
- Open Side Shelf не цінується: його side не тримає жоден attribute, а gap у `sku-profile.json` блокує total.
- Height не пропонується, коли вибрано Open Shelf: полиця не має handle, який вирішує її висоти. Висоту
  композиції змінюють через Sink Base або Side Cabinet.
- Зміна висоти не пересуває ряди по вертикалі: нижній ряд дворядної композиції лишається на своїй
  позначці. Перевірено в браузері 12.10.2026 на моделі 60″ Multi-Level у Custom: після 38 → 28 cm між
  рядами лишається зазор 10 cm (верх нижньої шафи −10 cm, низ верхньої 0).
- Open Shelf ширше 70 cm (80–120 cm при висоті 28/25 cm) не пропонується: колонку `widths_cm_by_height`
  table 580 ніхто не читає.
- Countertop/basin contract частково позичений у USH; table 589 не є доказом повної ULH семантики.
- Manifest defaults не затверджені.
- Fluting зберігається в state, але не має ULH scene binding.

## Де змінювати

- Склад remote/local sources: `public/collections/urban-low-height/manifest.json`.
- Кроки/поля/зображення: `ui.json`.
- Значення й business rules: `product-profile.json`.
- SKU grammar і pricing gaps: `sku-profile.json`.
- Scene mapping/status: `runtime-bindings.json`.
- Model cards/compositions: `presets.json`.
- Matrix parser contract: `src/entities/product/lib/matrixCabinet.ts` і
  `product-profile.ruleData.cabinetMatrixLegacyAdapter`.

## Мінімальна перевірка

Запустити collection/profile/runtime тести, builder card test і TypeScript build. Для зміни scene mapping
додатково перевірити custom placement у browser. Не вважати сам факт появи option у UI доказом, що
вона bound у сцені або priced.
