# Class

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

Є 44 model cards, але всі `presetProducts` порожні. Production 2026-09-28 показує 44 картки та
`$0.00`; вибір model не має рецепту, з якого можна побудувати композицію. Це головний functional gap,
а не проблема router чи loader.

## Pricing

`sku-profile.json` має `status: partial`, cabinet series `CLSV`, countertop series `GB`. Відомі gaps:
vessel SKU/price (блокує total), Solid Surface group ambiguity, divider assumption, thick tops і
brackets. Не трактувати наявність SKU profile як повну pricing readiness.

## Мінімальна перевірка

Collection/Class profile/runtime tests, table 579 catalog, SKU/pricing tests, save/restore roundtrip і
build. Якщо додаються model recipes — перевірити, що кожен preset створює Class scene products, а не
Mako/Urban products.
