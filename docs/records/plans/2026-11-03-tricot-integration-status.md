# Tricot integration status — archived source snapshots

Archived on 2026-11-03 from the working copies of [handoff.md](../../../plans/tricot-integration/handoff.md) and [open-questions.uk.md](../../../plans/tricot-integration/open-questions.uk.md). The original dated entries below are provenance; their v44/v53 observations, pending wood/image requests and earlier defaults are not current blockers. The live documents retain outstanding acceptance and owner questions. Product requirements are maintained in [the Tricot specification](../../products/tricot/README.md).

Heading levels and the relative open-questions link are adjusted for this archive; the source text is otherwise preserved. Source SHA-256: `handoff.md` = `9412aad146d5f57b2ed3d074e31ca7eecb4e6cd4c18392a6e8572bdfc9863c07`; `open-questions.uk.md` = `ac28676a69d4877fcb621d0aaf7e2957f918f5ea07166cf4ffbac8a90b009671`.

## Source: handoff.md

## Tricot activation handoff

### Model33 published — 2026-10-28

At the user's subsequent explicit request, `Tricot 79 2DW 1_70` is now published as preset3979591210: Sink-Base100 + Side-Cabinet40 + Side-Cabinet60, all2 drawers, one basin on the first module. Its stable master identity and filters are preserved. The packaged catalog now has42 presets and the composition CSV93 module rows.

The300px catalog card is cropped from the real client viewer's front camera. The41 original PNG hashes remain unchanged; the original404 URL is retained as historical provenance, with the new image recorded separately under `model-images.json.localOverrides`. No pending image request remains for this model. Actual UI selection, card loading and Inches Dimensions were verified; QA evidence is under `docs/qa/tricot-2026-10-28/evidence/preset-add-33/`. This request supersedes the earlier accepted absence of model33 below; the current basin shape stays unchanged.

### Preset layout correction — 2026-10-28

The user approved correcting the 20 published layouts that differ from the manually verified Hastings website references. `presets.json` and the packaged `sources/preset-compositions.csv` now use those ordered module widths/types: the packaged CSV has 92 module rows across 42 recipes (original delivery: 88). The 41 published model IDs, titles, filters, image mappings, drawer modes, finishes, total widths and basin counts remain unchanged. The hidden `Tricot 79 2DW 1_70` recipe and its image availability are unchanged; the user confirmed its absence and the current basin shape as correct.

This dated correction supersedes the original CSV only for these 20 layouts. The independent regression fixture is `src/entities/collection/__tests__/fixtures/tricot-client-layouts-2026-10-28.json`; source references and before/after browser evidence are in `docs/qa/tricot-2026-10-28/`. No PlayCanvas runtime changes are required. Earlier activation/handoff statements below are historical.

The collection is deliberately staged. This record belongs to issue 7 and documents received inputs and acceptance steps. The sole maintained external request list is [open-questions.uk.md](../../../plans/tricot-integration/open-questions.uk.md). Supply approved exports/files or repository paths, not credentials; the frontend integration team does not author the scene or publish product tables on the owners' behalf.

### 3D/product owner

- Received: all 42 ordered recipes / 88 modules, semantic SB/SC types, dimensions, drawer values and basin associations from the supplied Google CSV. Stable model IDs, numbered alternatives and filters are preserved. Do not request that file again.
- Received: 41 exact public 2D model thumbnails, archived with SHA-256 checksums in `sources/model-images.json`. The user will supply a PNG for **Tricot 79 2DW 1_70** later (the source thumbnail returns HTTP 404). Its nonempty recipe is retained with `pending-image` status; no repeat image request is needed now.
- During actual placement acceptance, review asymmetry/physical offsets against the scene; CSV position is module order, not a fabricated geometric offset.
- Received and integrated: `Tricot-sink-cabinet` for SB, `Tricot-side-cabinet` for SC, cm Width/Height/Depth, `1D`/`2D`/`1DWID` drawers and exact CabinetColor/HandleGrooveColor material fields. Production `runtime-bindings.json` is referenced by the manifest. Remaining visual contracts are unbound, not state-only. The `test-tricot-*` bindings remain hypothetical product-rule test fixtures only.
- Received: one-drawer / inner-drawer modules may coexist, but cannot mix with two-drawer modules. Preset defaults are Rovere Oro 932, Cannette, Nero 433 MT, no panels, Matte White and LB440. No default model or additional accessory is inferred. Pattern remains scoped per module under semantic `DrawerPanelFluting`, labelled Cabinet Pattern; export v44 delivers it as `CabinetPattern` (Gessato spelled `Gessatto`), now bound per module.
- Received: panels live in Accessories, inherit cabinet material/color, and add 1 cm per active side to the countertop. Canvas activation/removal keys, side readback and exact visual behavior remain pending. Both Monosnap screenshots have now been supplied and inspected in the conversation. The first establishes the Urban Accessories layout reference; its groove variants, Dividers and Towel Bar are not Tricot catalog approval. The second confirms the archived CSV defaults. No screenshot request remains.
- Confirmed by the user: append `-CAB-{material}-{color}` to `VAN-TRIC-SP-.8W-15.7H-20.5D`. Production panel pricing now uses that suffix and the cabinet's color/material, with quantity equal to the actual active left/right sides. Unknown readback, Yes without an active side or No with a stale active side produces a blocking gap. Read-only API probes on 2026-10-07 returned `price: null` for the bare base, 984 for `-CAB-WDV-933`, and 941 for `-CAB-LACM-433`.

