# Tricot: аудит інтеграції та план підготовки PRD

Дата: 2026-10-06. Статус: аудит та узгодження через grill-me завершено; [PRD англійською](tricot-integration.prd.md) створено через to-prd. Відсутні product/3D/API inputs зафіксовано як залежності реалізації та приймання. Рішення нижче позначені як рекомендації, якщо їх ще не погоджено.

Це історичний аудит до реалізації. Єдиний актуальний список відкритих питань — [open-questions.uk.md](tricot-integration/open-questions.uk.md); отримані пізніше дані та перевірки записано в [трекері](tricot-integration/README.md).

## Висновок

Архітектура конфігуратора вже дозволяє підключити Tricot окремим пакетом колекції. Переписувати систему маніфестів не потрібно. Однак наявного master-файлу недостатньо для повного інтерактивного продукту: він описує каталоги опцій та перелік моделей, але не їхній склад, конструктивні обмеження, SKU або контракт 3D-сцени.

Основний обсяг — підготовка та перевірка даних колекції. Надана XLSX-книга закрила SKU series, розміри модулів, drawer styles та сумісність pattern/material. Потрібні розширення для залежних від матеріалу патернів і власного ціноутворення бокових панелей. Склад 42 композицій та 3D-контракт ще відсутні. Повне підключення неможливо вважати завершеним лише за фактом завантаження manifest або появи карток моделей.

## Джерела та межі перевірки

