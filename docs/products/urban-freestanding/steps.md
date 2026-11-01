<!-- Urban Freestanding · specification revision 2026-10-28 · part of docs/products/urban-freestanding/ · statuses: ../_shared/status-legend.md -->

## 3. Кроки і секції
Обидва сценарії мають шість кроків. Кроки 2–6 однакові в обох [code: urban-freestanding/ui.json].

### 3.1 Сценарій Prebuilt
| # | Крок | Блоки (по порядку) | Що налаштовується | Крок у 2D |
| :---- | :---- | :---- | :---- | :---- |
| 1 | Model | фільтр Size, фільтр Style, сітка моделей | вибір однієї з 54 моделей | 1 Select Model (Size, Style, Model) [2D L2–L68] |
| 2 | Color | Cabinet Color, Handle Color, Drawer Panel Fluting | 235 кольорів корпусу, 252 кольори пазу (лише UG/CG), 4 патерни + None (лише Lacquered MT) | 2 Select Cabinet Color (Handle Color і Fluting у 2D немає) |
| 3 | Countertop & Basin | Countertop Color (Upper / Lower, коли є коротка тумба), Thickness, Countertop Style, Basin Style (заголовок "Vessel Sink Style" для vessel), Vessel Color (лише для vessel) | 60 кольорів, товщина 0.5", Integrated / Vessel, 13 інтегрованих раковин або None + 4 vessel | 3 Select Countertop Color, 4 Select Countertop Basin Style (Thickness, Countertop Style і vessel у 2D немає) |
| 4 | Accessories | Side Panels, Dividers, Towel Bar | None / No groove / 1 groove (upper); Dividers — Not implemented; Towel Bar None / Left / Right / Both + 5 кольорів | немає в 2D |
| 5 | Faucet Details | Faucet Holes | 0, 1, 2, 3 отвори | немає в 2D |
| 6 | Summary | ціна і список позицій | – | – |

* Фільтри Size: 24-29", 30-39", 40-49", 50-59", 60-69", 70-79", 80-89", 90"+; Style: 2-Drawer, Single basin, Double basin, Asymmetrical, Open Shelving (за тегами моделей)
* Усі 54 моделі: Cabinet Color Metal acciaio 2MA, Countertop Color Bianco Statuario Venato Matte TQV, раковина Porcelain Cover 48, UG, висота 91, глибина 50; лише Sink Base, Side Cabinet і Open Shelf (коротка тумба й Open Side Shelf у моделях не трапляються)
* Склад кожної моделі (які тумби, порядок) — наш: у клієнта є лише назва, розмір і теги → **Provisional**; для 7 моделей теги Style відрізняються від 2D (див. внутрішні нотатки)

### 3.2 Сценарій Create your own
| # | Крок | Блоки | Що налаштовується |
| :---- | :---- | :---- | :---- |
| 1 | Cabinet Builder | Cabinet Type, Cabinet Style; права панель вибраної тумби: Width, Depth, Handle | додати Sink Base / Side Cabinet / Open Shelf / Open Side Shelf / Floor-Mount Short Cabinet; 2 Drawer / 1 Drawer; ширина, глибина 46 / 50, ручка |
| 2–6 | як у Prebuilt 2–6 |  |  |

* Порядок вибору відповідає клієнтському "Cabinet Type → Cabinet Style, same approach" (як USH)
* Висоти в правій панелі немає: її задає ручка
* Тумби додаються в ряд кнопками "+"; перетягування тумб немає

### 3.3 Деталі блоків
| Блок | Контрол | Джерело опцій | Коли показаний / активний |
| :---- | :---- | :---- | :---- |
| Cabinet Type | картки з картинками | 5 типів | третя Sink Base і третя Open Side Shelf вимкнені; Open Side Shelf вимкнена при UG/CG |
| Cabinet Style | картки з картинками | 2 Drawer, 1 Drawer | 1 Drawer недоступний, доки не поставлена висока тумба з ящиками |
| Cabinet Color | свотчі з фільтрами Material / Color | конфігуратор 11 (235) | завжди; один колір на всю композицію |
| Handle Color | свотчі | конфігуратор 11 (252) | лише при UG або CG; до вибору паз іде за кольором корпусу |
| Drawer Panel Fluting | картки з картинками | None + 4 патерни | лише для кольорів Lacquered MT |
| Countertop Color | свотчі з фільтрами Material / Color | конфігуратор 11 (60 видимих) | кольори, чий матеріал підходить композиції (таблиця 591); Upper / Lower — коли є нижня стільниця |
| Thickness | свотчі (лише доступні значення) | 0.5" | завжди одне значення |
| Countertop Style | картки з картинками | Integrated, Vessel | Vessel — для матеріалів, що мають vessel-рядок у таблиці 591 (HPL, Fenix, Porcelain, Solid Surface); потребує Sink Base від 80 см |
| Basin Style | картки з картинками | інтегровані раковини вибраного матеріалу або None / Blade 11 / Blade 18 / Urban Modo / Urban Morris | §5 |
| Vessel Color | свотчі | конфігуратор 11 (49, фільтр за стилем vessel) | лише коли вибрано vessel |
| Side Panels | картки | None, No groove, 1 groove (upper) | §6.1 |
| Dividers | опція + стиль | None / Customize; A, B, C | секція видима, але **Not implemented** (§6.3) |
| Towel Bar | опція (свотчі) + колір (картки options-grid) | None, Left, Right, Both; 5 кольорів | колір — коли рушникотримач вибрано |
| Faucet Holes | свотчі | 0, 1, 2, 3 | завжди; дефолт 0 |

Відхилена опція лишається видимою й вимкненою з текстом причини; Thickness і Basin Style показують лише доступні значення [code: UI FieldControl].
