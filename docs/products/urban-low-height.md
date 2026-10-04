# Urban Low Height (ULH)

## Ідентичність і точка входу

- `collectionId`: `urban-low-height`
- Live: <https://hasting-modular-phase-2-p98qb.ondigitalocean.app/prebuilt/model?collectionId=urban-low-height>
- Package: `public/collections/urban-low-height/`
- Registry entry: `public/collections/registry.json`
- Default collection: ні; без query parameter відкривається USH.

ULH — окрема колекція, а не mode USH. Вона ділить з USH remote configurator 4 і countertop table
438, але має власні UI, product profile, cabinet table 580, presets та runtime bindings.

## Що завантажується

```text
manifest.json
  local: presets.json, ui.json, product-profile.json, runtime-bindings.json
  remote: configurator 4, countertop table 438, cabinet table 580
```

`defaults` порожній. Початкові values походять з preset або effective/profile fallback, тому додавання
manifest default повинно бути явним product-рішенням.

## UI та моделі

Prebuilt і custom мають по чотири кроки:

- Prebuilt: Model → Color → Countertop & Basin → Summary.
- Custom: Cabinet Builder → Color → Countertop & Basin → Summary.

`presets.json` містить 59 model cards. 53 мають `presetProducts`; 6 Multi-Level моделей навмисно
порожні, бо сцена ще не вміє розкладати нижній рівень. Production-перевірка 2026-09-28 показала всі
59 карток і ті самі чотири кроки.

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
- Basin catalog тимчасово повторює Urban values і фільтрується table 438; це не підтверджена
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

ULH не має ні `sku-profile.json`, ні legacy entry у `SKU_SERIES_BY_COLLECTION`. Це свідомий
`no-sku-series`, тому production показує `Price unavailable`. Не можна використовувати URSTD SKU
лише тому, що ULH ділить configurator 4 з USH.

Основні gaps:

- 6 Multi-Level presets без композицій.
- Open Side Shelf без scene product.
- Handle ↔ height coupling не читається catalog layer.
- Немає власного SKU/pricing profile.
- Countertop/basin contract частково позичений у USH; table 438 не є доказом повної ULH семантики.
- Manifest defaults не затверджені.
- Fluting зберігається в state, але не має ULH scene binding.

## Де змінювати

- Склад remote/local sources: `public/collections/urban-low-height/manifest.json`.
- Кроки/поля/зображення: `ui.json`.
- Значення й business rules: `product-profile.json`.
- Scene mapping/status: `runtime-bindings.json`.
- Model cards/compositions: `presets.json`.
- Matrix parser contract: `src/entities/product/lib/matrixCabinet.ts` і
  `product-profile.ruleData.cabinetMatrixLegacyAdapter`.

## Мінімальна перевірка

Запустити collection/profile/runtime тести, builder card test і TypeScript build. Для зміни scene mapping
додатково перевірити custom placement у browser. Не вважати сам факт появи option у UI доказом, що
вона bound у сцені або priced.
