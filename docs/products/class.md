# Class

## Ідентичність і sources

- `collectionId`: `class`
- Live: <https://hasting-modular-phase-2-p98qb.ondigitalocean.app/prebuilt/model?collectionId=class>
- Package: `public/collections/class/`
- Remote: configurator 8, countertop table 578, cabinet table 579.
- Local: presets, UI, product profile, runtime bindings і partial SKU profile.

Class має власний configurator 8, tables, products, profile та bindings. Profile colors посилаються на
групи `configurator:Select Cabinet Color`, `Select Cabinet Side Color`, `Select Frame Color` і
`Select Countertop Color`. Лише side- і frame-групи містять каталоги Class; решта груп — копії груп
Mako (configurator 9), тож пропонують і кольори інших колекцій (`sourceRefs` у `product-profile.json`).

## Product contract

- Cabinet types: Sink Base → `Class-sink-cabinet`; Sink Cabinet/Side Cabinet → `Class-side-cabinet`.
- Drawers: 1, 2, 1+inner; 1/1+inner мають 40 cm, 2 має 52 cm.
- Class не має handle attribute: grip є частиною frame.
- Окремі CabinetColor, CabinetSideColor і FrameColor.
- Countertop integrated/vessel, 10 integrated basin codes + None/Iris/Frame/Plaza.
- Rule data зараз містить лише matrix adapter і drawer style groups.

Runtime-bound: Height, Width, Depth, Drawers, три cabinet/frame colors, CountertopColor.
CountertopStyle, basin, vessel color, thickness і faucet details поки state-only. Це означає, що UI
може зберігати значення для rules/pricing, але сцена його не візуалізує.

## Presets і production стан

24 model cards мають композиції (51 cabinet entries). Як у Mako, кожен cabinet пресету несе кольори, а
`defaults` профілю дають стартові значення: фасад і стільниця `INVISIBLE WHITE OPACO 332`, боковини
`Latte 417 MT`, рамка `Nero 433 MT`. Тому model має повну ціну одразу. Бічні кольори й рамку, яких
ніхто не вибрав, pricing бере з `defaults`.

## Pricing

`sku-profile.json` має `status: partial`, cabinet series `CLSV`, countertop series `GB`. Відомі gaps:
vessel SKU/price (блокує total), Solid Surface group ambiguity, thick tops і brackets. Ціну
органайзерів шухляд описує [`drawer-organizers-ui.md`](../drawer-organizers-ui.md). Не трактувати
наявність SKU profile як повну pricing readiness.

## Мінімальна перевірка

Collection/Class profile/runtime tests, table 579 catalog, SKU/pricing tests, save/restore roundtrip і
build. Якщо додаються model recipes — перевірити, що кожен preset створює Class scene products, а не
Mako/Urban products.
