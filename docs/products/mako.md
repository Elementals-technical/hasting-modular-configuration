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
- `LegColor` також керує `ShowLegs`; empty ховає legs. Моделі на legs мають власний колір
  `Antracite 400 MT`, тож зміна Cabinet Color legs не перефарбовує. `None` показує legs у cabinet color і
  лишається тільки для збережених раніше конфігурацій.
- Legs ідуть за кольором handle (`followsAttribute: "HandleColor"` на `LegColor`). Перемикач «Enable Legs,
  Then Color» вмикає legs у поточному кольорі handle; якщо legs цього кольору не пропонують, то в
  `Antracite 400 MT` (`defaultValue` атрибута). Legs, що тримають колір handle, переходять на кожен
  наступний колір handle в тому ж наборі змін, зокрема й на повторний вибір, який змушує зміна стилю
  handle (G50 → Silver/Gold). Колір legs, обраний користувачем, лишається; вимкнені legs лишаються
  вимкненими; колір handle, якого legs не пропонують, їх не рухає. Звичайний вибір кольору legs handle не
  змінює. Шафам 1DW legs не планують (`MAKO-LEG-002`).
- Шафа, яку переводять на 1DW, втрачає LegColor у тому ж наборі змін (`planUndeterminedResets` за
  `MAKO-LEG-002`): сцена, state і ціна стоять без legs, і повернення на 2DW їх не відновлює.
- Стартова стільниця — `Matte White` (Solid Surface, SSTL .5″) з basin `LB440`, як на картинках моделей
  (`defaults`); її отримують і моделі, і перша шафа порожнього builder. Countertop Color вимикає кольори, яких
  таблиця 577 не робить (Fenix, `Matte White 8cm`), через `availabilityRef: "CountertopColor.allowed"`.
- CountertopStyle, sinkType (basin) і VesselColor bound: назви basin перекладаються в sink sub-products під
  `ClMa_Sink_Point`, а VesselColor фарбує vessel.
- Drawer style groups забороняють змішувати 1- і 2-drawer cabinets.

## Presets і production стан

42/42 presets мають композиції (88 cabinet entries загалом). Production 2026-09-28 показує 42 cards
і розраховану стартову ціну. Це найповніше підключення серед нових Class/Mako packages.

## Pricing

`sku-profile.json` має `status: partial`, cabinet series `MAKOV`, countertop series `GB` і окремий legs
SKU contract. Gaps: vessel (блокує total), Solid Surface group ambiguity і divider pricing assumption.
Шафа ціниться лише з повного вводу (`requireCompleteInput`, як Lame): розмір не з таблиці 581 (ще не
прочитаний, `X`), невибраний HandleColor або колір без коду (цифри в назві чи `codeByValue`; Gold — `GLD` з
configurator 9) дають не SKU, а gap «Incomplete price». Так configurator 9 пропонує кольори інших колекцій
з буквеними кодами (`Agata BD MT`), і вони стоять без ціни, доки product не вирішить палітру Mako.
Ціну органайзерів шухляд описує [`drawer-organizers-ui.md`](../drawer-organizers-ui.md).

## Відомі межі

- Basin/vessel attributes не візуалізуються сценою.
- Legs підтверджені лише для 2DW; на 1DW Leg Color заблоковано і скидається, але коли поле показувати,
  відкрито (Q-MAKO-002).
- Product sources не визначають, чи можна змішувати handle/color/leg choices у композиції.
- G50 length by cabinet width та точна vessel product data залишаються відкритими.

## Мінімальна перевірка

Mako profile/runtime tests, table 581 catalog, placed-cabinet tests, collection SKU/pricing tests,
save/restore roundtrip і build. Для HandleColor/LegColor: вибрати колір, додати шафу, видалити першу шафу —
сцена і SKU кожної шафи мають називати той самий колір (`compositionCommands.test.ts`). Для legs перевірити порядок Drawers → LegColor, бо binding навмисно
спочатку ховає legs при зміні drawer style, а потім відновлює їх обраним color. Для legs, що йдуть за
handle: увімкнути legs, змінити колір handle, змінити стиль handle на G50 — legs мають лишитися в кольорі
handle (`followsAttribute.test.ts`, `buildChangePlan.test.ts`).
