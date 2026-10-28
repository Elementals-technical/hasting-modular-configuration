# Drawer organizers Ph2 (Class, Mako, Lame): UI

Цей документ описує, як у конфігураторі пропонуються, редагуються, оцінюються і відновлюються органайзери шухляд Ph2 (лотки ROW-MTL-43): які дані вмикають фічу, де живе стан, як проходить команда до сцени, як рахується ціна, які тести й фікстури її тримають. Правила розкладки (місткість, заблоковані зони, кандидати на слоти) живуть у 3D; UI їх не дублює і лише читає те, що записала сцена.

Рішення, що лишилися відкритими, зібрані в розділі 8. Tricot у цей реліз не входить (Q-K12): його дані не змінені, фіча для нього вимкнена.

## 1. Що це і чим відрізняється від USH-дівайдерів

У застосунку дві системи органайзерів, і це свідоме рішення (R8 концепту): USH-дівайдери не чіпаються, Ph2 живе поруч у власному модулі. Вибір робить один прапорець профілю (розділ 2).

| | USH-дівайдери (Urban Standard Height, Freestanding, Low Height, Duplex) | Ph2-органайзери (Class, Mako, Lame) |
| --- | --- | --- |
| Модель | зони-дівайдери в слотах шухляди; один стиль `DividersStyle` на шухляду | колонки-лотки: `slot` (підписаний крок 10 см від центру шухляди) і `positions` 1–5 (не більше `maxActive` профілю: 5 з 28.10, раніше 2 = комплект); стиль на шухляду |
| Ключ сцени | `TopDrawerDividers` / `BotDrawerDividers` ([`dividerSceneConfig.ts`](../src/features/dividers/adapter/dividerSceneConfig.ts)) | `DrawerOrganizers`, версія 1 ([`drawerOrganizers.ts`](../src/entities/configuration/model/drawerOrganizers.ts)) |
| API до сцени | `setVisibleDrawerButtons` і віджети шухляд `installDrawerWidgets` ([`useDividersState.ts`](../src/widgets/AccessoriesSections/lib/useDividersState.ts)) | `ConfiguratorAPI.organizers` і `organizersOverlay` ([`organizers.ts`](../src/features/configuratorApi/organizers.ts)) |
| UI-фіча | [`features/dividers`](../src/features/dividers/index.ts) | [`features/drawerOrganizers`](../src/features/drawerOrganizers/model/rules.ts) |
| Рядок ціни | USH: `divider:<cabinet>:<index>` ([`buildPricingLines.ts`](../src/shared/lib/pricing/buildPricingLines.ts)); UF/ULH/UD: `divider:<cabinetId>:<drawerType>`, кількість 1 | `divider:<stableKey>:<Top\|Bot>`, кількість = колонки ([`organizerLines.ts`](../src/shared/lib/pricing/organizerLines.ts)) |

## 2. Як колекція вмикає фічу

Фічу вмикають лише дані колекції, коду для нової колекції писати не треба. Єдиний гейт у UI: `readOrganizerRules(profile) !== null` ([`rules.ts`](../src/features/drawerOrganizers/model/rules.ts)). Профіль, якого таблиця не знає, закриває фічу й пише `console.warn`.

| Де | Що | Файл (приклад Class) |
| --- | --- | --- |
| `ruleData.drawerOrganizers {profile}` | прапорець і id профілю (`ROW-MTL-43`); тип і розбір секції | [`product-profile.json`](../public/collections/class/product-profile.json), [`parseProductProfile.ts`](../src/entities/collection/lib/parseProductProfile.ts) |
| Атрибут `DividersOption` (None / Customize) | вибір на сторінці; лише UI, у сцену значенням не йде | [`product-profile.json`](../public/collections/class/product-profile.json) |
| `DividersStyle` (Metal / Oak) | каталог стилів на шухляду; Oak у v1 недоступний (Q-K3) | там само |
| `messages.organizer.*` (14 ключів) | тексти підказок, тостів і причин | там само; мапи кодів у [`messages.ts`](../src/features/drawerOrganizers/model/messages.ts) |
| Крок `accessories` у flows, секція `dividers`, блок `drawerOrganizers {panelTitle, mobileLayout}` | сторінка й заголовок панелі, режим mobile | [`ui.json`](../public/collections/class/ui.json), [`validateCustomizationSchema.ts`](../src/entities/collection/lib/customization/validateCustomizationSchema.ts) |
| `dividers {Metal, Oak}` і gap `divider` | SKU колонки за стилем | [`sku-profile.json`](../public/collections/class/sku-profile.json) |
| `runtime-bindings.json` | `DividersOption` і `DividersStyle` лишаються `unbound`; причина вказує на `ConfiguratorAPI.organizers` | [`runtime-bindings.json`](../public/collections/class/runtime-bindings.json) |

