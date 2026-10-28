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
- HandleColor і LegColor — одні на всю композицію: binding шле їх усім шафам (`target: all`), тож state
  записує значення в кожної шафи, а додана шафа (plus, Add Cabinet, duplicate) успадковує його і в сцені,
  і в state. Стартовий HandleColor — `Antracite 400 MT` (`defaults`), як у 42 моделях; LegColor стартового
  значення не має. Правило читається з даних (`isBroadcastCabinetValue`), а не з назви attribute.
- `LegColor` також керує `ShowLegs`; empty ховає legs. Моделі на legs і перемикач «Enable Legs, Then Color»
  дають власний колір `Antracite 400 MT` (`defaultValue` атрибута), тож зміна Cabinet Color legs не
  перефарбовує. `None` показує legs у cabinet color і лишається тільки для збережених раніше конфігурацій.
- CountertopStyle bound; basin і VesselColor state-only, бо Mako scene поки не має basin sub-product.
- Drawer style groups забороняють змішувати 1- і 2-drawer cabinets.

## Presets і production стан

42/42 presets мають композиції (88 cabinet entries загалом). Production 2026-09-28 показує 42 cards
і розраховану стартову ціну. Це найповніше підключення серед нових Class/Mako packages.

## Pricing

`sku-profile.json` має `status: partial`, cabinet series `MAKOV`, countertop series `GB` і окремий legs
SKU contract. Gaps: vessel (блокує total) і Solid Surface group ambiguity. Ціну органайзерів шухляд описує
[`drawer-organizers-ui.md`](../drawer-organizers-ui.md).

## Відомі межі

- Basin/vessel attributes не візуалізуються сценою.
- Legs підтверджені лише для 2DW; UI/profile ще не мають повного availability rule.
- Product sources не визначають, чи можна змішувати handle/color/leg choices у композиції.
- G50 length by cabinet width та точна vessel product data залишаються відкритими.

## Мінімальна перевірка

Mako profile/runtime tests, table 581 catalog, placed-cabinet tests, collection SKU/pricing tests,
save/restore roundtrip і build. Для HandleColor/LegColor: вибрати колір, додати шафу, видалити першу шафу —
сцена і SKU кожної шафи мають називати той самий колір (`compositionCommands.test.ts`). Для legs перевірити порядок Drawers → LegColor, бо binding навмисно
спочатку ховає legs при зміні drawer style, а потім відновлює їх обраним color.
