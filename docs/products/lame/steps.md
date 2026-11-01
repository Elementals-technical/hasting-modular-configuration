<!-- Lame · specification revision 2026-10-28 · part of docs/products/lame/ · statuses: ../_shared/status-legend.md -->

## 3. Кроки і секції
Обидва сценарії мають п'ять кроків. Кроки 2–5 однакові в обох [code: lame/ui.json]. Окремого кроку Accessories немає.

### 3.1 Сценарій Prebuilt
| # | Крок | Блоки (по порядку) | Що налаштовується | Крок у 2D |
| :---- | :---- | :---- | :---- | :---- |
| 1 | Lame Models | фільтр Size, фільтр Style, сітка моделей, деталі моделі | вибір однієї з 43 моделей (18 із ніжками); "Customize" копіює модель у конструктор тумб | 1 Select Model (Size, Style, Model) [2D L2–L57] |
| 2 | Color | Cabinet Color, Cabinet Pattern, Handle Color, Leg Cap Color, Undertop Color | 40 кольорів корпусу, 5 патернів, 22 кольори ручки, ніжки увімк./вимк. + 22 кольори заглушки, undertop увімк./вимк. + 22 кольори | 2 Select Cabinet Color, 3 Select Cabinet Pattern, 5 Select Handle Color, 8 Select Leg Cap Color (Undertop у 2D немає) |
| 3 | Countertop & Basin | Countertop Color, Thickness, Countertop Style, Basin Style (заголовок "Vessel Sink Style" для vessel), Vessel Color (лише для vessel) | 70 кольорів, 2 товщини, Integrated / Vessel, 10 інтегрованих раковин або 3 vessel + "None", 20–40 кольорів vessel | 6 Select Countertop Color, 7 Select Countertop Basin Style (Thickness, Countertop Style і vessel у 2D немає, вони визначені в документі WebGL) |
| 4 | Faucet Details | Faucet Holes | 0, 1, 2 або 3 отвори | у 2D немає (WebGL "Faucet Hole options") |
| 5 | Summary | ціна і список позицій | – | – |

* Крок 2D "4 Side Panels (optional)" (Yes / No) у збірці відсутній — **Not implemented** (§6.4)
* Моделей 43 з 44 у Master File: для Lame 79 2DW w/leg_70 (L37) немає мініатюри. Склад моделей (які тумби, ширини) клієнт не описує; його прочитано з мініатюр — **Provisional** (GEN-MOD-01)
* Моделі несуть колір корпусу й ручки Antracite 400 MT, патерн Oxford і ніжки (для моделей "Legs"); стільниці й раковини в моделях немає, тому кожна модель стартує з Matte White, Integrated, LB440

### 3.2 Сценарій Create your own
| # | Крок | Блоки | Що налаштовується |
| :---- | :---- | :---- | :---- |
| 1 | Lame Cabinet Builder | Cabinet Type, Cabinet Style; права панель вибраної тумби: Width, Depth, Handle | додати Sink Base / Side Cabinet; ящики 1 Drawer / 2 Drawer; ширина кожної тумби; глибина й ручка мають по одному значенню (52 см, G58) |
| 2–5 | як у Prebuilt 2–5 |  |  |

* Порядок вибору відповідає клієнтському "Cabinet Type → Cabinet Style → Size Selection"
* Селектора висоти немає: висоту задає Cabinet Style
* Нова композиція стартує без ніжок і без undertop

### 3.3 Деталі блоків
| Блок | Контрол | Джерело опцій | Коли показаний / активний |
| :---- | :---- | :---- | :---- |
| Cabinet Type | картки з картинками | Sink Base, Side Cabinet | третя Sink Base і ширини понад ліміт довжини вимкнені |
| Cabinet Style | картки з картинками | 1 Drawer, 2 Drawer | інша група ящиків позначена як «змішування обмежене» |
| Cabinet Color | свотчі з фільтрами Material / Color | список кольорів конфігуратора (40) | завжди |
| Cabinet Pattern | картки з картинками | 5 патернів | завжди; усі активні |
| Handle Color | свотчі | список кольорів конфігуратора (22) | завжди; один колір на всю композицію |
| Leg Cap Color | перемикач "Enable Legs, Then Color" + свотчі | список кольорів конфігуратора (22) | завжди; кольори — після ввімкнення ніжок |
| Undertop Color | перемикач "Enable Undertop, Then Color" + свотчі | палітра Handle Color (22) | завжди; кольори — після ввімкнення undertop |
| Countertop Color | свотчі з фільтрами Material / Color | список кольорів конфігуратора (70) | усі кольори активні; сумісність із тумбами перевіряється при застосуванні |
| Thickness | свотчі (лише доступні значення) | 0.5", 0.8" | значення, дозволене для матеріалу стільниці |
| Countertop Style | картки з картинками | Integrated, Vessel | обидва доступні для всіх матеріалів [derived] |
| Basin Style | картки з картинками | інтегровані раковини вибраного матеріалу або None / Iris / Frame / Plaza | §5 |
| Vessel Color | свотчі | список кольорів vessel | лише коли вибрано vessel (Iris, Frame, Plaza) |
| Faucet Holes | свотчі (лише доступні значення) | 0, 1, 2, 3 | завжди; дефолту немає |

Відхилена опція лишається видимою й вимкненою з текстом причини; Thickness, Faucet Holes і Basin Style показують лише доступні значення [code: UI FieldControl].

* Фільтри Prebuilt показують Size {All, 24-29", 30-39", 40-49", 50-59", 60-69", 70-79", 80-89", 90"+} і Style {All, 1 Drawer, 2 Drawer, Single Basin, Double Basin, Asymmetrical, Open Shelving, Multi-level}; для "90"+", "Open Shelving" і "Multi-level" моделей Lame немає (у 2D 7 розмірів і 5 стилів)
* Меню на сцені будується з даних колекції: пункту Accessories немає; пункти Open і Handle Style присутні, хоча відкритих полиць і вибору ручки в Lame немає (виведено з коду, перевірити на тесті)