Чекліст «нова колекція = лише дані»:

1. У `product-profile.json`: `ruleData.drawerOrganizers`, `DividersOption`, `DividersStyle`, 14 повідомлень `organizer.*`.
2. У `ui.json`: крок `accessories` у потрібних flows, секція `dividers` із полем `DividersOption`, блок `drawerOrganizers`.
3. У `sku-profile.json`: `dividers` зі SKU стилю. Без SKU ціна дає блокуючий gap (розділ 6).
4. У `runtime-bindings.json`: обидва атрибути `unbound` з причиною.
5. У 3D колекція має мати профіль органайзерів (поза цим документом); таблиця профілю в UI — [`presets.ts`](../src/features/drawerOrganizers/model/presets.ts).

Дані трьох колекцій покриває [`drawerOrganizersData.test.ts`](../src/entities/collection/__tests__/drawerOrganizersData.test.ts). USH-колекції і Tricot без прапорця: `readOrganizerRules` дає `null`.

## 3. Стан

| Шар | Де | Що |
| --- | --- | --- |
| Сцена (SSOT) | ключ `DrawerOrganizers` в `productConfig` продукту | пише лише 3D власними командами; UI його не пише через `setConfig*` |
| Read-model | `configuration.organizersByCabinet[stableKey]` ([`slice.ts`](../src/entities/configuration/model/store/slice.ts)) | `DrawerOrganizersRead`: `absent`, `ok`, `unsupported-version`, `malformed`; наповнюється квитанціями команд і сцено-рідером |
| Зріз UI | `drawerOrganizersUi` ([`slice.ts`](../src/features/drawerOrganizers/model/store/slice.ts)) | `view`, `selected`, `panel` (`closed`, `presets`, `editor`), `draft`, `pendingStyle`, `derived`, `busy`, `notice`; не зберігається й не входить у відбиток історії |
| Похідне | `selectEffectiveDividersOption` ([`selectors.ts`](../src/features/drawerOrganizers/model/store/selectors.ts)) | `DividersOption` показується як `Customize`, поки в read-model є колонки (і після restore); назад не записується |

- Ключ `DrawerOrganizers` перелічений у `sceneOwnedKeys` ([`resolveProductConfig.ts`](../src/entities/collection/lib/runtimeBindings/resolveProductConfig.ts)), тож strict-колекція його не відкидає.
- Сцено-рідер додає поле `organizers` лише для продукту, що має ключ; форма USH не змінилась ([`createSceneReader.ts`](../src/features/playCanvasAdapter/lib/createSceneReader.ts)).
- Read-model чиститься за `stableKey` при видаленні й перебудові тумб, а `restoreCabinets` його скидає ([`slice.ts`](../src/entities/configuration/model/store/slice.ts)).
- У save / undo нічого нового немає: ключ `DrawerOrganizers` є частиною конфігу продукту й відновлюється разом із ним (`sceneOwnedKeys`), а після restore й undo рідер заново читає його, і read-model наповнюється з відновленої сцени ([`restoreSnapshot.ts`](../src/entities/history/lib/restoreSnapshot.ts)).
- Зріз скидається на `setIsDrawerOpen(false)`, `removeProductId`, `restoreProductState`, `resetProducts`; на `setHistoryRestoring(true)` скидається лише вибір і чернетка.

## 4. Потоки

