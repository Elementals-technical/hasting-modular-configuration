# Логіка Side Panel

Цей документ описує, як працюють `Side Panels` у Hastings modular configurator: які є стани, правила доступності, помилки/попередження для користувача, автоматичне видалення/відновлення та файли, де це реалізовано.

## Що таке Side Panel

`Side Panel` - це бокова декоративна/фінішна панель, яка встановлюється на видимий лівий або правий край vanity. Вона не встановлюється на внутрішні тумби. У UI вона налаштовується в кроці `Accessories -> Side Panels`.

Доступні опції:

| Назва в UI | Значення в state | Значення |
| --- | --- | --- |
| `None` | `None` | Без side panel |
| `No groove` | `NoG` | Side panel без groove |
| `1 groove (upper)` | `UpperG` | Side panel з верхнім groove |
| `1 groove (central)` | `CenterG` | Side panel з центральним groove |
| `2 grooves` | `DoubleG` | Side panel з двома grooves |

Реалізовано тут:

- [Custom side panel options](../src/pages/custom/accessories/constants.ts)
- [Prebuilt side panel options](../src/pages/prebuilt/accessories/constants.ts)

## State model

Стан Side Panel зберігається в Redux у `productOptions`.

| Поле | Можливі значення | Для чого потрібно |
| --- | --- | --- |
| `SidePanels` | `""`, `None`, `NoG`, `UpperG`, `CenterG`, `DoubleG` | Поточний вибраний тип/groove side panel |
| `SidePanelLeft` | `active`, `none`, `auto-removed` | Статус лівої сторони |
| `SidePanelRight` | `active`, `none`, `auto-removed` | Статус правої сторони |

Значення статусів:

| Статус | Значення |
| --- | --- |
| `active` | Side panel встановлена на цій стороні |
| `none` | Side panel немає; зазвичай користувач видалив її вручну |
| `auto-removed` | Система автоматично прибрала side panel, бо сторона тимчасово стала невалідною |

`SidePanels` зберігає лише вибраний groove. Сторони (`SidePanelLeft`/`SidePanelRight`) керуються окремо — apply йде через explicit `SidePanelSide` (`left`/`right`/`both`), а не legacy `cabinetId`.

Реалізовано тут:

- [Redux product state](../src/entities/product/model/store/slice.ts)
- [Side panel selectors](../src/features/sidePanel/model/selectors.ts)
- [PlayCanvas side panel bridge](../src/utils/functions/playcanvas/sidePanels.ts)

### Reason codes

Причини недоступності мають структурований `reasonCode` (для control flow) поряд із текстовим `reason` (presentation). Не порівнювати причини по рядку — використовувати `reasonCode`.