| Джерело                                                                                                                                   | Результат перевірки                                                                                                           | Призначення                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Поточний конфігуратор, commit `dca2fc64`, 2026-10-04                                                                                      | Код, JSON колекцій, тести та локальний PlayCanvas export перевірено; робоче дерево на початку чисте                           | Актуальні контракти інтеграції                              |
| Локальний `hasting-data-modular-review`, branch `analysis/products-data`, commit `c45df78`, 2026-09-09                                    | У папці Tricot знайдено один master CSV; додаткових Tricot rules, SKU workbook, BOM чи зображень немає                        | Каталоги опцій, моделі та фільтри                           |
| [Tricot у GitHub](https://github.com/Elementals-technical/hasting-data-modular-review/tree/analysis/products-data/Tricot)                 | Web-читання недоступне; використано локальний checkout зазначеної гілки. Свіжість відносно remote не підтверджена             | Посилання на джерело користувача                            |
| [SKU Google Sheets](https://docs.google.com/spreadsheets/d/10YKejH2sM-FVTxjr5ej5pI6d4Tvfqq3W1zo8G5-ciRk/edit?gid=818697916#gid=818697916) | Web-читання недоступне; CSV export повернув HTTP 401. Доступ до змісту отримано через XLSX, наданий користувачем              | Початкове джерело користувача                               |
| [Tricot Vanities - SKUs + Pricing.xlsx](</Users/a123/Downloads/Tricot Vanities - SKUs + Pricing.xlsx>)                                    | Прочитано всі 6 листів, comments, hyperlinks і 3 embedded images; CabinetPricing містить 135 cabinet rows та 1 side-panel row | SKU grammar, розміри, material/pattern rules та базові ціни |
| [Наданий користувачем master CSV](</Users/a123/Downloads/Hasting-Master-File-[_Tricot Vanity_] (2).csv>)                                  | Побайтово збігається з локальним master; користувач надав його як список пресетів                                             | Підтверджене джерело переліку 42 моделей, labels та filters |
| Live API: configurators 4/9, datatables 438/439/577/578, 8 pricing GET-запитів                                                            | HTTP 200; змін API не виконувалось                                                                                            | Поточні джерела, габарити та вибіркова перевірка цін        |

Master-файл: `../hasting-data-modular-review/Tricot/input/2d/Hasting-Master-File-[_Tricot Vanity_] (2).csv`. Попри розширення CSV, це таблиця з роздільником TAB і quoted values. Імпорт має працювати за назвами колонок.

Важливо: історичні readiness-документи в обох репозиторіях частково застаріли. Наприклад, поточні runtime bindings Mako вже мають bound basin/vessel attributes, хоча опис Mako ще називає їх state-only. Для цього аудиту пріоритет має поточний код та JSON.

## Що підтверджено для Tricot

Master містить 185 рядків даних, 19 колонок, ProductID `TRICOT`, ProductName `Tricot Vanity` і дев'ять технічних атрибутів.

| Атрибут джерела  | Значень | Підтверджений зміст                                                     |
| ---------------- | ------: | ----------------------------------------------------------------------- |
| Model            |      42 | Перелік моделей, назви карток та style tags                             |
| Style            |       5 | 1-Drawer, 2-Drawer, Single basin, Double basin, Asymmetrical            |
| Conceptsize      |       7 | Групи 24, 30, 40, 50, 60, 70, 80; це фільтри ширини, не розміри модулів |
| Cabinet Color    |      23 | 20 Lacquered MT та 3 Wood Veneer                                        |
| Cabinet Pattern  |       5 | Loden, Cannette, Twill, Gessato, Satin                                  |
| Handle Color     |      20 | Lacquered MT; UI-назва групи — Handle Groove Color                      |
| Side Panels      |       2 | Технічні Yes/No; UI-підпис для No — None                                |
| Countertop Color |      71 | 2 Solid Surface, 14 HPL, 15 Porcelain, 20 Glass MT, 20 Glass GL         |
| Basin Style      |      10 | LB440, LB175, LB575, LB856, VA023, VA024, LV890, LV892, VA002, VA005    |

Моделі охоплюють номінальні ширини 24, 32, 40, 48, 55, 63, 71, 79, 87 дюймів. Є `1DW`, `2DW` та `1DWID` моделі. Усі 42 рядки Model мають style-filter metadata; колонка applyFilter порожня. Порожнє applyFilter саме по собі не доводить, що фільтри не працюють.

Підтверджені кольори Wood Veneer: Noce Canaletto 933, Rovere Oro 932, Rovere Termocotto 931. У Cabinet Pattern технічне значення `Cannette` відрізняється від UI-label `Cannete`; не можна довільно обрати одне написання для scene/SKU.

Порядок категорій master: Model → Cabinet Color → Cabinet Pattern → Handle Groove Color → Side Panels → Countertop Color → Basin Style. Це джерело порядку секцій; користувач погодив їхнє групування у п'ять сторінок нижче.

Користувач підтвердив підтримку обох сценаріїв: `prebuilt` для готових пресетів і `custom` для власних композицій. В обох сценаріях застосовуються спільні product rules, material/pattern compatibility та SKU-контракт Tricot. Користувач погодив групування сторінок: Model/Cabinet Builder → Cabinet customization (Color, Pattern, Groove Color) → Side Panels → Countertop (Color, Thickness, Basin Style) → Summary; зберегти порядок відповідних секцій master.

## Що підтвердила SKU-книга

Листи: SKU Structure - Product Model, SKU Curation, CabinetPricing, CountertopPricing, Basin StylePricing, AccessoriesPricing. Source references нижче використовують назви листів та cell addresses, щоб висновки можна було перевірити в Excel.

| Параметр             | Підтверджене значення                                               | Evidence                                                      |
| -------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------- |
| Cabinet SKU series   | `TRIC`, окремо від master ProductID `TRICOT`                        | SKU Curation D2; CabinetPricing C3                            |
| Cabinet types        | SB — Sink Base; SC — Side Cabinet                                   | SKU Curation B6/O6; CabinetPricing A6/A83                     |
| Drawer styles        | 1DW, 2DW, 1DWID                                                     | SKU Curation B7/F7/J7 та O7/S7/W7                             |
| Sink Base widths     | 60, 80, 100, 120 cm                                                 | SKU Curation B10:B13 та паралельні drawer columns             |
| Side Cabinet widths  | 40, 60, 80, 100, 120 cm                                             | SKU Curation O10:O14 та паралельні drawer columns             |
| Cabinet height/depth | 40/52 cm для всіх drawer styles; SKU tokens 15.7H/20.5D             | SKU Curation row 7/8; усі 135 CabinetPricing cabinet rows     |
| Wood Veneer          | Material code WDV; patterns Cannette/Cannete, Twill, Gessato, Satin | CabinetPricing B5, ціни в колонці B та diagram у SKU Curation |
| Matte lacquer        | Material code LACM; pattern Loden                                   | CabinetPricing C5, ціни в колонці C та той самий diagram      |
| Color elements       | `CAB-{material}-{color}` і `HDL-LACM-{color}`                       | SKU grammar; CabinetPricing C2/H2                             |
| Side panels          | Окремий SKU `VAN-TRIC-SP-.8W-15.7H-20.5D`; WDV 984, LACM 941        | CabinetPricing A176:C176                                      |

Патерн має пряму залежність від матеріалу; це підтверджено не лише порожніми pricing cells, а й embedded source diagram. Diagram також називає 1DWID варіантом із внутрішнім drawer замість двох зовнішніх drawers. Усі три стилі залишаються висотою 40 cm.

| Master canonical value | UI/workbook spelling      | SKU token | Material |
| ---------------------- | ------------------------- | --------- | -------- |
| Cannette               | Cannete; diagram Cannette | CAN       | WDV      |
| Twill                  | Twill                     | TWLL      | WDV      |
| Gessato                | Gessato                   | GES       | WDV      |
| Satin                  | Satin                     | SAT       | WDV      |
| Loden                  | Loden                     | LOD       | LACM     |

Cabinet grammar: `VAN-TRIC-{type}/{drawers}/{pattern}-{W}W-{H}H-{D}D-CAB-{material}-{color}-HDL-LACM-{color}`. Окремого Handle Style token у config block немає. Рекомендовано описати його через існуючий data-driven sku-profile; cabinet-sku-mappings не потрібний для цієї граматики.

У SKU Curation розміри cabinet width/height/depth у cm, а CabinetPricing та full SKU examples — у inches, округлених до одного десяткового знака. Panel `.8W` уже заданий як inch token у SKU Curation, поряд із cm height/depth. Тому не можна трактувати всі числові SKU Curation tokens в однакових одиницях. Точну фізичну товщину панелі, її quantity та вплив на total width ще слід підтвердити.

### Shared countertop/basin/accessory sources

CabinetPricing E12/E15 прямо зазначає спільні countertop та basin SKU для Tricot/Class/Lame/Mako. Листи CountertopPricing, Basin StylePricing та AccessoriesPricing не містять власних price rows; вони посилаються на Class workbook:

- [Class CountertopPricing](https://docs.google.com/spreadsheets/d/1ZmGk1OcPASzAH_uC4HR6JRh89qH8gid0gJla33nq6GM/edit?gid=1405440096).
- [Class Basin StylePricing](https://docs.google.com/spreadsheets/d/1ZmGk1OcPASzAH_uC4HR6JRh89qH8gid0gJla33nq6GM/edit?gid=2023763518).
- [Class AccessoriesPricing](https://docs.google.com/spreadsheets/d/1ZmGk1OcPASzAH_uC4HR6JRh89qH8gid0gJla33nq6GM/edit?gid=269769622).

Ці посилання прочитані з XLSX relationships; їхній зовнішній вміст у цьому оновленні не завантажувався. Поточний Class sku-profile дає наявний приклад GB grammar, але не замінює перевірку всіх Tricot countertop rules та фінального total.

Master Class і Tricot мають однакові 10 Basin Style values. Countertop Color має по 71 value, але 40 Glass values у Class отримують префікс `G`, а в Tricot — ні. Решта 31 value/category pair збігається. Отже, reuse Class/API каталогу потребує явних Glass aliases; просте порівняння строк дасть помилкові missing colors.

### Вибіркова live-перевірка pricing

| SKU case                                               | API price | Висновок                                                                                                                          |
| ------------------------------------------------------ | --------: | --------------------------------------------------------------------------------------------------------------------------------- |
| SC/1DW/TWLL, 40/40/52 cm, CAB-WDV-933, HDL-LACM-412    |      2014 | Збігається з CabinetPricing B120 та full example C2                                                                               |
| SC/1DWID/LOD, 120/40/52 cm, CAB-LACM-413, HDL-LACM-413 |      3097 | Збігається з CabinetPricing C172 та full example H2                                                                               |
| SB/1DW/LOD, 60/40/52 cm, CAB-LACM-400, HDL-LACM-400    |      3045 | Збігається з CabinetPricing C52                                                                                                   |
| SB/1DW/CAN, той самий розмір, CAB-LACM-400             |      null | Непідтримувана source material/pattern комбінація не має ціни                                                                     |
| SB/1DW/LOD, той самий розмір, CAB-WDV-933              |      3045 | API повертає ціну навіть для комбінації, яку source diagram не дозволяє; pricing response не є валідатором продуктової сумісності |
| SP з CAB-WDV-933 / CAB-LACM-400                        | 984 / 941 | Збігається з CabinetPricing row 176; suffix використано для перевірки API, workbook не містить повного SP example                 |
| VAN-GBDIV-MTL-3.9W-2H-16.9D                            |       170 | Historical null-price feedback у книзі більше не відтворюється для цього SKU                                                      |

API metadata називає pricing matrix 556 та colorMap 495. Це pricing sources, а не cabinet compatibility table: не плутати їх із logical roles table 439/майбутнім Tricot cabinet table.

Історичні screenshot images в CabinetPricing містять null для WDV та divider SKU. Поточні запити вище повертають ціни для перевірених прикладів; виправлення всіх 135 SKU не перевірено.

## Чого master не визначає самостійно

Цей перелік описує межі master CSV. SKU-книга вже закрила dimensions, drawer styles, pattern/material compatibility та cabinet SKU-коди; відкритими залишаються композиції, scene contract і деталізація side panels/спільних countertop rules.

- Порядок, тип і ширину кожної шафи в кожній з 42 композицій; значення числових суфіксів у назвах моделей.
- Висоту, глибину, точні ширини в сантиметрах, різницю між зовнішнім та внутрішнім drawer.
- Позиції раковин і конструкцію асиметричних моделей. Style tags визначають категорію, але не BOM.
- Залежності pattern ↔ material/finish, pattern ↔ side panels та підтримку патернів на різних частинах виробу.
- Типи ручок, їхню геометрію та правила кольору пазу. Наявність Handle Color не є каталогом Handle Style.
- Конструктивні правила бокових панелей: сторони, кількість, колір, товщина, вплив на габарити.
- Дозволені countertop thicknesses, basin/material compatibility, faucet holes та максимальні довжини.
- Затверджені стартові кольори, патерн, basin, panel state і default preset.
- Картинки моделей/патернів, матеріальні ідентифікатори сцени та SKU-коди.

`Matte White 8cm` — назва countertop option. Її недостатньо, щоб визначити окрему товщину, її одиниці або відповідний SKU.

## Поточна архітектура

Registry містить `urban-standard-height`, `urban-low-height`, `class`, `mako`; Tricot відсутня. Ідентичність задається через `collectionId` у URL, manifest і saved configuration. Рекомендований ID нової колекції — `tricot`.

| Частина                | Існуюча підтримка                                                                   | Потрібно для Tricot                                        |
| ---------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Registry + manifest    | Вибір колекції, local/remote sources, defaults, defaultPresetId                     | Зареєструвати пакет та перевірені джерела                  |
| Presets                | Картки, фільтри, список presetProducts, relative images                             | 42 записи з підтвердженим BOM та зображеннями              |
| UI                     | Prebuilt/custom flows, fields, sections, generic FieldsStepPage, option images      | Відобразити секції Tricot та узгоджений порядок            |
| Product profile        | Атрибути, scope, aliases, defaults, capabilities, rules, messages                   | Окремі каталоги і правила без випадкового успадкування USH |
| Cabinet matrix adapter | Розміри, drawer/handle relations та forced heights                                  | Підключити відповідну DataTable і її column mappings       |
| Runtime bindings       | Product types, scene keys/values, targets, reset/order                              | Контракт Tricot scene products та значень                  |
| SKU profile            | Data-driven config block, material/color elements, countertop/vessels, pricing gaps | Граматика зі SKU-джерела Tricot                            |
| Save/restore + summary | Collection identity та scoped attributes                                            | Перевірити всі Tricot attributes у roundtrip та summary    |

Основа пакета за рекомендацією: manifest, presets, ui, product-profile, runtime-bindings, sku-profile та assets. `navigation.json` і `static-options.json` не є обов'язковими: навігація може виводитися з UI, статичні каталоги — з profile.

`cabinet-sku-mappings.json` у USH задає лише словники типів, drawers, handles, pattern та аксесуарів. Legacy SKU resolver додатково потребує series з коду; наразі legacy series є тільки для USH. Тому просто додати Tricot mappings недостатньо для pricing.

Рекомендовано використати `sku-profile.json`, як у Class/Mako/ULH: він уже підтримує потрібний Tricot config block type/drawers/pattern і CAB/HDL material/color elements. Надана книга підтвердила придатність цього підходу. Два незалежні набори тих самих SKU-кодів створювати не слід.

## DataTables та каталог API

Користувач бере на себе перевірку придатності таблиць USH і копіювання/створення таблиць у API. Для цього PRD потрібні результати порівняння і фінальні ID, а не повторне доручення цього завдання агенту.

Live configurator 4: `USH - Modular configuration phase - 1`, групи Cabinet Color, Handle Groove Color, Towel Bar Color, Vessels, Countertop Color. Live configurator 9: `modular-config-phase-2 (Mako)`, групи Select Cabinet Color, Select Handle Color, Select Leg Color, Select Countertop Color. Підтвердженого Tricot configurator ID немає. Повний збіг палітр/metadata цих каталогів із Tricot не перевірено.

Live cabinet table 439 має 4 рядки та Urban-specific handle columns. Повторний GET підтвердив USH depths 46/50.5 і heights 50/53/56; у Tricot потрібні depth 52 та height 40. Також відрізняються widths/type catalogs. Отже, 439 без зміни вмісту не підходить: потрібна окрема Tricot cabinet table із підтвердженими widths, усіма трьома drawer styles і fixed height/depth, без випадкових Urban handle restrictions.

Live countertop table 438 має 27 рядків і USH basin tokens. Поточний Class manifest використовує countertop table 578, Mako — 577. У першій версії цього аудиту Class помилково віднесено до 577; тут це виправлено за поточним manifest.

Live table 577 має depth 52, але не містить Tricot basin VA023 і натомість має VA030. Live table 578 включає VA023 із thickness 3-1/8 та min sink-base width 80 cm; thin/thick Solid Surface, Porcelain та HPL, Glass MT/GL також мають depth 52. Тому 578 — більш обґрунтований кандидат для порівняння, ніж 577/438, але shared SKU не доводить повної тотожності compatibility rules. Таблиця 578 також містить VA030 та повторювані material/basin pairs; це треба врахувати в Tricot allowlist і перевірці thickness behavior.

Checklist порівняння перед вибором таблиць:

1. Типи шаф, widths/depths/heights, drawers, handles, forced heights та дозволені композиції.
2. Для кожного material/basin — thicknesses, depth, minimum sink-base width, max top width та multi-cabinet behavior.
3. Правила side panels, кількість faucet holes, finish restrictions та інтегровані/накладні раковини.
4. Відповідність option value ↔ matrix token ↔ scene value ↔ SKU token.
5. Збіг фінальних manifest references, profile sourceRefs та matrix adapter ID.

Локальна cabinet table підтримується як тимчасове джерело замість remote cabinet table. Аналогічного manifest-поля для локальної countertop table зараз немає; це не слід непомітно припускати у плані.

## Ризики та необхідні розширення

### Presets

Назва `Tricot 63 1DW 3_60` не визначає, де Sink-Base, скільки Side-Cabinets і яка їхня ширина. Виводити BOM з номінальної ширини або копіювати Mako-композиції без джерела не можна. Список карток і фільтри можна отримати з CSV, але робочі presets потребують окремого mapping моделей на модулі.

Користувач підтвердив master CSV як список пресетів, надавши його окремо. Перелік із 42 models та їхні labels/style/size filters прийнято як джерело. Це закриває вибір переліку моделей; лишається mapping на presetProducts. Наприклад, `Tricot 40 1DW_40` і `Tricot 40 1DW 1_40` мають однакові width/style filters, тому лише ці поля не визначають різницю їхніх layouts. Рекомендовано перевірити можливість отримати склад із чинної Tricot 3D-сцени або експорту її моделей.

### Патерни

USH `DrawerPanelFluting` означає інші значення: None, vertical/horizontal A/B. Його правило зараз допускає всі options для будь-якого material з одного eligibleMaterials списку. Для Tricot потрібна інша поведінка: Loden тільки LACM; CAN/TWLL/GES/SAT тільки WDV. Просто розширити список eligible materials недостатньо; потрібні profile-driven правила на рівні окремих значень та validation/reset після зміни матеріалу.

Потрібно вибрати семантичне поле патерну та перевірити його command validation, availability, scene replay, save/restore і summary. Варіанти: окремий `CabinetPattern` або reuse `DrawerPanelFluting` із власними catalogs/rules, якщо це підтвердить продуктовий та scene-контракт. Generic scoped state вже підтримує атрибути поза legacy ownership map; legacy consumers усе одно треба перевірити. Рішення поки не прийнято.

### Кольори

У Tricot Handle Color показаний як Handle Groove Color. Рекомендований semantic candidate — HandleGrooveColor, однак mapping на scene key встановлюється з контракту сцени.

External optionsSource бере всі visible variants зазначеної configurator group. Сам факт підключення спільного configurator не забезпечує Tricot allowlist. При reuse каталогу потрібно перевірити відсікання чужих кольорів та збереження metadata для material/SKU, swatches і textures. За потреби додати загальний механізм обмеження зовнішнього каталогу, підтверджений поведінковими тестами.

### Бокові панелі

Master Yes/No не еквівалентний USH None/NoG/UpperG/CenterG/DoubleG. Книга підтвердила власний Tricot SP SKU та WDV/LACM prices. Існуючий sidePanel SKU contract дозволяє лише USH pricedAs, тому для власного Tricot side-panel SKU потрібне розширення schema/pricing builder. Ще необхідно підтвердити topology, pattern/material/color inheritance, quantity та зміну countertop width.

### 3D

У поточному локальному PlayCanvas export не знайдено Tricot-назв продуктів, asset або scripts; патерни Loden/Cannette/Twill/Gessato/Satin також не знайдено. Це не доводить відсутності Tricot в іншій чи майбутній сцені, але не дозволяє підтвердити її підтримку в наявному export.

Користувач підтвердив, що доступу до чинної Tricot 3D-сцени або її локального експорту немає. Отримання BOM через цей шлях наразі недоступне. Користувач погодив розподіл: наша частина — інтеграція manifest/UI/product rules/SKU у конфігураторі; підготовка Tricot 3D-сцени та складу 42 пресетів — окреме завдання його 3D/product-команди. PRD має визначити контракт передачі product types, scene keys/values, підтримуваних розмірів, BOM, зображень та матеріальних ідентифікаторів. Повне приймання залежить від обох частин.

Для приймання потрібні Tricot product types, підтримувані розміри, drawer/pattern/groove/panel keys і матеріальні identifiers. Bound values мають реально працювати; state-only допустимий лише для опцій, які за задумом не повинні змінювати 3D. Missing bindings не є заміною інтеграції.

### Pricing та readiness

Product master ProductID — `TRICOT`, підтверджений cabinet SKU series — `TRIC`. Нові builders уже переводять розміри у дюйми, як CabinetPricing, тоді як legacy USH cabinet builder використовує сантиметри. При external catalog reuse потрібно зберегти WDV material token, а не попередній WD з historical feedback у книзі. Shared countertop/basin prices та panel quantities ще слід довести для повного total.

Поточний shell readiness gate перевіряє наявність configurator catalog; це не гарантує непорожні BOM, повні bindings або точні ціни. Потрібні окремі acceptance checks. При неповному ціноутворенні використовувати явні pricing gaps і не показувати повну ціну як підтверджену.

## Рекомендовані модулі та послідовність робіт

Використати наявні глибокі модулі: collection loader/validation, profile-driven rule core, runtime translator та collection SKU/pricing builders. Новий engine для Tricot не потрібен. Якщо формування JSON автоматизується, імпортер master → нормалізований Tricot catalog варто зробити окремою чистою трансформацією з простим входом/виходом.

| Етап                                   | Результат                                                                                          | Залежність / критерій завершення                                                      |
| -------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 1. Закрити джерела                     | Доступний SKU workbook, BOM 42 моделей, продуктова специфікація, scene contract, owners та API IDs | Підтверджені джерела замість висновків із назв                                        |
| 2. Узгодити scope та PRD               | Склад модулів, prebuilt/custom scope, потрібні інтеграційні/browser тести, критерії приймання      | Уточнення grill-me завершені; записати `plans/tricot-integration.prd.md` через to-prd |
| 3. Нормалізувати дані                  | Catalog values, aliases, matrix mappings, матеріальні та SKU tokens                                | Однозначна відповідність між master, API, scene та workbook                           |
| 4. Зібрати package                     | Manifest/profile/UI/presets/runtime/SKU/assets                                                     | Валідний package і 42 підтверджених compositions                                      |
| 5. Додати потрібні загальні розширення | Pattern availability, remote allowlists, own panel pricing, якщо необхідно                         | Поведінка спирається на затверджені правила; без hardcoded Tricot UI branches         |
| 6. Перевірити prebuilt та custom       | Вибір моделі, редагування, panels, basins, invalidation, navigation, save/restore, summary         | Інтерфейс, state та scene узгоджені                                                   |
| 7. Звірити SKU та prices               | Еталонні cabinet/top/basin/panel lines і quantities                                                | SKU workbook + реальні pricing API відповіді                                          |
| 8. Приймання та regression             | Готовий flow та доказ відсутності регресій інших колекцій                                          | TypeScript/lint/relevant tests/build та browser smoke із Tricot scene                 |

## Перевірки та тестовий план

Рекомендовано перевіряти зовнішню поведінку, а не структуру implementation. Existing examples: collection contract tests, Mako preset compositions, runtime bindings, placed cabinet rules, collection SKU/pricing tests, generic fields та save/restore tests.

- Package: IDs, references, профіль/UI/runtime alignment, наявність картинок та default preset.
- Presets: усі 42 source models мають стабільні ID, коректні style/size filters, повний BOM, правильний порядок модулів і кількість basin positions.
- Rules: 1DW/2DW/1DWID, pattern/material combinations, invalidation після зміни кольору, panel availability та countertop constraints.
- Catalogs: тільки 23 cabinet colors, 20 groove colors та дозволені countertop values згідно з узгодженою версією джерела; чужі API variants не потрапляють у Tricot.
- Runtime: правильні product types, targets, patches і reset/order; pattern, groove та panels реально змінюють потрібні частини сцени.
- Pricing: еталонні SKU для матеріалів/патернів, units, top thickness, panels і quantities; unresolved groups не видаються за повний total.
- State: Tricot-specific attributes, collection identity і порядок шаф переживають save/restore та undo/redo.
- Integration/browser: prebuilt/custom happy path, асиметрична композиція, double basin, 1DWID, invalid selection, збереження/відновлення і regression інших колекцій.

Поточна baseline-перевірка:

- `npm run tsc` — успішно.
- Чотири suites: collectionContracts, makoPresets, collectionSkus, collectionPricing. 93 тести: 92 пройшли, 1 падає.
- Existing failure: `collectionPricing.test.ts`, `prices a Class model before a colour is chosen, from the collection's defaults`. Очікування тесту ще описує front 326/glass countertop, а поточні Class defaults містять INVISIBLE WHITE LUCIDO 334. Actual cabinet line також не містить CABF. Це зафіксований baseline failure; причина всієї розбіжності окремо не діагностована і fix у межах аудиту не виконувався.
- Повний test suite, lint, build та browser flow Tricot на цьому етапі не перевірялися. Tricot package ще не створено.

## Узгоджені рішення та залежності реалізації

Доступ до SKU workbook закрито наданим XLSX. Користувач погодив відповідальність команд, обидва сценарії, групування кроків, склад модулів та тестування; PRD має бути англійською. [Tricot Integration PRD](tricot-integration.prd.md) фіксує погоджений обсяг.

Узгоджено: перелік 42 моделей береться з master CSV; їхній BOM і 3D-сцену готує 3D/product-команда користувача. Відсутність цих ресурсів зараз — явна залежність реалізації, а не привід вигадувати композиції або відкладати написання PRD.

1. Фінальні configurator/DataTable IDs — залежність від користувача, який виконує порівняння/публікацію. Cabinet 439 відхилено без змін; countertop 578 — кандидат для перевірки, а не затверджений Tricot source.
2. Правила groove, side-panel topology/quantity/inheritance, composition mixing та shared countertop details — визначити, які з них є умовами product handoff. Pattern/material і cabinet module dimensions уже підтверджені книгою.
3. Обидва сценарії prebuilt/custom та групування кроків погоджено. Стартову конфігурацію і default preset визначити з підтвердженими catalogs/BOM та product handoff; такі дані є умовами приймання, а не вигаданими значеннями для завершення PRD.
4. Склад модулів погоджено: пакет Tricot, product compatibility rules, runtime bindings, SKU/pricing. Погоджено unit-тести rules/SKU, integration checks loader/UI/state/runtime/save-restore та browser-перевірки обох сценаріїв після отримання сцени.

Urban Freestanding врахована лише як контекст спільної перевірки DataTables. Її інтеграція не включена в поточний план Tricot. Публікація API-таблиць лишається за користувачем відповідно до вихідного повідомлення.