**Команда і крок історії.** Кожна зміна сцени йде через [`changeDrawerOrganizers`](../src/features/configurationCommands/lib/changeDrawerOrganizers.ts): `addColumn`, `removeColumn`, `setColumnLayout`, `setStyle`, `clear`. Команда перекладає `stableKey` у runtime id, шле її через порт ([`createOrganizerPort.ts`](../src/features/playCanvasAdapter/lib/createOrganizerPort.ts)) і записує відповідь сцени в read-model. Власних значень і історії вона не пише: виклик обгорнутий у `runStep(() => changeDrawerOrganizers(…), isApplied)` ([`useHistoryStep.ts`](../src/entities/history/lib/useHistoryStep.ts)), тож крок історії є лише для відповіді `applied` або `partial`. Відхилену команду нічого не записує. Усередині `runStep` викликається тільки ця команда й `CommandRunner.change`.

**Чернетка і прев'ю.** Редактор позицій — схема лотка, а не цифри (рішення Андрія 28.10 після першої браузерної перевірки: кнопка «k» читалась як «де стінка», а це U-вкладиш у комірці k з двома стінками по краях; у комірок 1 і 5 стінка одна, другий край — торець лотка). Лоток малюється так само, як у картці ([`ColumnSchematic`](../src/features/drawerOrganizers/ui/ColumnSchematic.tsx), viewBox 100 × 430, задня стінка зверху; у смузі M2 лоток лежить горизонтально, Back ліворуч), п'ять комірок однакової довжини з пунктирними межами; кожна комірка — кнопка з `aria-label="Cell k of 5"` і `aria-pressed`, натиснута підсвічена акцентом, а суцільні стінки дає той самий `schematicLines`, що й для карток. Над схемою лічильник «Inserts N of M» (M = `maxActive` профілю, 5 з 28.10), під нею підказка «Each insert splits the tray with two walls. Up to M per column.» (у смузі M2 — лише лічильник, підказка є його `title` і `aria-describedby` групи). Коли вставок стільки, скільки дозволено, решта комірок `disabled`. Поки редактор відкритий, 3D-оверлей підсвічує в кадрі комірки чернетки виділеної колонки: `DrawerOrganizerLayer` передає `draftCells` (`draft` зі стору в панелі `editor`, інакше `null`), оверлей заливає полігони `column.cells[k - 1]` (`data-draft-cell`), а власну заливку виділеної колонки на цей час вимикає. Чернетка показує зміну прев'ю й тримається в `draft`, у сцену вона йде лише при Save або неявному виході (інший акордеон, Next, Close Drawer). Back скасовує чернетку без кроку. Пресет застосовується одним кроком; колонка лишається виділеною, а список пресетів відкритим (рішення Андрія 28.10 після першої браузерної перевірки — спершу панель закривалась). Save повертає до списку пресетів з активною карткою «Customize/Custom» або збігом. Busy-прапорець у Redux пропускає один виклик за раз ([`useOrganizerEditor.ts`](../src/features/drawerOrganizers/lib/useOrganizerEditor.ts)).

**Підписки.** Єдина точка, де UI слухає сцену, — [`useOrganizerRuntime.ts`](../src/features/drawerOrganizers/lib/useOrganizerRuntime.ts): `change` оновлює read-model і `derived`, `view` віддзеркалюється в `isDrawerOpen`, кадри йдуть у [`organizerOverlayStore.ts`](../src/features/drawerOrganizers/lib/organizerOverlayStore.ts), тап повз шухляду обробляється як перехід стану. Зміна розміру чи шухляд, що не прибирає колонок, не дає `change` (місткість і наявність шухляди в `derived` могли змінитись), тому хук читає продукт через `getState` ще раз, коли змінюється його ключ `Width|Height|Drawers` (`selectOrganizerInputKeys`; `InnerDrawer` у Class іде лише через токен `Drawers`); відкриття секції Drawer Dividers перечитує всі продукти через `list()`. Колекції без прапорця не підписуються ні на що і нічого не читають.

