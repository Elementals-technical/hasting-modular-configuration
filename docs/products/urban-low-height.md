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

Важливий незавершений зв'язок: table 580 має `handle_urban_topcut_heights_cm` та
`handle_pto_heights_cm`, але cabinet catalog поки не використовує ці колонки. Тобто підтверджене
правило Upper Groove 38/28, PTO 35/25 не повністю enforced catalog layer.

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

`bound`: Handle, Height, Width, Depth, Drawers, CabinetColor, CountertopColor, Thickness, sinkType,
VesselColor.

`state-only`: CountertopStyle, DrawerPanelFluting, HandleGrooveColor, FaucetHolesAmount,
FaucetHolesSpacing, BookMatching, LedOption.

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
- Handle ↔ height coupling не читається catalog layer.
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
