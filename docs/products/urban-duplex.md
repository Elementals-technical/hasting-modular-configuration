# Urban Duplex

## Ідентичність і sources

- `collectionId`: `urban-duplex` (є в registry; default колекція — USH).
- Package: `public/collections/urban-duplex/`
- Remote: configurator 13, countertop table 595, cabinet table 594. `requireSourceAgreement` у manifest
  вимагає, щоб `sourceRefs` профілю називали саме ці id.
- Local: presets, UI, product profile, runtime bindings і partial SKU profile.

Configurator 13 — власний material configurator колекції: `Select Cabinet Colors` (options Base Panel і
Lateral Panel), `Select Countertop Color`, `Select Vessel Color`, `Select Towel Bar Color`.

## Product contract

- Cabinet types (table 594): Sink Base → `UD-sink-cabinet`, 60–120 cm; Side Cabinet (`Sink-Cabinet`) →
  `UD-side-cabinet`, 60–120 cm; Open Shelf → `UD-open-shelves`, 25–70 cm; Open Side Shelf (`Side-Shelf`) →
  `UD-open-shelves-side`, 15 cm. Глибини 50 і 46 cm.
- Drawers 2 / 1 / 1+inner. `drawerStyleGroups` `[1, 1+inner] | [2]`: 1- і 2-drawer шафи в одній композиції не
  змішуються.
- Heights 56/53/38/28 cm, стартова 56. Table 594 форсує 2DW:56 і 1DW:53, а 1DW продається ще й як Slim 38 і
  28 cm (`heightsByDrawers`, див. [README](README.md)).
- Handle один — `UG` (Upper Groove); binding у нього state-only.
- Series `URDPX`, `URSTD`, `URLH`: `seriesModules` додає Side Cabinet серій URSTD і URLH шириною 25–120 cm
  (URSTD: 2DW 56, 1DW і 1+inner 53; URLH: 1DW 38/28). Сцені Series іде як `HandleStyle` (`Duplex` / `Default`).
- Base Panel і Lateral Panel — два кольори на всю композицію з options `Select Cabinet Colors/Base Panel` і
  `…/Lateral Panel`. BasePanelColor іде сцені як `CabinetColor` шафам `UD-sink-cabinet`, `UD-side-cabinet` і
  `UD-open-shelves`; LateralPanelColor — як `CabinetColorLateral` і `HandleGrooveColor` усім і як `CabinetColor`
  Open Side Shelf.
- `LateralPanelSide` L/R (`HandleSide`) — лише в style sidebar і player menu, для шафи серії URDPX.
- Defaults: Base Panel `Bianco Calce DA ST`, Lateral Panel `Pulpis Chiaro TKH` справа, Series URDPX, integrated
  стільниця `Pulpis Chiaro TKH` з basin `Top_HPLStrip`.
- Rule data: `dragDrop`, `cabinetMatrixLegacyAdapter`, `seriesModules`, `drawerStyleGroups`,
  `materialNormalization`, `vesselCompatibility`, `countertopFallbacks`.

Runtime-bound: Height, Width, Depth, Drawers, BasePanelColor, LateralPanelColor, LateralPanelSide, Series,
CountertopColor, Thickness, sinkType, VesselColor, TowelBarOption, TowelBarColor. State-only: Handle,
CabinetColor, CountertopStyle, HandleGrooveColor, FaucetHolesAmount, FaucetHolesSpacing, BookMatching, LedOption.

## Стільниця і thickness

- Table 595: HPL, Fenix і Tekorlux мають `1/2|4|5-1/8`, Porcelain — `1/2|2-3/8|4|5-1/2`; глибини 50 і 46 cm;
  vessel від 80 cm (`min_vsl_cm`).
- Thickness options 0.5, 2.4, 4, 5.125 (label 5.1″) і 5.5 мають ті самі `capabilities`, що в Urban Low Height:
  2.4″ ковзає; 4″ ковзає, тримає vessel і має Length; 5⅛″ і 5½″ ковзають, піднімаються і мають Length.
  Правила ті самі (client rules 22.10 і 27.10), див. [countertop-position-ui.md](../countertop-position-ui.md).
- Configurator 13 дає 61 колір стільниці: Porcelain 38, HPL 12, Fenix 9 і два Solid Surface (`Gloss White`,
  `Matte White`; material записаний як `Solid-Surface` і `Solid Surface`). Рядка Solid Surface table 595 не має,
  тож ці кольори відмовляються; що з ними робити, вирішує product.
- Browser check 2026-10-28 (scene v79): над Sink Base меню і крок пропонують HPL-стільниці 0.5″, 4″ і 5.1″; після
  lift з integrated basin — лише 5.1″, з vessel — 4″ і 5.1″. Lift робить Sink Base Side Cabinet
  (`UD-side-cabinet-<uuid>`) з її розміром, серією, стороною й кольорами; вона ціниться як SC (`VAN-URDPX-SC/…`).
  Standard повертає Sink Base. Дві Sink Base не перетворюються: стільниця несе обидва basin і пропонує лише 5.1″.
- З v79 `UD-sink-cabinet` має `RuleChangeSinkType`: vessel заміняє integrated basin у сцені.

## Presets

71 presets, 66 з `presetProducts`; 5 з них — Multi-Level (`format: "ulh-compact-v1"`).

## Pricing

`sku-profile.json` має `status: partial`. Власних countertop SKU price list не має: стільниця ціниться як Urban
Standard Height (`countertop.pricedAs`, gap не блокує total); Rectangular basin Solid-Surface — як USH
`Top_Tekorlux_Rectangular` до GEN-MAT-01. Lower cover (`cabinetCover`): prefix `UR`, 0.5″, стартовий колір від
LateralPanelColor, в обох flows.

## Відомі межі

- Сцена v79 не приймає ручне повернення стільниці додому на моделі з однією шафою (`landSink` →
  `COUNTERTOP_RESTORE_FAILED`); на двох шафах і в Urban Low Height приймає. Position ▸ Standard працює.
- 4″ з vessel на одній шафі опустити не можна (`SINK_BASE_NOT_COVERED`): стільниця йде в Standard, vessel — назад у
  Sink Base, з повідомленням "It was returned to the standard position." (browser check 2026-10-28). На двох шафах
  vessel може опуститися над Side Cabinet URSTD 50 cm, і `landSink` робить її Sink Base поза каталогом (Sink Base
  лише URDPX 60–120 cm, vessel від 80 cm). Правила для такої посадки ще немає.
- Перетворена шафа зберігає в scene config `ProductType: "UD-sink-cabinet"`; тип застосунок бере з runtime id.
- Поки стільниця тримає basin після lift, Countertop Style, Basin Style і Vessel Color заблоковані з причиною
  (`countertop.hostedSink.*`): сцена v79 не перебудовує basin на стільниці
  ([countertop-position-ui.md](../countertop-position-ui.md)).
- `excludedFromThisProfile` профілю перелічує, чого він ще не виражає (lower countertop, dividers, LED тощо).

## Мінімальна перевірка

`partialCollectionPackages.test.ts`, `urbanDuplexPresets.test.ts`, `urbanDuplexRuntimeBindings.test.ts`,
`countertopFieldAvailability.test.tsx` (thickness з table 595), `createPlayCanvasRuntimePort.test.ts` (UUID ids),
`sceneKeysInExport.test.ts`, `collectionPricing.test.ts` і build. Lift, Standard і кольори панелей після них
перевіряти в браузері.