**Restore і undo.** Undo й redo перебудовують сцену зі знімка; чернетка скидається й не пишеться. Після restore хук перечитує всі продукти й робить одноразовий `getState` для кожної нової пари runtime id / stable key.

**Зміни розмірів.** Ширина, висота, шухляди і SB↔SC можуть прибрати колонки: 3D нормалізує стан і повертає корекції `dropped`. UI показує тост із тексту профілю (`organizer.trimmed`, `organizer.columnRemoved`, `organizer.typeChanged` та інші, мапа в [`messages.ts`](../src/features/drawerOrganizers/model/messages.ts)) і підказку про Undo. Діалогу перед зміною немає (Q-K6). Для Ph2 обхід вимкнено: `applySetWidth` у [`PlayCanvasIntegration.tsx`](../src/widgets/Player/components/PlayCanvasIntegration/PlayCanvasIntegration.tsx) при `organizersEnabled` не викликає `clearDividersForWidthResize` і нічого не відновлює після зміни ширини: колонки лишає або прибирає 3D, а відповідь `change` оновлює read-model.

## 5. Компоненти й лейаут

| Компонент | Роль |
| --- | --- |
| [`DrawerOrganizerLayer`](../src/features/drawerOrganizers/ui/DrawerOrganizerLayer.tsx) | контейнер у `PlayCanvasIntegration`: `useOrganizerRuntime`, оверлей, тост `OrganizerNotice` (`role="status"`, закривається за 5 с, зона — 2,5 с) |
| [`OrganizerCanvasOverlay`](../src/features/drawerOrganizers/ui/OrganizerCanvasOverlay.tsx) | шар `inset:0` з `pointer-events:none` над 3D: пілюлі Open Drawer, кнопки ⊕ в кандидатах, області колонок (у редакторі — підсвічені комірки чернетки виділеної колонки), заблокована зона ⊘, Close Drawer і перемикач Top / Bottom |
| [`DividerOptionsPanel`](../src/features/drawerOrganizers/ui/DividerOptionsPanel.tsx) | панель Divider Options у `Player`: список (Customize, Empty, Preset 1–4, Remove column) або редактор позицій (схема лотка з 5 комірками) зі Save |
| [`PresetList`](../src/features/drawerOrganizers/ui/PresetList.tsx), [`PresetCard`](../src/features/drawerOrganizers/ui/PresetCard.tsx), [`ColumnSchematic`](../src/features/drawerOrganizers/ui/ColumnSchematic.tsx), [`PositionsEditor`](../src/features/drawerOrganizers/ui/PositionsEditor.tsx) | чисті компоненти з props |
| [`OrganizerAccessories`](../src/widgets/AccessoriesSections/ui/OrganizerAccessories.tsx) | секція Drawer Dividers на сторінці Accessories: None / Customize, підказка, лічильник колонок; чипи стилю лише за двох доступних стилів |

- Розгалуження на `AccessoriesPage`: фіча ввімкнена — `OrganizerAccessoriesPage`, інакше `LegacyAccessoriesPage` (той самий хук і та сама розмітка), бо USH-хуки реєструють колбеки сцени одразу при монтуванні. Ознаку «фіча ввімкнена» сторінка рахує з профілю колекції в контексті (`readOrganizerRules`), а не зі стору: стор отримує профіль в ефекті вже після першого рендеру, і при холодному завантаженні одразу на Accessories перший коміт став би Legacy. Обидві гілки — тонкі обгортки над спільним `AccessoriesAccordions` (окремі компоненти потрібні через правила хуків).
- Лейаут: desktop (>1024 px) — панель 160 px ліворуч, `setViewInsets` зсуває вид, `--player-left-inset` зсуває нижній тулбар. Mobile: типовий M2 (нижня смуга 72 px), M1 (рейка 96 px і вища зона 3D) лише при `mobileLayout: "M1"` у `ui.json` та не в низькому чи ландшафтному вікні; режим визначає `matchMedia` і кладе в `setPanelLayout`. `setViewInsets` у 3D вимагає всі чотири ключі.
- Схема колонки в картці малюється з коду, а не з картинок: [`cellsCodec.ts`](../src/features/drawerOrganizers/model/cellsCodec.ts) за позиціями дає стінки лотка (`wallsOf`) і лінії схеми. Кодек потрібен лише для SVG; зони, місткість і кандидати рахує 3D.
- Доступність: цілі ⊕, колонок, пілюль і комірок редактора не менші за 44 px (невидима hit-area), кнопки мають `aria-label`, `aria-pressed`, `aria-busy`; список пресетів — `radiogroup`; панель — `aside` із заголовком, що отримує фокус при відкритті.
- Клавіатура: Esc у редакторі — Back, у списку знімає вибір; Delete / Backspace у списку видаляє колонку; Tab іде зліва направо за `center.x`.

