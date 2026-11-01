<!-- Class · specification revision 2026-10-28 · part of docs/products/class/ · statuses: ../_shared/status-legend.md -->

## 3. Кроки і секції
Обидва сценарії мають п'ять кроків. Кроки 2–5 однакові в обох [code: class/ui.json]. Кроку Accessories немає; є окремий крок Faucet Details.

### 3.1 Сценарій Prebuilt
| # | Крок | Блоки (по порядку) | Що налаштовується | Крок у 2D |
| :---- | :---- | :---- | :---- | :---- |
| 1 | Class Models | фільтр Size, фільтр Style, сітка моделей, деталі моделі | вибір однієї з 44 моделей; "Customize" копіює модель у конструктор тумб | 1 Select Model (Size, Style, Model) [2D L2–L57] |
| 2 | Color | Cabinet Color, Cabinet Side Color, Frame Color | 343 / 52 / 20 кольорів (у клієнта 108 / 52 / 20, §4) | 2 Select Cabinet Color, 3 Select Cabinet Side Color, 4 Select Frame Color (у 2D це три окремі кроки) |
| 3 | Countertop & Basin | Countertop Color, Thickness, Countertop Style, Basin Style (заголовок "Vessel Sink Style" для vessel), Vessel Color (лише для vessel) | 170 кольорів (у клієнта 71), 5 товщин, Integrated / Vessel, 10 інтегрованих раковин або "None" + 3 vessel, кольори vessel | 5 Select Countertop Color, 6 Select Countertop Basin Style (Thickness, Countertop Style і vessel у 2D немає, вони визначені в документі WebGL) |
| 4 | Faucet Details | Faucet Holes | 0, 1, 2 або 3 отвори | у 2D немає; у WebGL лише заголовок "Faucet Hole options" |
| 5 | Summary | ціна і список позицій | – | – |

* Моделі: 44 моделі, 92 тумби (51 Sink Base + 41 Side Cabinet), усі з реальними композиціями (не порожні). Назви й теги фільтрів збігаються з Master File.
* 2-Drawer моделей 20 з 44 (id 2, 5, 7, 13, 14, 18, 19, 20, 25–30, 32, 35–37, 43, 44) → Provisional — підлягає видаленню. 1-Drawer — 22, 1-Drawer ID — 2 (id 4, 12).
* 7 моделей мають дві Sink Base (id 8, 13, 25, 32, 35, 38, 43); 7 моделей мають рівно 220 см (id 38–44).
* Розклад моделі на тумби (які SB/SC, порядок) клієнт не визначає — композиції наші → Provisional.
* У моделях задано лише розміри, стиль ящиків і чотири кольори (Invisible White Lucido 334 для корпусу й стільниці, Nero 433 MT для боку й рамки). Раковина, товщина і стиль стільниці беруться з дефолтів (LV890, Integrated, перша дозволена товщина).
* Модель 44 ("Class Vanity 87" 2-Drawer 1") не має тегів стилю, як і в Master File (L45), тому не потрапляє в жоден фільтр Style, крім All; за розміром вона видна у фільтрі Size 80–89″.

### 3.2 Сценарій Create your own
| # | Крок | Блоки | Що налаштовується |
| :---- | :---- | :---- | :---- |
| 1 | Class Cabinet Builder | Cabinet Type, Cabinet Style; права панель вибраної тумби: Width, Depth | додати Sink Base / Side Cabinet; ящики 1DW / 2DW / 1DWID; ширина кожної тумби; глибина показує єдине значення 52 см; висоти в панелі немає |
| 2–5 | як у Prebuilt 2–5 |  |  |

* Порядок вибору відповідає клієнтському "Cabinet Type → Cabinet Style → Size Selection".
* Селектор Handle у правій панелі прихований (ручок немає).
* Кроку Accessories (клієнт: лише Inner drawer dividers) немає → Not implemented (§6).

### 3.3 Деталі блоків
| Блок | Контрол | Джерело опцій | Коли показаний / активний |
| :---- | :---- | :---- | :---- |
| Cabinet Type | картки з картинками | Sink Base, Side Cabinet | третя Sink Base і ширини понад ліміт довжини вимкнені |
| Cabinet Style | картки з картинками | 1DW, 2DW, 1DWID | стиль іншої групи лишається видимим з підказкою «These cabinet styles cannot be mixed in one vanity configuration.»; клік відкриває діалог «Update Design?» |
| Cabinet Color | свотчі з фільтрами Material / Color | конфігуратор 8, група "Select Cabinet Color" (343) | завжди |
| Cabinet Side Color | свотчі з фільтрами Material / Color | конфігуратор 8, "Select Cabinet Side Color" (52) | завжди |
| Frame Color | свотчі | конфігуратор 8, "Select Frame Color" (20) | завжди |
| Countertop Color | свотчі з фільтрами Material / Color | конфігуратор 8, "Select Countertop Color" (170) | кольори, чий матеріал має рядок у таблиці 578 і підходить композиції |
| Thickness | свотчі (лише доступні значення) | 0.5", 0.8", 3.1", 4", 4.7" | значення, дозволені для матеріалу стільниці |
| Countertop Style | картки з картинками | Integrated, Vessel | обидва доступні |
| Basin Style | картки з картинками | інтегровані раковини вибраного матеріалу або None / Iris / Frame / Plaza | §5 |
| Vessel Color | свотчі | група "Select Cabinet Color" (343), недозволені кольори вимкнені | лише коли вибрано vessel (Iris, Frame, Plaza) |
| Faucet Holes | свотчі | 0, 1, 2, 3 | значення з таблиці 578 (усі рядки 0–3); на старті нічого не вибрано |

Відхилена опція лишається видимою й вимкненою з текстом причини; Thickness і Basin Style показують лише доступні значення [code: UI FieldControl].

* Фільтри Prebuilt показують Size {All, 24-29", 30-39", 40-49", 50-59", 60-69", 70-79", 80-89", 90"+} і Style {All, 1 Drawer, 2 Drawer, Single Basin, Double Basin, Asymmetrical, Open Shelving, Multi-level}; для "90"+", "Open Shelving" і "Multi-level" моделей Class немає (у Master File цих значень немає).
* Змішування стилів у Class не блокується відмовою. Картка стилю іншої групи (2DW при наявних 1DW/1DWID і навпаки) лишається видимою, на ній підказка «These cabinet styles cannot be mixed in one vanity configuration.». Клік відкриває діалог «Update Design?»: «Switching to <стиль> will update drawer cabinets in your design to this style. Are you sure you want to proceed?» (Cancel / Approve). Approve переводить усі тумби на обраний стиль, висота змінюється разом зі стилем (40 / 52). Тому композиція завжди має одну групу стилів (2DW окремо; 1DW і 1DWID можна мішати).
* У контекстному меню сцени немає Handle Style, Accessories, Open (#9, Done).
