<!-- Urban Duplex · specification revision 2026-11-03 · part of docs/products/urban-duplex/ · statuses: ../_shared/status-legend.md -->

## 3. Кроки і секції
Обидва сценарії мають шість кроків. Кроки 2–6 однакові в обох [code: urban-duplex/ui.json].

### 3.1 Сценарій Prebuilt
| # | Крок | Блоки (по порядку) | Що налаштовується | Крок у 2D |
| :---- | :---- | :---- | :---- | :---- |
| 1 | Model | фільтр Size, фільтр Style, сітка моделей | вибір однієї з 71 моделі; "Customize" копіює модель у конструктор тумб | 1 Select Model (Size, Style, Model) [2D L2–L87] |
| 2 | Color | Panel Color: вкладки "Select Panel, Then Color" — Base Panel, Lateral Panel | 232 кольори для кожної панелі | 2 Select Cabinet Colors (Base Panel, Lateral Panel) |
| 3 | Countertop & Basin | Countertop Color (Upper / Lower, коли є нижня тумба без стільниці), Thickness, Countertop Style, Basin Style (заголовок "Vessel Sink Style" для vessel), Vessel Color (лише для vessel) | 60 кольорів, 5 товщин, Integrated / Vessel, 13 інтегрованих раковин або None + 5 vessel, 9 кольорів vessel | 3 Select Countertop Color, 4 Select Countertop Basin Style (Thickness, Countertop Style і vessel у 2D немає) |
| 4 | Accessories | Towel Bar | None / Left / Right / Both + 5 кольорів | немає в 2D |
| 5 | Faucet Details | Faucet Holes | 0, 1, 2, 3 отвори | немає в 2D |
| 6 | Summary | ціна і список позицій | – | – |

* Фільтри: Size {24-29", 30-39", 40-49", 50-59", 60-69", 70-79", 80-89", 90"+}; Style {1-Drawer, 2-Drawer, Single basin, Double basin, Asymmetrical, Open Shelving, Multi-level}. Кількість моделей у кожному розмірі й теги збігаються з 2D (1-Drawer 47, 2-Drawer 24, Single 54, Double 17, Asymmetrical 37, Open Shelving 13, Multi-level 5)
* Усі моделі: Base Panel Bianco Calce DA ST, Lateral Panel і стільниця Pulpis Chiaro TKH, раковина HPL Strip 48 (там, де є Sink Base); глибина 46 см, крім 5 моделей Multi-level (номінальні 50 см; фізична геометрія потребує узгодження, див. §2.4)
* Склад моделей: для 24 моделей клієнт дав склад (аркуш "Pre-Render | Hybrid Models"), наш склад з ним здебільшого збігається; для інших 47 склад наш → **Provisional**. Розбіжності — у внутрішніх нотатках
* 28 моделей гібридні (Side Cabinet URSTD / URLH)
* Модель "89'' 2-Drawer" клієнт позначив "Doesn't belong in Duplex", але вона є і в 2D, і в збірці — UNKNOWN — clarify

### 3.2 Сценарій Create your own
| # | Крок | Блоки | Що налаштовується |
| :---- | :---- | :---- | :---- |
| 1 | Cabinet Builder | Cabinet Type, Cabinet Style; права панель вибраної тумби: Width, Depth, Height, Handle, Lateral Panel | додати Sink Base / Side Cabinet / Open Shelf / Open Side Shelf; стиль ящиків (для Side Cabinet — і серію); ширина; глибина 46 / 50; висота; бік Lateral Panel |
| 2–6 | як у Prebuilt 2–6 |  |  |

* Порядок вибору відповідає клієнтському "Cabinet Type → Cabinet Style"
* Drag-and-drop тумб увімкнено (§7.1)
* Меню плеєра для поставленої тумби: Width, Depth, Height і Lateral Panel (для тумб Urban Duplex); пункту кольору немає [derived]

### 3.3 Деталі блоків
| Блок | Контрол | Джерело опцій | Коли показаний / активний |
| :---- | :---- | :---- | :---- |
| Cabinet Type | картки з картинками | Sink Base, Side Cabinet, Open Shelf, Open Side Shelf | третя Sink Base і третя Open Side Shelf вимкнені; картинка Sink Base / Side Cabinet за поточною висотою |
| Cabinet Style | картки з картинками | 2 Drawer, 1 Drawer, 1 Drawer With Inner Drawer; для Side Cabinet — по серіях | інша група ящиків позначена як «змішування обмежене»; для OS / OSS стилю немає |
| Height (права панель) | значення | 56, 53, 38, 28 | активні лише висоти стилю (2DW — 56; 1DWID — 53; 1DW — 53 / 38 / 28) |
| Lateral Panel (права панель) | Left / Right | L, R | лише для тумб серії Urban Duplex |
| Base Panel / Lateral Panel | свотчі з фільтрами Material / Color | список кольорів конфігуратора (232 і 232) | завжди; один колір кожної панелі на всю композицію |
| Countertop Color | свотчі з фільтрами Material / Color | список кольорів конфігуратора (60 видимих) | кольори, чий матеріал має рядок у таблиці 595 і підходить композиції |
| Thickness | свотчі (лише доступні значення) | 0.5", 2.4", 4", 5.1", 5.5" | значення, дозволені для матеріалу стільниці; автоматично перше дозволене |
| Countertop Style | картки з картинками | Integrated, Vessel | Vessel — лише для HPL і Porcelain (не Fenix) і Sink Base від 80 см |
| Basin Style | картки з картинками | інтегровані раковини матеріалу стільниці або None + 5 vessel | §5; автоматично перша дозволена |
| Vessel Color | свотчі | список кольорів vessel (9) | лише коли вибрано vessel; лише кольори, дозволені для стилю vessel |
| Towel Bar | свотчі + сітка кольорів | None, Left, Right, Both; 5 кольорів | колір — лише коли рушникотримач вибрано, дефолт Carbone 43 MT (§7.4 п. 24) |
| Faucet Holes | свотчі | 0, 1, 2, 3 | для 1–3 підказка "Faucet hole placement … to be specified at time of order." |

Відхилена опція лишається видимою й вимкненою з текстом причини; Thickness і Basin Style показують лише доступні значення [code: UI FieldControl].