### API owner

- Received: cabinet DataTable 592 (`matrix-cabinet-tricot`) and countertop DataTable 593 (`matrix-countertop-tricot`); real API response fixtures are archived and source identities agree. `Sink-Cabinet` normalizes to semantic Side-Cabinet; the all-drawers forced height column and integrated/inner-drawer exclusion are mapped explicitly.
- Packaged source catalogs contain 23 cabinet colors, five patterns, 20 groove colors, 71 countertop colors and ten basins. This source inventory does not constitute delivery of API swatch metadata or a remote configurator identity.
- Received: compatibility from table 593. Loaded rules filter countertop choices and gate commands using actual module dimensions; material/thickness changes clear incompatible composition-wide and per-Sink-Base basins. Thickness values are 0.5, 0.75, 3.125, 4 and 4.75 inches. Table notes still mention thick-top and glass-hole confirmations; these are not invented additional options.
- Table 593 is a compatibility table, not a complete price contract. Existing Class/workbook references remain the starting evidence; do not reuse Urban pricing as a fallback. Current metadata/pricing requests are maintained only in the open-questions file.

### Activation checks

1. Validate complete model coverage with `validatePresetHandoff`; review placement/asymmetry against the real product export. The validator does not infer geometry or verify image content.
2. Integrate and validate delivered answers from [open-questions.uk.md](../../../plans/tricot-integration/open-questions.uk.md). Cabinet IDs, cm/drawer/lacquer bindings, approved recipes/defaults/policies and 592/593 are already integrated; do not request them again.
3. Validate visual readback and pricing against those approved contracts. Do not remove `availability`, missing-activation gaps or the runtime guard merely to bypass the readiness screen.
4. Run collection contract checks, TypeScript, changed-file lint, relevant/full tests and build. Record existing repository failures separately.
5. Execute issue 8 in the actual scene, including single modules, inner drawers, numbered alternatives, asymmetry, double basins, panels, summary prices and save/undo replay in both flows.

The local entry after activation uses `?collectionId=tricot`. Until the approved handoff is integrated, it shows the missing dependency screen and does not mount a working configurator.

### Partial runtime integration — 2026-10-07

The confirmed frontend portion of the developer contract is integrated without a grilling session. All 20 matte lacquer materials and both product registrations are verified against the delivered export. Three exact wood assets are absent and stay pending; no other wood is substituted. The developer's GL example does not expand the approved matte catalogs. Scene fallback defaults do not replace approved CSV defaults. The received contract is archived in `sources/runtime-handoff.json`.

Mapped values can carry explicit pending reasons; Tricot opts into product-config preflight. Add/insert/preset and restore reject invalid or pending visual inputs before scene mutation, and commands reject missing translations atomically. Existing collections retain legacy behavior. Approved semantic and already-translated scene configs restore idempotently; subsequent operations use returned instance IDs.

This is not activation: all 42 recipes retain pending visual defaults, including default wood, pattern and basin choices. Recipes are preserved rather than silently dropping their inputs. Remaining questions are separated in [open-questions.uk.md](../../../plans/tricot-integration/open-questions.uk.md). No real-scene/browser acceptance has been performed.

### Placement of pending choices — 2026-10-08

User decision, superseding the preflight rule of 2026-10-07 above: product-config preflight still rejects invalid inputs (an unknown value, a key without a binding), but a pending input no longer stops placement. Unbound attributes (panels, countertop, basin, grain) and pending values (the three woods) are not sent. The cabinet is placed with the delivered fields (cm sizes, drawers, lacquer and groove colors, and `CabinetPattern` since export v44), while the state, the Summary and the price keep the approved choice. A wood cabinet shows the export's own `Antracite Matte OCF` until the wood assets arrive; that readback value is declared pending, so undo, restore and duplicate accept it. Scene fallback defaults still never replace approved defaults in state or price. Commands for pending values remain unsupported. Keys the scene writes into every product (positions, category, divider zones) pass the preflight. All recipes now place; no real-scene/browser acceptance has been performed.

## Source: open-questions.uk.md

## Tricot: відкриті питання після часткової runtime-інтеграції

