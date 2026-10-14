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

## Ряди: Undo / Redo і збережені конфігурації

У ULH шафи можуть стояти у два ряди, а стільниця — бути зсунутою, піднятою, мати власну довжину й
нести раковину. Порядок продуктів цього не описує, тому знімок історії та збережена конфігурація
несуть ще й `sceneLayout` — документ, яким сцена сама описує композицію (`composition.exportPreset`),
і відповідність «ключ шафи в документі → runtime id». Відновлення віддає документ назад
(`composition.importPreset`): шафи, ряди, стільниця, декоративний верх і аксесуари повертаються на
свої місця під новими id.

- **Де це живе.** Читання й запис документа — лише `features/playCanvasAdapter/lib/sceneLayout.ts`.
  `captureFreeLayout` (`features/cabinetPlacementDebug/lib/`) вмикає це тільки для Drag & Drop
  колекцій; `main.tsx` реєструє його для історії (`setSceneLayoutCapture`).
- **Коли layout немає.** Інша колекція, відкритий чернетковий drag шафи (сцена відповідає
  `COMPOSITION_BUSY`), збереження, зроблене до цієї зміни, або документ, який сцена не прийняла, —
  композиція відновлюється старим шляхом, в один ряд. Дія користувача через це не блокується.
- **Drag & Drop в історії.** Додавання шафи перетягуванням, Reposition, зсув або зміна довжини
  стільниці, Position ▸ Standard і перенесення раковини дають по одному запису історії й скидають Redo.
  Стан читається до початку дії, запис з'являється при Apply; Cancel і Apply без змін запису не дають.
  Поки відкрита чернетка шафи або редагується стільниця, Undo і Redo недоступні.
- **Чого немає.** Undo до порожнього builder'а, як і раніше, відхиляється (`empty-composition`).

Перевірено в браузері 12.10.2026: Resize, Delete, Reposition і додавання перетягуванням на двох рядах;
колір у Prebuilt-моделі 60″ Multi-Level; Prebuilt → Custom → Resize; стільниця 5.1″ (підйом із
раковиною, довжина, Cancel, Standard); Side Panels і Towel Bar без дублів; збереження й відкриття
посилання з двома рядами. Urban Standard Height: Undo / Redo без змін, збереження layout не несе.

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

### Lower / CoverCountertop: колір, SKU і pricing (2026-10-12)

Prebuilt Countertop Color має Upper/Lower, якщо сцена реально опублікувала `Cabinet_Cover`.
Upper використовує наявний CountertopColor flow; Lower викликає native
`ConfiguratorAPI.cabinetCover.configure({ materialId })`, без зміни кольору Upper або тумб.
Lower бере палітру Cabinet Color, але лише підтверджені Ryan матеріали **3D, LACM, LACG, ST, BM, ESS** і
**HPL** (команда, 2026-10-14: Lower за замовчуванням має колір тумби, а тумби ULH стартують у HPL; GEN-SKU-03
до Ryan відкритий); allowlist міститься в `sku-profile.cabinetCover.materialSkus`. Matrix 589 для Upper не
обмежує декоративний Lower.

SKU Lower читає **фактично опублікований materialId кожного сегмента**, а не колір першої тумби:
`CT-UR{material}-{style}-{W}W-.5H-{D}D-{material}-{colour}`. Стиль — той самий, що в Upper: Integrated →
`INTG`, Vessel → `VES` (рішення 2026-10-14 замість постійного `VES` від 2026-10-12; GEN-SKU-03 до Ryan
відкритий). Команда погодила `.5H` і номінальну глибину тумб-підтримок: 46 см → `18.1D`, 50 см → `19.7D`.
W — довжина відкритого сегмента зі сцени. Невідомі/різноглибинні підтримки або непідтверджений
матеріал не отримують SKU через fallback: gap блокує complete total.

Publisher читає settled covers після зміни countertop та раз на секунду, поки ULH player змонтований:
native cabinetCover не має public change event. Матеріал є частиною runtime snapshot identity.
Zero offset Upper не виключає Lower з pricing; snapshot мусить належати поточній composition.
Compact Multi-Level import також adopts його primary cabinets у frontend state, записує спільні
cabinet values та фактично імпортовані countertop selections, інакше pricing взагалі не стартував.
Derived covers не включаються в список primary cabinets.

Lower — окрема `cabinetCover` pricing line. CT resolver отримує точну довжину через `widthCm`;
для однакових округлених SKU quantity і середня довжина зберігають сумарну довжину сегментів.
**Backend price є лише для HPL** (read-only перевірка `/pricing-v2/resolve`, 2026-10-14):
`CT-URHPL-INTG-35.4W-.5H-18.1D-HPL-TKQ` → CT/price_per_unit, datatable 529 (HPL 0.5″ = 17.704/см, $1,594 за
90 см; `INTG` і `VES` мають однакову ціну). Приклади Ryan і фактичні SKU шести матеріалів корпусу
(`CT-UR3D-VES-35.4W-.5H-18.1D-3D-10B`, `CT-URLACG-INTG-35.4W-.5H-18.1D-LACG-A6`) повертають `price: null`,
`No best match`: у 529 немає рядків 0.5″
для 3D/LACM/LACG/ST/BM/ESS, а color map 496 не має кодів 3D/LACG/ST/BM. Frontend позначає таку позицію як
missing, а розрахунок — partial; ціна тумби/Upper не підставляється.

Перевірено в браузері на preset 28: Upper offset `{x:0,y:0}`, Lower mesh-material змінюється
3D white → Lacquer Gloss blue; Upper лишається `Bianco Male TFA`, SKU Lower і pricing request
оновлюються з `widthCm=90`. Scene source/bundle не змінювали. Початкові Lower colours у presets,
scene first-import cache та save/history featureSettings — окремі питання, без змін у цій правці.

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
