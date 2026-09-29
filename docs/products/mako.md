# Mako

## Ідентичність і sources

- `collectionId`: `mako`
- Live: <https://hasting-modular-phase-2-p98qb.ondigitalocean.app/prebuilt/model?collectionId=mako>
- Package: `public/collections/mako/`
- Remote: configurator 9, countertop table 577, cabinet table 581.
- Local: presets, UI, product profile, runtime bindings і partial SKU profile.

## Product contract

- Sink Base → `Mako-sink-cabinet`; Sink Cabinet → `Mako-side-cabinet`.
- Drawers 1/2; scene values `1D`/`2D`; heights 26/52 cm.
- Handles G57/G50 надсилаються як scene key `HandleStyle`.
- HandleColor, CabinetColor і LegColor походять із named groups configurator 9.
- `LegColor` також керує `ShowLegs`; empty ховає legs, `None` показує їх у cabinet color.
- CountertopStyle bound; basin і VesselColor state-only, бо Mako scene поки не має basin sub-product.
- Drawer style groups забороняють змішувати 1- і 2-drawer cabinets.

## Presets і production стан

42/42 presets мають композиції (88 cabinet entries загалом). Production 2026-09-28 показує 42 cards
і розраховану стартову ціну. Це найповніше підключення серед нових Class/Mako packages.

## Pricing

`sku-profile.json` має `status: partial`, cabinet series `MAKOV`, countertop series `GB` і окремий legs
SKU contract. Gaps: vessel (блокує total), Solid Surface group ambiguity і divider pricing assumption.

## Відомі межі

- Basin/vessel attributes не візуалізуються сценою.
- Legs підтверджені лише для 2DW; UI/profile ще не мають повного availability rule.
- Product sources не визначають, чи можна змішувати handle/color/leg choices у композиції.
- G50 length by cabinet width та точна vessel product data залишаються відкритими.

## Мінімальна перевірка

Mako profile/runtime tests, table 581 catalog, placed-cabinet tests, collection SKU/pricing tests,
save/restore roundtrip і build. Для legs перевірити порядок Drawers → LegColor, бо binding навмисно
спочатку ховає legs при зміні drawer style, а потім відновлює їх обраним color.
