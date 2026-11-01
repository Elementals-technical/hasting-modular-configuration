# Контракт 3D ↔ UI для side panels (спільне ядро, читається в будь-якому scope)

Стан звірено 2026-10-19: PlayCanvas `src/` (`feture/part-2` @ `5310d1f`), UI `UI-APP-config-react` (`package-3/fix` @ `91257118`).

## Терміни (однакові для обох репо)
- **Side panel / «саб-панель» / бокова панель** — окремий addon-продукт на відкритому торці ряду тумб; не частина меша тумби.
- **Groove / тип**: `NoG` (без паза), `UpperG`, `CenterG`, `DoubleG`, `None` (вимкнено). У UI користувач обирає groove, не сторону.
- **Сторона**: `left` / `right` / `both` (композиція загалом, не окрема тумба).
- **end** — панель на зовнішньому торці групи; **joint** — вузька смуга на вищій UF-тумбі біля нижчої (лише UF 88+53).
- **Group pipeline** (ULH, UF, Tricot) — 0..N панелей на сторону, ключ `cabinetId:side`; **legacy** (USH, Class, Mako, UD, Lame, змішані композиції) — рівно два слоти `SidePanel_Left/Right`.
- **Edge cabinet** — тумба, від якої панель бере Height/Depth/колір/ручку; group — крайня по X у своєму ряду, legacy — за `orderIndex`.

## Що UI шле в 3D
| Виклик | Форма | Поведінка 3D |
|---|---|---|
| `ConfiguratorAPI.setConfigBatch({}, { SidePanel: <groove>, SidePanelSide: 'left'\|'right'\|'both' })` | один патч на виклик | bridge робить ранній `return true` і **ніколи не повертає помилку**, навіть якщо тип відхилено (`_validateType` → `false`). `None`+`both` UI шле двома патчами (left, right) |
| `SidePanelSide` відсутній | legacy `options.cabinetId` → крайня тумба; інакше `both` | |
| одна тумба в композиції | UI примусово шле `both` | |

## Що UI читає з 3D
- `getEdgeCabinets()` → `{ leftCabinetId, rightCabinetId }` (за `orderIndex`, не по X).
- `getConfig(edgeId)` → `productType` / `name` → група SBSC / OS / OSS для auto-remove/restore.
- Клік по сутності в сцені: `productType`/`entityName` містить `sidepanel` або `side-panel`; сторона — з імені (`sidepanelleft` / `sidepanelright`).
- **Не читає:** продукти-панелі, їх кількість та id, `features.sidePanelSelection`, `exportSnapshot` панелей.

## Що 3D робить із цим (мінімум, який треба знати UI-розробнику)
- Зберігає вибір у `features.sidePanelSelection = { left: <groove|None|null>, right: … }`; переживає snapshot і preset import як `featureSettings`, навіть коли панелей 0.
- Тип панелі визначає **3D**, не запит UI: ULH — з `Handle` (pto → NoG, topcut → UpperG; `CenterG/DoubleG` → NoG); UF — з висоти корпусу (PTO→85 NoG, UG/CG→88 UpperG, 50 NoG, 53 UpperG), запит ігнорується; Tricot — завжди NoG; legacy — запитаний тип.
- Панель лише на відкритому (`exposed`) торці; біля OS/OSS, під накриттям або при непідтримуваній висоті/глибині панелі немає, але вибір зберігається і панель повертається сама.
- Group pipeline: панель на **кожному** відкритому торці **кожного ряду** → 2 ряди з розривом = 4 панелі; стек = по панелі на ряд, висоти не сумуються; id панелі змінюється, коли змінюється крайня тумба.
- Стільниця: +1 см за кожну `end`-панель групи під нею; `joint` не подовжує.
- UF joint strip — окремий продукт `UF-SidePanel_*` з `SidePanelFace: 'joint'`; UI про нього не знає.

## Що UI припускає (мінімум, який треба знати 3D-розробнику)
- Стан UI: Redux `SidePanels` (groove) + `SidePanelLeft/Right: 'active' | 'none' | 'auto-removed'` — модель **рівно двох панелей**.
- Ціна: один рядок SKU × `activeSideCount` (0..2); URSP SKU для USH, ULH і UF (`pricedAs: urban-standard-height`), власний `VAN-TRIC-SP-…` для Tricot; UD / Class / Mako / Lame — `sku-profile.sidePanel = null` → без ціни. Розмір — від першої не-короткої тумби. Joint не ціноутворюється.
- Стільниця в UI: `calcCountertopWidth` +1 см на активну сторону; `sidePanelRules` +2 см плоско; 3D рахує сам у `syncCountertopConfig` — три джерела, звіряй.
- Доступність groove — матриця `product-profile.json → ruleData.sidePanels` (висота × 1D/2D × група) лише для USH, ULH, UF, Tricot; блок при OS/OSS на краю, Syntesi-стільниці, рівно 340 см.
- UI повторно шле groove при зміні Handle / Height / Depth / стилю шухляд / кольору стільниці (`sidePanelMiddleware`) і після swap/дублювання тумб.
- Пресети панелей не несуть (`Presets carry no side-panel data`); після імпорту UI сам перевідправляє groove на придатні краї.

## Розриви контракту (відомі, не виправлені)
1. UI не бачить 0..N панелей на сторону і нові id → ціна й підсумок для ULH/UF неточні при розривах/стеках; joint не в ціні.
2. Bridge не повертає відмову типу → UI вважає, що панель є.
3. `runtime-bindings.json` для UF і Tricot описує стан до group pipeline (застаріло).
4. Три способи рахувати довжину стільниці з панелями в UI vs одна формула в 3D.
5. Gap-торці в 3D завжди отримують панелі — рішення Райана ще немає; UI цього не відображає.

## Інваріанти на стику (порушення = баг у будь-якому репо)
- Один патч `SidePanel` на виклик `setConfigBatch`; порядок інших ключів у тому ж batch не обробляється.
- Після будь-якої зміни Handle/Height/Depth крайньої тумби тип і геометрія панелі в 3D перераховуються самі — UI не має «виправляти» тип, лише повторити groove.
- `None` знімає панелі обох сторін лише двома патчами.
- Кількість і id панелей — власність 3D; усе, що в UI рахує «2», має вважатись тимчасовим припущенням.