## 6. Ціна, Summary, квота

**Гілка в `buildCollectionPricingLines`.** Крок «4) Organizers» ([`buildCollectionPricingLines.ts`](../src/shared/lib/pricing/buildCollectionPricingLines.ts)) залежить від профілю. Якщо `readOrganizerRules(profile)` не `null`, органайзери оцінюються з read-model `organizersByCabinet` (його додає [`usePricingInput.ts`](../src/shared/hooks/usePricingInput.ts)) через `buildOrganizerLines`. Інакше виконується чинний блок з `DividersStyle`, без змін. Порядок рядків не міняється: органайзери стоять на місці старого кроку, після ніг і перед рушникотримачем. Подвійного рахунку немає, бо для Ph2 старий блок не виконується, а значення `DividersStyle` у конфігурації ігноруються.

**Правила `buildOrganizerLines`** ([`organizerLines.ts`](../src/shared/lib/pricing/organizerLines.ts)):

| Випадок | Результат |
| --- | --- |
| Шухляда з колонками | один рядок, `quantity` = кількість колонок, SKU зі `sku-profile.dividers` за стилем |
| Empty (колонка без вставок) | платна: `ORGANIZER_BILL_EMPTY_COLUMNS = true` (Q-K2) |
| Тумба без органайзерів (`absent`) | нічого |
| Дані не читаються (`unsupported-version`, `malformed`) | один блокуючий gap `divider`, рядка немає; ніколи не рахується як порожньо |
| Стиль без SKU | рядка немає, один блокуючий gap на стиль |
| Oak | 3D його не пропонує (`organizer.oakPending`, Q-K3); SKU Oak лишається в `sku-profile` |
| Tricot | фіча вимкнена, `dividers: {}`; Q-K12 і Q-N2 |

**Gap `divider` зі `sku-profile`** (`appliesWhen: DividersStyle`, не блокує total) лишається, поки замовлення має органайзери: для Ph2 `usedValuesOf("DividersStyle")` повертає стилі наборів read-model, а не значення конфігурації. Gap знімуть після підтвердження ціни колонки (Q-K1, Q-N1).

**Summary.** [`summaryOrganizerItems.ts`](../src/shared/lib/pricing/summaryOrganizerItems.ts) будує по елементу «Drawer Organizer» на рядок ціни: стиль, шухляда, кількість колонок, розмір лотка 3.9″ × 2″ × 16.9″ і номер тумби, якщо їх кілька. Підключено на обох сторінках Summary: [`custom/summary/index.tsx`](../src/pages/custom/summary/index.tsx) і [`prebuilt/summary/SummaryPage.tsx`](../src/pages/prebuilt/summary/SummaryPage.tsx); сторінка бере рядки ціни з `pricingLines` і оцінює елемент як `priceOfLines([line], line.quantity)`. Квота не має колонки кількості, тож колонки видно лише в підписі (Q-N4).

