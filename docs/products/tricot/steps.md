<!-- Tricot · specification revision 2026-10-28 · part of docs/products/tricot/ · statuses: ../_shared/status-legend.md -->

## 3. Кроки і секції
Обидва сценарії мають п'ять кроків. Кроки 2–5 однакові в обох [code: tricot/ui.json].

### 3.1 Сценарій Prebuilt
| # | Крок | Блоки (по порядку) | Що налаштовується | Крок у 2D |
| :---- | :---- | :---- | :---- | :---- |
| 1 | Tricot Models | фільтр Size, фільтр Style, сітка моделей, деталі моделі | вибір однієї з 41 моделі; "Customize" копіює модель у конструктор тумб | 1 Select Model (Size, Style, Model) [2D L2–L55] |
| 2 | Cabinet Finishes | Cabinet Color, Cabinet Pattern, Handle Groove Color | 23 кольори корпусу, 5 патернів (з обмеженням за матеріалом), 20 кольорів пазу | 2 Select Cabinet Color, 3 Select Cabinet Pattern, 4 Select Handle Groove Color |
| 3 | Accessories | Side Panels | None / No groove | 5 Side Panels (опційно) |
| 4 | Countertop & Basin | Countertop Color, Thickness, Countertop Style, Basin Style (заголовок "Vessel Sink Style" для vessel), Vessel Color (лише для vessel) | 71 колір, 5 товщин, Integrated / Vessel, 10 інтегрованих раковин або 3 vessel + "None", 20–40 кольорів vessel | 6 Select Countertop Color, 7 Select Countertop Basin Style (Thickness, Countertop Style і vessel у 2D немає, вони визначені в документі WebGL) |
| 5 | Summary | ціна і список позицій | – | – |

### 3.2 Сценарій Create your own
| # | Крок | Блоки | Що налаштовується |
| :---- | :---- | :---- | :---- |
| 1 | Tricot Cabinet Builder | Cabinet Type, Cabinet Style; права панель вибраної тумби: Width, Depth | додати Sink Base / Side Cabinet; ящики 1DW / 2DW / 1DWID; ширина кожної тумби; глибина показує єдине значення 52 см |
| 2–5 | як у Prebuilt 2–5 |  |  |

* Порядок вибору відповідає клієнтському "Cabinet Type → Cabinet Style → Size Selection"
* Селектор Handle має бути прихований у правій панелі (вибору ручки немає)

### 3.3 Деталі блоків
| Блок | Контрол | Джерело опцій | Коли показаний / активний |
| :---- | :---- | :---- | :---- |
| Cabinet Type | картки з картинками | Sink Base, Side Cabinet | третя Sink Base і ширини понад ліміт довжини вимкнені   |
| Cabinet Style | картки з картинками | 1DW, 2DW, 1DWID | інша група ящиків позначена як «змішування обмежене»   |
| Cabinet Color | свотчі з фільтрами Material / Color | список кольорів конфігуратора (23) | завжди |
| Cabinet Pattern | картки з картинками | 5 патернів | активні лише патерни, дозволені для матеріалу корпусу |
| Handle Groove Color | свотчі | список кольорів конфігуратора (20) | завжди; один колір на всю тумбу |
| Side Panels | картки з картинками | None, No groove | "No groove" вимкнена, якщо перевищить ліміт довжини |
| Countertop Color | свотчі з фільтрами Material / Color | список кольорів конфігуратора (71) | кольори, чий матеріал підходить композиції |
| Thickness | свотчі (лише доступні значення) | 0.5", 0.8", 3.1", 4", 4.7" | значення, дозволені для матеріалу стільниці |
| Countertop Style | картки з картинками | Integrated, Vessel | обидва доступні для всіх поточних матеріалів [derived] |
| Basin Style | картки з картинками | інтегровані раковини вибраного матеріалу або None / Iris / Frame / Plaza | §5 |
| Vessel Color | свотчі | список кольорів vessel | лише коли вибрано vessel (Iris, Frame, Plaza) |

 Відхилена опція лишається видимою й вимкненою з текстом причини; Thickness і Basin Style показують лише доступні значення [code: UI FieldControl].

* Фільтри Prebuilt показують Size {All, 24-29", 30-39", 40-49", 50-59", 60-69", 70-79", 80-89", 90"+} і Style {All, 1 Drawer, 2 Drawer, Single Basin, Double Basin, Asymmetrical, Open Shelving, Multi-level}; для "90"+", "Open Shelving" і "Multi-level"
