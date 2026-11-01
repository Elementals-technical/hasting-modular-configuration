# Class — інтеграція в код

Як пакет `public/collections/class/` підключено в застосунок: джерела, контракт сцени, стан пресетів, межі й мінімальна перевірка. Що колекція *має* робити — у специфікації поруч ([`README.md`](README.md)). Раніше цей файл був `docs/products/class.md`.

## Ідентичність і sources

- `collectionId`: `class`
- Live: <https://hasting-modular-phase-2-p98qb.ondigitalocean.app/prebuilt/model?collectionId=class>
- Package: `public/collections/class/`
- Remote: configurator 9, countertop table 578, cabinet table 579.
- Local: presets, UI, product profile, runtime bindings і partial SKU profile.

Class ділить configurator 9 з Mako, але має власні tables, products, profile та bindings. Profile colors
посилаються на `configurator:Select Cabinet Color` / `Select Countertop Color`; отже фактичний catalog
обмежений групами configurator 9, доки Class не отримає окремий configurator.

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

Активний каталог має рівно 24 пресети в порядку сайту клієнта, з ID 1–24.
За вимогою власника 2026-10-29 додаткові 20 моделей 2D прибрано з активного
`presets.json` і збережено в data repo:
`Class/input/modular-comparison-2026-10-28/local-only-presets-archive-2026-10-29.json`.
Історична відповідність ID зберігається у `preset-id-mapping-2026-10-29.json` поруч.
Поле `desc` видалено з даних пресетів. Розміри для порівняння зберігаються окремо у звіті data repo.

Початкові фасад і стільниця — `INVISIBLE WHITE OPACO 332`, integrated basin — `LV890`.
Ці defaults підтвердив власник скриншотом 2026-10-28; попередні `LUCIDO 334` у
recipes і profile виправлено. Кожен preset cabinet явно несе колір фасаду й стільниці.
Боковини та рамка поки `Nero 433 MT`: на наданому фрагменті їхніх defaults немає.
На сайті боковина візуально світла, тому її відповідність залишається відкритою.

[Порівняння 24 пар](../class-preset-comparison-2026-10-28.md) зберігає знімки **до**
виправлення матеріалу; воно не підтверджує візуальний результат нових defaults.

## Pricing

`sku-profile.json` має `status: partial`, cabinet series `CLSV`, countertop series `GB`. Відомі gaps:
vessel SKU/price (блокує total), Solid Surface group ambiguity, thick tops і brackets. Ціну
органайзерів шухляд описує [`drawer-organizers-ui.md`](../drawer-organizers-ui.md). Не трактувати
наявність SKU profile як повну pricing readiness.

## Мінімальна перевірка

Collection/Class profile/runtime tests, table 579 catalog, SKU/pricing tests, save/restore roundtrip і
build. Якщо додаються model recipes — перевірити, що кожен preset створює Class scene products, а не
Mako/Urban products.