**Еталонне замовлення.** Сценарій `mako-vessel-with-legs` ([`collectionPricingScenarios.ts`](../src/shared/lib/pricing/__tests__/fixtures/collectionPricingScenarios.ts)) містить дві Metal-колонки на SB 60: рядок `divider:mko-sb:Top` × 2, SKU `VAN-GBDIV-MTL-3.9W-2H-16.9D`. Очікуваний total: 10063 − 150 + 2 × 170 = 10253, статус `partial` (Iris без кольору). Відповіді сервера записує лише інструмент [`recordPriceFixtures.test.ts`](../src/shared/lib/pricing/__tests__/recordPriceFixtures.test.ts), вручну файл не правиться. Поки у записаному файлі немає відповіді на SKU замовлення, дві перевірки проти нього пропускаються ([`collectionPricing.test.ts`](../src/shared/lib/pricing/__tests__/collectionPricing.test.ts)).

## 7. Тести й фікстури

| Область | Тести |
| --- | --- |
| Модель | [`presets`](../src/features/drawerOrganizers/__tests__/presets.test.ts), [`cellsCodec`](../src/features/drawerOrganizers/__tests__/cellsCodec.test.ts), [`positionsEditor`](../src/features/drawerOrganizers/__tests__/positionsEditor.test.ts), [`messages`](../src/features/drawerOrganizers/__tests__/messages.test.ts), [`rules`](../src/features/drawerOrganizers/__tests__/rules.test.ts), [`matrixProducts`](../src/features/drawerOrganizers/__tests__/matrixProducts.test.ts) |
| Контракт з 3D | [`organizersContract`](../src/features/configuratorApi/__tests__/organizersContract.test.ts), [`organizersBridge`](../src/features/configuratorApi/__tests__/organizersBridge.test.ts), [`createOrganizerPort`](../src/features/playCanvasAdapter/__tests__/createOrganizerPort.test.ts) |
| Стан і команда | [`organizersReadModel`](../src/entities/configuration/model/__tests__/organizersReadModel.test.ts), [`changeDrawerOrganizers`](../src/features/configurationCommands/__tests__/changeDrawerOrganizers.test.ts), [`uiSlice`](../src/features/drawerOrganizers/__tests__/uiSlice.test.ts), [`readDrawerOrganizers`](../src/entities/configuration/model/__tests__/drawerOrganizers.test.ts) (парсер), [`resolveProductConfigOrganizers`](../src/entities/collection/lib/runtimeBindings/__tests__/resolveProductConfigOrganizers.test.ts), [`createSceneReaderOrganizers`](../src/features/playCanvasAdapter/__tests__/createSceneReaderOrganizers.test.ts), хуки [`useOrganizerEditor`](../src/features/drawerOrganizers/__tests__/useOrganizerEditor.test.tsx), [`useOrganizerRuntime`](../src/features/drawerOrganizers/__tests__/useOrganizerRuntime.test.tsx), [`useOrganizerSection`](../src/features/drawerOrganizers/__tests__/useOrganizerSection.test.tsx) |
| Ціна й Summary | [`organizerLines`](../src/shared/lib/pricing/__tests__/organizerLines.test.ts), [`collectionOrganizerPricing`](../src/shared/lib/pricing/__tests__/collectionOrganizerPricing.test.ts), [`summaryOrganizerItems`](../src/shared/lib/pricing/__tests__/summaryOrganizerItems.test.ts), [`collectionPricing`](../src/shared/lib/pricing/__tests__/collectionPricing.test.ts) |
| Дані колекцій | [`drawerOrganizersData`](../src/entities/collection/__tests__/drawerOrganizersData.test.ts) |
| Компоненти | [`ColumnSchematic`](../src/features/drawerOrganizers/__tests__/ColumnSchematic.test.tsx), [`OrganizerPanelParts`](../src/features/drawerOrganizers/__tests__/OrganizerPanelParts.test.tsx) (`PresetList`, `PositionsEditor`), [`DividerOptionsPanel`](../src/features/drawerOrganizers/__tests__/DividerOptionsPanel.test.tsx), [`OrganizerCanvasOverlay`](../src/features/drawerOrganizers/__tests__/OrganizerCanvasOverlay.test.tsx), [`DrawerOrganizerLayer`](../src/features/drawerOrganizers/__tests__/DrawerOrganizerLayer.test.tsx), [`OrganizerAccessories`](../src/widgets/AccessoriesSections/__tests__/OrganizerAccessories.test.tsx), [`AccessoriesPage`](../src/pages/accessories/__tests__/AccessoriesPage.test.tsx) |