Уже інтегровано: реальні типи Tricot-sink-cabinet / Tricot-side-cabinet, сантиметри, режими 1D / 2D / 1DWID, 20 точних matte lacquer assets для CabinetColor і HandleGrooveColor, з експорту v44 — Cabinet Pattern (`CabinetPattern`), з Render Admin — власний material configurator 12. Рецепти, дефолти, 592/593 і погоджені правила панелей повторно запитувати не потрібно.

### Від 3D/PlayCanvas-розробника

1. **Wood Veneer:** точні material assets або підтверджені aliases для Noce Canaletto 933, Rovere Oro 932, Rovere Termocotto 931. У локальному staging-експорті afd76fa6 цих матеріалів немає; підміна іншою деревиною не допускається.
2. **Cabinet Pattern — отримано в експорті v44 і прив'язано, повторно не запитувати.** Ключ `CabinetPattern` на обох продуктах Tricot, значення Cannette / Gessatto / Loden / Twill / Satin (Gessato у сцені пишеться `Gessatto`), target — окремий модуль, readback через getConfig. Сцена не перевіряє матеріал, а її дефолт Satin не замінює погоджений Cannette. Візуальне приймання — в issue 8.
3. **Side Panels — підключено як в Urban Freestanding (2026-10-09), лише без пазу (NoG).** Панелі ставляться ліворуч/праворуч через спільний механізм (сторінка Accessories, SidePanelLeft/SidePanelRight), ціна рахує активні сторони, стільниця +1 см на сторону. Від 3D-розробника лишається: в експорті v44 є шаблон `Tricot_SidePanel`, але немає продукту для нього і `sidePanelSupport` у продуктах Tricot, тож сцена ставить стандартні панелі USH (висоти 50/53/56) замість панелі Tricot висотою 40.
4. **Countertop / basins — підключено як у Class/Mako (2026-10-09).** sinkType шле LB/VA/LV на ті самі authored sub-products, що й Class (LB440 → Top_HPLPrisma тощо), CountertopColor і Thickness — на всю композицію, CountertopStyle лише записується. З 2026-10-15 Tricot має і стиль Vessel, як Class: None/Iris/Frame/Plaza шлються на ті самі `Vessel`/`Vessel_Iris`/`Vessel_Frame`/`Vessel_Blade11`, VesselColor — на Tricot-sink-cabinet як лак сцени; ціна — VES-стільниця GB, HCUT і vessel з таблиці 542 (палітри vessel для Tricot продукт ще не підтвердив). Від 3D-розробника лишається: у Tricot-sink-cabinet в експорті v53 досі немає RuleChangeSinkType і RuleSinkMountPosition, тож раковина ставиться при додаванні модуля, але не міняється після (перемикання на vessel лишає вбудовану раковину, лише перефарбовану в колір vessel; перевірка 2026-10-15: навіть Sink Base, розміщений одразу з `Vessel_Iris`, отримує `Top_HPLPrisma`), і не підлаштовується під товсту стільницю; у сцені немає матеріалів Solid Surface, HPL і Porcelain (як і для Class).

Для кожної прив'язки: робочий addProduct / setConfig, результат getConfig та порядок/reset операцій, якщо потрібні. Статичний список ID екземплярів не потрібен: addProduct повертає ID для подальших змін/видалення.

### Від API / pricing-власника

5. **Swatches/metadata — отримано: configurator 12 (`modular-config-phase-2-materials-(tricot)`), повторно не запитувати.** Його палітри збігаються зі списками профілю: 23 кольори кабінету, 20 пазу, 71 стільниці (група `Select Vessel Color` на 40 лаків MT/GL з 2026-10-15 дає палітру VesselColor). Профіль лишає свої списки як allowlist і бере з 12 hex, SKU та картинки; manifest і `sourceRefs.configuratorId` вказують 12.
6. **Vessel у таблиці 593:** у ній немає колонок `min_vsl_cm` і `depths_cm_vessel`, які в ULH (таблиця 589) обмежують vessel Sink Base від 80 см. Тому в Tricot vessel доступний на будь-якій ширині Sink Base; потрібні значення продукту або підтвердження, що обмеження немає.
7. **GB pricing:** підтвердити countertop/basin SKU mappings, thickness tokens, quantities та приклади цін. 593 уже підключено як таблицю сумісності, але це не повний ціновий контракт. Кабінетні SKU та CAB-суфікс панелі повторного погодження не потребують.

### Уже обіцяний файл

8. **Закрито2026-10-28:** за прямим дорученням користувача Tricot79 2DW1_70 опубліковано з рецептом SB100→SC40→SC60 і карткою з реального фронтального ракурсу сайту. Оригінальні41 PNG збережені; старий404 лишився історією джерела. Повторно запитувати PNG не потрібно.

### З нашого боку

Додати решту прив'язок після отримання контрактів, перевірити обидва flows у справжній сцені (geometry, drawers, materials/pattern, panels, basins, summary, save/undo/redo). Staged знімається після закриття необхідних залежностей. Unit/adapter-тести не означають візуальне приймання або повну готовність.