| `reasonCode` | Коли |
| --- | --- |
| `syntesi-countertop` | countertop material містить `Syntesi` |
| `open-shelf` / `side-shelf` | вибраний край є `OS` / `OSS` (для fallback-логіки) |
| `both-open-shelf` / `both-side-shelf` / `mixed-open-side-shelf` | обидва краї заблоковані (OS+OS / OSS+OSS / змішано) |
| `length-340` | cabinet-only total = 340 cm |
| `exceeds-max-length`, `unsupported-groove`, `select-edge-cabinet` | зарезервовано (поки не прив'язано до option-level/notice) |

Реалізовано тут:

- [SidePanelReasonCode + reasonCode](../src/features/configurator-rule-core/options/types.ts)
- [isShelfSidePanelReasonCode](../src/features/sidePanel/lib/sidePanelEdgeCompatibility.ts)

## Типи тумб для Side Panel

Правила нормалізують product/cabinet name у групи.

| Група | Типи тумб | Чи можна ставити Side Panel |
| --- | --- | --- |
| `SBSC` | `Sink-Base`, `Sink-Cabinet`, `Side-Cabinet` | Так |
| `OS` | `Open-Shelf` | Ні |
| `OSS` | `Side-Shelf` | Ні |

`mapCabinetTypeToGroup` нормалізує назву case-insensitively і також приймає скорочені коди: `sb`, `sc`, `sbsc` -> `SBSC`; `os` -> `OS`; `oss` -> `OSS`. Тобто матчаться не тільки повні назви типів.

Реалізовано тут:

- [mapCabinetTypeToGroup](../src/features/sidePanel/model/selectors.ts)

## Основний flow вибору Side Panel

1. Користувач відкриває `Accessories -> Side Panels`.
2. Сторінка бере selected cabinet і поточний порядок продуктів.
3. Сторінка читає актуальні крайні тумби через `getEdgeCabinets()` **в effect-і після осідання сцени** (не під час рендеру), keyed на `compositionVersion` — щоб не показати stale edge state (див. «Move/Add/Reorder synchronization»).
4. UI визначає, чи selected cabinet є лівою або правою edge cabinet.
5. UI рахує доступні Side Panel options з урахуванням висоти, drawer type, handle/groove, countertop material, edge cabinets і max countertop length.
6. UI рахує `block` / `notice` через data-driven реєстр причин (див. «Реєстр причин») і `targetSide` (`left`/`right`/`both`/`null`).
7. UI рахує side-aware `activeValue`: для `left` показує статус лівої панелі, для `right` — правої, для `both` активним є будь-який активний side.
8. Користувач вибирає `None`, `NoG`, `UpperG`, `CenterG` або `DoubleG`.
9. `handleSidePanelsChange` перевіряє, чи value валідне і чи `targetSide !== null`.
10. Якщо міняється groove тільки на одній стороні, а інша сторона теж активна і може прийняти цей groove, показується sync warning modal: інша side panel також буде змінена на цей тип.
11. `applyGroove` записує Side Panel у PlayCanvas (через explicit `SidePanelSide`) і оновлює Redux.

Реалізовано тут:

- [Custom accessories side panel UI](../src/pages/custom/accessories/index.tsx)
- [Prebuilt accessories side panel UI](../src/pages/prebuilt/accessories/AccessoriesPage.tsx)
- [Side panel service](../src/features/sidePanel/lib/sidePanelService.ts)
- [Side panel selection/active/sync helpers](../src/features/sidePanel/lib/sidePanelSelectionState.ts)
- [PlayCanvas side panel setter](../src/utils/functions/playcanvas/sidePanels.ts)

## Edge логіка

Side Panel можна встановити тільки на edge cabinet. Поточні edge cabinets беруться з PlayCanvas, а не тільки з Redux.

Edge helper рахує:

| Поле | Значення |
| --- | --- |
| `leftCabinetId` | Поточна ліва крайня тумба |
| `rightCabinetId` | Поточна права крайня тумба |
| `leftGroup` | Група лівої крайньої тумби: `SBSC`, `OS`, `OSS` |
| `rightGroup` | Група правої крайньої тумби |
| `isSelectedEdge` | Чи selected cabinet є лівим або правим краєм |
| `eligibleFallbackEdgeId` | Перший валідний (`SBSC`) край, якщо selected cabinet не дає корисного context |
| `bothEdgesBlockedReason` | Hard-stop reason (рядок), якщо обидва краї заблоковані `OS`/`OSS` |
| `bothEdgesBlockedReasonCode` | Структурований `SidePanelReasonCode` для того ж hard-stop (`both-open-shelf` / `both-side-shelf` / `mixed-open-side-shelf`) |

Edge state читається не під час рендеру, а в effect-і після осідання сцени (`compositionVersion`) — див. «Move/Add/Reorder synchronization».

### targetSide (куди застосовувати)

`resolvedSpSide` у сторінках обчислює, на яку сторону йде apply: тип `"left" | "right" | "both" | null`.

- Ручний вибір **валідного** edge cabinet має пріоритет (`left` / `right`).
- Single cabinet або `leftCabinetId === rightCabinetId` → `"both"`.
- Якщо вибраний edge cabinet є `OS`/`OSS`, він не може бути target; resolver fallback-ить на інший валідний край, якщо він є.
- Якщо вибрана сама side panel entity (`SidePanel_Left` / `SidePanel_Right`), resolver повертає відповідну сторону (`left` / `right`) для керування конкретною бічною панеллю.
- Якщо клікнули поза тумбою і selection очищено, resolver працює як no-cabinet-selected стан: `both`, якщо обидва краї валідні; або єдиний валідний край.
- Interior / нічого не вибрано + обидва краї `SBSC` → `"both"`.
- Interior / нічого не вибрано + лише один край `SBSC` → цей край (`left` або `right`).
- Якщо валідного краю нема → `null`; тоді `handleSidePanelsChange` робить early-return і нічого не застосовує.

Реалізовано тут:

- [Side panel edge compatibility helper](../src/features/sidePanel/lib/sidePanelEdgeCompatibility.ts)
- [PlayCanvas getEdgeCabinets bridge](../src/utils/functions/playcanvas/getEdgeCabinets.ts)
- [resolvedSpSide (custom)](../src/pages/custom/accessories/index.tsx)
- [resolvedSpSide (prebuilt)](../src/pages/prebuilt/accessories/AccessoriesPage.tsx)

## Правила доступності

### 1. Сумісність groove option

Доступність `NoG`, `UpperG`, `CenterG`, `DoubleG` залежить від:

- height: `50`, `53`, `56`
- drawers: `1D`, `2D`
- cabinet group: тільки `SBSC` є валідною групою

Поточна таблиця правил:

| Height | Drawers | Доступні values |
| --- | --- | --- |
| `50H` | `1D` або `2D` | `NoG` |
| `53H` | `1D` | `NoG`, `UpperG` |
| `53H` | `2D` | `NoG`, `CenterG` |
| `56H` | `1D` | `NoG` |
| `56H` | `2D` | `NoG`, `DoubleG` |

Реалізовано тут:

- [SIDE_PANEL_AVAILABILITY](../src/features/sidePanel/lib/constants.ts)
- [sidePanelAvailabilityRule](../src/features/sidePanel/lib/sidePanelRules.ts)
- [selectSidePanelAvailability](../src/features/sidePanel/model/selectors.ts)

### 2. Syntesi countertop material

Якщо countertop material має token `Syntesi`, Side Panels недоступні.

Реалізовано тут:

- [syntesiSidePanelRule](../src/features/sidePanel/lib/sidePanelRules.ts)
- [Syntesi countertop constraint](../src/features/configurator-rule-core/countertop/compositionConstraints.ts)
- [selectSidePanelAvailability](../src/features/sidePanel/model/selectors.ts)

### 3. Countertop length

Кожна активна side panel додає `1 cm` до effective countertop width:

- left side panel додає `1 cm`
- right side panel додає `1 cm`
- дві side panels додають `2 cm`

Реалізовано тут:

- [sidePanelCountertopLengthRule](../src/features/sidePanel/lib/sidePanelRules.ts)
- [useSceneTotalWidthWithSidePanels](../src/features/sidePanel/hooks/useSceneTotalWidthWithSidePanels.ts)
- [useCountertopLengthGuard](../src/features/configurator-rule-core/countertop/hooks/useCountertopLengthGuard.ts)
- [formatSidePanelsExceedMaxReason](../src/features/configurator-rule-core/countertop/lengthLimits.ts)

### 4. Hard block для 340 cm

Якщо cabinet-only total vanity length рівно `340 cm`, Side Panels блокуються. Якщо вони вже активні, система автоматично видаляє їх.

Реалізовано тут:

- [Custom 340 cm block](../src/pages/custom/accessories/index.tsx)
- [Prebuilt 340 cm block](../src/pages/prebuilt/accessories/AccessoriesPage.tsx)
- [autoRemoveBoth](../src/features/sidePanel/lib/sidePanelService.ts)

## Реєстр причин (block / notice)

Замість каскаду ternary із неявним пріоритетом сторінки використовують один data-driven реєстр.

Два рівні:

- **Block** (`resolveSidePanelBlock`) — ховає grid і показує одне повідомлення за `priority`: `length-340` (p10) → `availability` (p20, тобто Syntesi / both-OS / both-OSS / mixed). Повертає `null`, якщо grid треба показати.
- **Notice** (`resolveSidePanelNotice`) — non-blocking пояснення над робочою сіткою: куди саме буде застосовано side panel (`Left end`, `Right end`, `Both ends`) і чому може бути fallback.

Рендер: `block ? <message> : (notice? + <grid>)`. Той самий контекст використовує `handleSidePanelsChange` як guard.

Реалізовано тут:

- [resolveSidePanelBlock / resolveSidePanelNotice](../src/features/sidePanel/lib/sidePanelReasons.ts)
- [SidePanelNoticeBox](../src/features/sidePanel/ui/SidePanelNoticeBox.tsx)
- [Side panel feature barrel](../src/features/sidePanel/index.ts)
- [Custom render + ctx](../src/pages/custom/accessories/index.tsx)
- [Prebuilt render + ctx](../src/pages/prebuilt/accessories/AccessoriesPage.tsx)

## Active state у Side Panels grid

`SidePanels` у Redux зберігає поточний groove, а `SidePanelLeft` / `SidePanelRight` зберігають активність сторін. Тому grid не може просто підсвічувати глобальний `SidePanels` для всіх ситуацій.

Правило:

- `targetSide = "left"` → active option показується тільки якщо `SidePanelLeft === "active"`.
- `targetSide = "right"` → active option показується тільки якщо `SidePanelRight === "active"`.
- `targetSide = "both"` → active option показується, якщо активна хоча б одна сторона.
- `None` активний тільки коли відповідна target-сторона неактивна; для `both` — тільки коли обидві сторони неактивні.

Якщо користувач вимикає тільки одну сторону через `None`, але інша сторона лишається `active`, `applyGroove` не скидає глобальний `SidePanels` у `None`, щоб активна інша сторона не втратила свій groove у UI/SKU state.

Реалізовано тут:

- [resolveSidePanelGridActiveValue](../src/features/sidePanel/lib/sidePanelSelectionState.ts)
- [applyGroove side-aware option preservation](../src/features/sidePanel/lib/sidePanelService.ts)

## Sync warning modal

Якщо користувач працює з однією стороною (`left` або `right`) і вибирає інший groove, але інша сторона:

- вже `active`
- є edge `SBSC`
- може прийняти цей groove за правилами height/drawers

тоді UI показує modal: інша активна side panel також буде оновлена на цей тип. Після підтвердження apply іде як `SidePanelSide: "both"`, щоб не створювати розсинхрон між фізичною side panel у PlayCanvas і глобальним `SidePanels` state.

Реалізовано тут:

- [resolveSidePanelSyncPrompt](../src/features/sidePanel/lib/sidePanelSelectionState.ts)
- [SidePanelSyncConfirmModal](../src/features/sidePanel/ui/SidePanelSyncConfirmModal.tsx)
- [Custom sync handler](../src/pages/custom/accessories/index.tsx)
- [Prebuilt sync handler](../src/pages/prebuilt/accessories/AccessoriesPage.tsx)

## Помилки та попередження

### `Applies to ...` (notice)

Тип: non-blocking пояснення над сіткою (не ховає grid).

Може показувати:

- `Applies to: Both ends` — якщо обидва крайні cabinets валідні (`SBSC`) і вибрано interior/non-edge або нічого не вибрано у multi-cabinet конфігурації.
- `Applies to: Left end` / `Right end` — якщо target визначено як конкретний край.
- `...` — якщо користувач клікнув поза тумбою; це очищає cabinet selection і side panel зміни застосовуються відносно vanity ends.
- `Side panel changes will apply to the selected ... side panel.` — якщо вибрана фізична side panel entity.
- Warning tone — якщо вибраний edge є `OS`/`OSS`, але інший край валідний; текст пояснює, що OS/OSS не може отримати side panel і вибір буде застосований до іншого edge cabinet.

Не показується для однієї тумби: там нема неоднозначності, `targetSide` іде як `"both"`.

Поведінка: grid лишається робочою. Якщо юзер вибирає groove не на валідному краю, apply не йде в PlayCanvas як selected OS/OSS/interior; спочатку рахується `targetSide`, і тільки потім `applyGroove` викликає explicit `SidePanelSide`.

Стару формулу `Side panels can only be installed on edge cabinets.` **прибрано** як normal-state error — interior selection більше не блокує grid і не створює враження, що panel буде поставлена на внутрішню тумбу.

Реалізовано тут:

- [resolveSidePanelNotice](../src/features/sidePanel/lib/sidePanelReasons.ts)
- [SidePanelNoticeBox](../src/features/sidePanel/ui/SidePanelNoticeBox.tsx)
- [Custom render](../src/pages/custom/accessories/index.tsx)
- [Prebuilt render](../src/pages/prebuilt/accessories/AccessoriesPage.tsx)

### `Side panels are not available for use with Open Shelf cabinets.`

Тип: hard-stop warning.

`reasonCode`: `both-open-shelf`. Показується, коли `Open-Shelf` (`OS`) блокує встановлення Side Panels — hard stop тільки коли **обидва** кінці є `Open-Shelf`. Один OS-край не блокує: availability фолбекається на валідний `SBSC`-край (`reasonCode` `open-shelf` лише сигналізує fallback-логіці).

Реалізовано тут:

- [SIDE_PANEL_OPEN_SHELF_UNAVAILABLE_REASON](../src/features/sidePanel/lib/sidePanelRules.ts)
- [Both-edge OS/OSS hard stop](../src/features/sidePanel/lib/sidePanelEdgeCompatibility.ts)

### `Side panels are not available for Side-Shelf cabinets.`

Тип: hard-stop warning.

`reasonCode`: `both-side-shelf`. Показується, коли `Side-Shelf` (`OSS`) блокує встановлення Side Panels — hard stop тільки коли **обидва** кінці є `Side-Shelf`. Один OSS-край не блокує (fallback на валідний край; `reasonCode` `side-shelf`).

Реалізовано тут:

- [SIDE_PANEL_SIDE_SHELF_UNAVAILABLE_REASON](../src/features/sidePanel/lib/sidePanelRules.ts)
- [Both-edge OS/OSS hard stop](../src/features/sidePanel/lib/sidePanelEdgeCompatibility.ts)

### `Side panels are not available when Open Shelf or Side-Shelf cabinets are positioned at both ends.`

Тип: hard-stop warning. `reasonCode`: `mixed-open-side-shelf`.

Показується, коли:

- left edge заблокований `OS` або `OSS`
- right edge заблокований `OS` або `OSS`
- при цьому краї змішані, наприклад `OS` зліва і `OSS` справа

Реалізовано тут:

- [Mixed OS/OSS edge hard stop](../src/features/sidePanel/lib/sidePanelEdgeCompatibility.ts)

### `Syntesi is not available with side panels.`

Тип: hard-stop warning. `reasonCode`: `syntesi-countertop` (сторінки перевіряють саме код, не рядок).

Показується, коли:

- selected countertop material містить `Syntesi`
- користувач намагається використовувати Side Panels

Реалізовано тут:

- [SYNTESI_SIDE_PANEL_UNAVAILABLE_REASON](../src/features/configurator-rule-core/countertop/compositionConstraints.ts)
- [Syntesi check in sidePanelRules](../src/features/sidePanel/lib/sidePanelRules.ts)
- [Syntesi selector integration](../src/features/sidePanel/model/selectors.ts)

### `Side panels are not available when total vanity length is exactly 340 cm (...)`

Тип: hard-stop warning. `reasonCode`: `length-340` (найвищий пріоритет — p10 у block-реєстрі). Перевірка через `isSidePanelLengthBlocked` (толеранс 0.01 cm).

Показується, коли:

- cabinet-only total width рівно `340 cm`

Поведінка:

- UI залишає тільки option `None`
- якщо Side Panels активні, вони автоматично прибираються через `autoRemoveBoth`

Реалізовано тут:

- [Custom exact 340 cm block](../src/pages/custom/accessories/index.tsx)
- [Prebuilt exact 340 cm block](../src/pages/prebuilt/accessories/AccessoriesPage.tsx)

### `Enabling side panels would exceed max countertop length (...)`

Тип: disabled-option warning.

Показується, коли:

- вибрана Side Panel option зробить total countertop width більшою за max allowed length

Поведінка:

- option залишається видимою
- option стає disabled
- reason кладеться в `disabledReason`

Реалізовано тут:

- [formatSidePanelsExceedMaxReason](../src/features/configurator-rule-core/countertop/lengthLimits.ts)
- [Custom option disabling](../src/pages/custom/accessories/index.tsx)
- [Prebuilt option disabling](../src/pages/prebuilt/accessories/AccessoriesPage.tsx)

### Несумісний groove option

Тип: silent filtering.

Текст користувачу: немає окремого message. Несумісні options просто фільтруються з grid, якщо це не Syntesi або max length block.

Приклади:

- `UpperG` не показується для `53H + 2D`
- `CenterG` не показується для `53H + 1D`
- `DoubleG` не показується, якщо cabinet не `56H + 2D`

Реалізовано тут:

- [SIDE_PANEL_AVAILABILITY](../src/features/sidePanel/lib/constants.ts)
- [sidePanelAvailabilityRule](../src/features/sidePanel/lib/sidePanelRules.ts)
- [Custom option filtering](../src/pages/custom/accessories/index.tsx)
- [Prebuilt option filtering](../src/pages/prebuilt/accessories/AccessoriesPage.tsx)

### Invalid або ignored Side Panel value

Тип: silent guard.

Текст користувачу: немає окремого message.

`handleSidePanelsChange` нічого не записує в PlayCanvas, якщо:

- value порожнє
- value не є valid groove type
- `resolvedSpSide === null` (немає валідного краю для apply)
- Side Panels заблоковані 340 cm rule
- value не входить у `sidePanelAvailability.allowed`
- value перевищує max countertop length

Реалізовано тут:

- [Custom handleSidePanelsChange](../src/pages/custom/accessories/index.tsx)
- [Prebuilt handleSidePanelsChange](../src/pages/prebuilt/accessories/AccessoriesPage.tsx)
- [isGrooveType](../src/features/sidePanel/lib/sidePanelService.ts)

## Auto-remove та auto-restore

Система автоматично перевіряє Side Panels після змін у сцені.

Поведінка:

- якщо edge cabinet стає `OS` або `OSS`, Side Panel на цій стороні прибирається
- статус сторони стає `auto-removed`
- якщо ця сторона знову стає валідною, Side Panel може автоматично відновитись
- якщо користувач вручну видалив Side Panel, статус стає `none`, і auto-restore не повертає її

Реалізовано тут:

- [enforceSidePanelEligibility](../src/features/sidePanel/lib/sidePanelEnforce.ts)
- [useSidePanelEnforce](../src/features/sidePanel/hooks/useSidePanelEnforce.ts)
- [autoRemoveSide](../src/features/sidePanel/lib/sidePanelService.ts)
- [autoRestoreSide](../src/features/sidePanel/lib/sidePanelService.ts)
- [Side panel delete from player](../src/widgets/Player/components/PlayCanvasIntegration/PlayCanvasIntegration.tsx)

## Auto-groove reselection (middleware listener)

Окремо від auto-remove/auto-restore (які працюють по edge eligibility) є Redux listener, який автоматично переобирає groove, коли поточний groove перестає бути валідним після зміни розмірів, drawer style або countertop material. Замість того, щоб просто скидати на `None`, він підбирає валідний fallback groove.

Listener реагує на:

| Action | Тригер |
| --- | --- |
| `setSelectedDimensions` | Зміна height (тільки якщо в payload є `height`; width/depth з 350ms polling sync ігноруються) |
| `switchAllCabinetsDrawerStyle` | Зміна handle / drawers |
| `setCountertopColorSku` | Зміна countertop material |

Поведінка:

- Якщо поточний `SidePanels` порожній або `None` — listener нічого не робить.
- Для dimension/handle змін listener пропускає, якщо selected cabinet не SBSC (`OS`, `OSS`, countertop, towel bar ігноруються). Для зміни material ця перевірка пропускається.
- Listener бере актуальний `selectSidePanelAvailability` і через `resolveGroove` рахує новий валідний groove з урахуванням `allowed` і поточного handle.
- Якщо новий groove відрізняється від поточного, він застосовується до активних сторін через `applyGrooveToActiveSides`.

Реалізовано тут:

- [setupSidePanelListener](../src/features/sidePanel/lib/sidePanelMiddleware.ts)
- [Store listener wiring](../src/app/store/optionsListener.ts)
- [resolveGroove](../src/features/sidePanel/lib/sidePanelService.ts)
- [applyGrooveToActiveSides](../src/features/sidePanel/lib/sidePanelService.ts)

## Публічний API фічі

Фіча side panel експортує свій публічний інтерфейс через barrel `index.ts`. Інші частини застосунку мають імпортувати звідти, а не з внутрішніх файлів напряму.

Barrel реекспортує: service mutations (`applyGroove`, `deleteSide`, `autoRemoveSide`, `autoRestoreSide`, `autoRemoveBoth`, `restoreSidePanelState`, `reapplySidePanelsForPreset`, `resolveGroove`, `isGrooveType`, ...), hooks (`useSidePanelActions`, `useSidePanelEnforce`, `useSceneTotalWidthWithSidePanels`), selectors (`getSidePanelsOption`, `getSidePanelLeftStatus`, `getSidePanelRightStatus`, `selectSidePanelAvailability`, `mapCabinetTypeToGroup`), rules, edge compatibility helpers, constants і middleware (`setupSidePanelListener`).

Реалізовано тут:

- [Side panel feature barrel](../src/features/sidePanel/index.ts)
- [useSidePanelActions](../src/features/sidePanel/hooks/useSidePanelActions.ts)

## Move/Add/Reorder synchronization

PlayCanvas є authoritative source для edge placement. Redux order має бути синхронізований із PlayCanvas order, інакше UI може показати stale edge warning.

Важлива поведінка:

- після `Move Left` / `Move Right` PlayCanvas міняє місцями products і запускається Side Panel enforcement
- після in-player duplicate/add left/right Redux вставляє новий product відносно clicked product, а не просто append-ить його в кінець
- Accessories pages перечитують edge state **в effect-і після осідання сцени**, а не під час рендеру

### compositionVersion + effect-driven edge read (фікс stale edge message)

PlayCanvas переставляє композицію **асинхронно** (waitForFrames), а `dispatch(swapProductIds)` оновлює Redux синхронно. Якщо читати `getEdgeCabinets()` під час рендеру одразу після dispatch — отримаєш **старі** краї, і повідомлення «застрягає».

Рішення:

- `compositionVersion` — лічильник у Redux, інкрементиться в reducer-ах `addProductId` / `insertProductIdRelative` / `removeProductId` / `swapProductIds` / `resetProducts` / `restoreProductState`.
- Сторінки тримають `edgeCabinets` у `useState` і перечитують через `getEdgeCabinets()` в effect-і (подвійний `requestAnimationFrame` + safety `setTimeout(250ms)`), keyed на `[isPlayCanvasReady, selectedProductOrderKey, compositionVersion]`. Це pull-модель; push-варіант (snapshot із handler-ів / bridge-подія) — у [side-panel-reasons-refactor.md](./side-panel-reasons-refactor.md) як «Заплановано далі».

Реалізовано тут:

- [Move/swap handler](../src/widgets/Player/components/PlayCanvasIntegration/PlayCanvasIntegration.tsx)
- [Relative insert after in-player add](../src/widgets/Player/components/PlayCanvasIntegration/PlayCanvasIntegration.tsx)
- [Redux insertProductIdRelative + compositionVersion](../src/entities/product/model/store/slice.ts)
- [getCompositionVersion](../src/entities/product/model/store/selectors.ts)
- [Custom effect-driven edge read](../src/pages/custom/accessories/index.tsx)
- [Prebuilt effect-driven edge read](../src/pages/prebuilt/accessories/AccessoriesPage.tsx)

## Preset, restore та history

При завантаженні preset або saved configuration:

- Side Panel groove відновлюється
- `SidePanelLeft` і `SidePanelRight` відновлюються
- PlayCanvas оновлюється per side
- після restore запускається edge eligibility enforcement, щоб OS/OSS edge cases були виправлені

Реалізовано тут:

- [restoreSidePanelState](../src/features/sidePanel/lib/sidePanelService.ts)
- [reapplySidePanelsForPreset](../src/features/sidePanel/lib/sidePanelService.ts)
- [History restore](../src/entities/history/lib/restoreSnapshot.ts)
- [Cabinet builder restore path](../src/pages/custom/cabinetBuilder/CabinetBuilderPage.tsx)
- [Prebuilt model preset switch](../src/pages/prebuilt/model/ModelPage.tsx)

## Summary та SKU

Активні Side Panels потрапляють у quote/summary output і SKU generation.

Реалізовано тут:

- [Custom summary side panel SKU](../src/pages/custom/summary/index.tsx)
- [Prebuilt summary side panel SKU](../src/pages/prebuilt/summary/SummaryPage.tsx)
- [buildSidePanelSku](../src/shared/lib/sku/buildSidePanelSku.ts)
- [Countertop width with side panels](../src/entities/countertop/lib/calcCountertopWidth.ts)

## Швидкий debug checklist

Якщо Side Panel UI виглядає неправильно, перевіряти в такому порядку:

1. Що повертає PlayCanvas `ConfiguratorAPI.getEdgeCabinets()`?
2. Чи selected cabinet реально дорівнює `leftCabinetId` або `rightCabinetId`?
3. Чи обидва edge cabinets є `OS`/`OSS`?
4. Чи countertop material є `Syntesi`?
5. Чи cabinet-only total width рівно `340 cm`?
6. Чи Side Panels не перевищують max countertop length?
7. Чи поточна комбінація height/drawers дозволяє вибраний groove?
8. Чи Redux `productIds` у тому ж порядку, що й PlayCanvas composition order?
9. Які статуси `SidePanelLeft` і `SidePanelRight`: `active`, `none`, `auto-removed`?
10. Якщо groove несподівано змінився після зміни height/handle/material — перевірити `setupSidePanelListener` і що повертає `resolveGroove`.
11. Якщо edge-повідомлення «застрягло» після move/add — чи інкрементиться `compositionVersion` і чи спрацював effect перечитування `getEdgeCabinets()` (rAF/250ms)?
12. Якщо apply нічого не робить — чи `resolvedSpSide !== null` (інакше handler робить early-return)?
13. Для логіки блоків звіряти `reasonCode`, а не текст `reason`.