- Фікстури контракту лежать у [`fixtures/contract`](../src/features/drawerOrganizers/__tests__/fixtures/contract/manifest.json). Це побайтова копія канону з 3D-репо (`tests/node/fixtures/drawer-organizers/`), правити її не можна: зміна йде спершу в канон з новим `fixtureRevision`, потім копіюються 8 файлів.
- Hash-тест [`contractFixtures.test.ts`](../src/features/drawerOrganizers/__tests__/contractFixtures.test.ts) порівнює sha256 кожного файла з маніфестом; ту саму ревізію перевіряє тест у 3D.
- Регресійний набір USH (`regressionLines`, `regressionPrices`, `ushSkuParity`, `buildPricingLines`, `features/dividers/**`) цією фічею не змінювався. Для UF, ULH і UD є `toEqual`-перевірка в `collectionOrganizerPricing.test.ts`: рядки й gaps з read-model і без нього однакові.
- Запуск лише цієї області: `npx vitest run src/features/drawerOrganizers src/features/configuratorApi src/features/playCanvasAdapter src/features/configurationCommands src/shared/lib/pricing src/entities/collection src/entities/configuration src/widgets/AccessoriesSections src/pages/accessories`.

## 8. Відкриті питання, що стосуються UI

Дефолти взято з концепту §10; поки відповіді немає, діє дефолт.

| Питання | Хто | Дефолт у коді |
| --- | --- | --- |
| Q-K1 ціна: $170 за колонку-лоток | Ryan | 170 за колонку; gap `divider` не блокує total |
| Q-K2 Empty платна | Ryan | так, `ORGANIZER_BILL_EMPTY_COLUMNS = true` |
| Q-K3 Oak: окремий продукт чи матеріал | Ryan | вимкнено, `organizer.oakPending` |
| Q-K6 при зміні розміру: тост чи діалог | Ryan | тост з Undo |
| Q-K12 Tricot у релізі | Ryan | ні; дані Tricot не змінені |
| Q-N1 рядок ціни: кількість = колонки, id `divider:<cabinet>:<drawer>` | Назар | так |
| Q-N2 SKU для Tricot | Назар | немає SKU, а значить блокуючий gap |
| Q-N4 поле `quantity` у `getSummarySkuJson` | Назар | немає, кількість у підписі |
| Q-D7 mobile: M1 чи M2 | дизайнер | M2, M1 за прапорцем `mobileLayout` |
| Q-D9 авто-вибір нової колонки | дизайнер | ні |
| Q-D10 тексти (назва акордеона, картки, tooltip) | дизайнер | тексти з `messages.organizer.*` |
| Q-O5 SB↔SC: переносити ключ у новий продукт | Олег | ні |
| Q-O6 Tricot: форк `AccessoriesPage` і SidePanels | Олег | відкладено разом із Tricot |

Ризики стану, відомі з WP-6: якщо 3D для ключа новішої версії поверне `state: null` без діагностики `UNSUPPORTED_VERSION`, UI запише `absent`, і ціна не побачить проблеми; після SB↔SC з новим `stableKey` тост `typeChanged` не показується.

## Межі v1

- Oak вимкнений (Q-K3): чипи вибору матеріалу показуються лише за двох доступних стилів, тож у v1 їх немає (`showStyles` у [`useOrganizerSection.ts`](../src/features/drawerOrganizers/lib/useOrganizerSection.ts)).
- Органайзери не потрапляють на знімки, в AR і в квоту з колонкою кількості (Q-K10, Q-A5, Q-N4).
- Внутрішня шухляда моделей 1+inner органайзерів не має (Q-K5); зони, де аркуш клієнта не збігається зі сценою, блокуються за аркушем (Q-K4).
- Орбіта у виді шухляди не блокується; анімація відкриття шухляди чекає v1.1.
- Tricot виключений до відповіді на Q-K12: у нього немає прапорця, SKU і секції.
- Лотки видно лише у виді шухляди; в загальному вигляді їх на сцені немає.

