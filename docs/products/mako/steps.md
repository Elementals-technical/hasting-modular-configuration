<!-- Mako · specification revision 2026-10-28 · part of docs/products/mako/ · statuses: ../_shared/status-legend.md -->

## 3. Кроки і секції
Обидва сценарії мають п'ять кроків. Кроки 2–5 однакові в обох [code: mako/ui.json].

### 3.1 Сценарій Prebuilt
| # | Крок | Блоки (по порядку) | Що налаштовується | Крок у 2D |
| :---- | :---- | :---- | :---- | :---- |
| 1 | Mako Models | фільтр Size, фільтр Style, сітка моделей, деталі моделі | вибір однієї з 42 моделей; "Customize" копіює модель у конструктор тумб | 1 Select Model (Size, Style, Model) [2D L2–L55] |
| 2 | Color | Cabinet Color, Handle Color, Leg Color (перемикач "Enable Legs, Then Color") | 40 кольорів корпусу, 22 кольори ручки, 22 кольори ніжок (лише 2 Drawer) | 2 Select Cabinet Color; 3 Select Handle Style & Color (лише колір); 6 Select Leg Color (у 2D — останній крок) |
| 3 | Countertop & Basin | Countertop Color, Thickness, Countertop Style, Basin Style (заголовок "Vessel Sink Style" для vessel), Vessel Color (лише для vessel) | 70 кольорів, 2 товщини (по одній на матеріал), Integrated / Vessel, 9 інтегрованих раковин або None + 3 vessel, 20–40 кольорів vessel | 4 Select Countertop Color, 5 Select Countertop Basin Style (Thickness, Countertop Style і vessel у 2D немає, вони визначені в документі WebGL) |
| 4 | Faucet Details | Faucet Holes | 0, 1, 2 або 3 отвори | – (у WebGL лише заголовок "Faucet Hole options") |
| 5 | Summary | ціна і список позицій | – | – |

* Handle Style (G57 / G50) окремого блоку в кроках не має. У Create your own його змінюють через меню 3D-сцени (Details → Handle Style) і в правій панелі вибраної тумби. У Prebuilt змінити ручку не можна: спершу потрібно натиснути "Customize" і перейти в Create your own. У 2D Handle Style — частина кроку 3 разом із кольором
* Моделі: 42 моделі, 88 тумб (54 SB, 34 SC); 23 моделі 1 Drawer, 19 — 2 Drawer, з них 12 з ніжками. Усі моделі в Antracite 400 MT (корпус, ручка, ніжки) з G57
* Склад моделей (які тумби, ширини, порядок) клієнт не задає, лише назви й теги → склад моделей **Provisional**
* Моделі не несуть даних стільниці: після вибору моделі стоять дефолти Matte White / Integrated / LB440; колір стільниці може відрізнятися від картинки моделі [backlog: #80, на тесті]

### 3.2 Сценарій Create your own
| # | Крок | Блоки | Що налаштовується |
| :---- | :---- | :---- | :---- |
| 1 | Mako Cabinet Builder | Cabinet Type, Cabinet Style; права панель вибраної тумби: Width, Depth, Handle | додати Sink Base / Side Cabinet; 1 Drawer / 2 Drawer (задає висоту); ширина кожної тумби; глибина показує єдине 52 см; ручка G57 / G50 |
| 2–5 | як у Prebuilt 2–5 |  |  |

* Порядок вибору відповідає клієнтському "Cabinet Type → Cabinet Style → Size Selection"
* Висоти в правій панелі немає: її задає Cabinet Style

### 3.3 Деталі блоків
| Блок | Контрол | Джерело опцій | Коли показаний / активний |
| :---- | :---- | :---- | :---- |
| Cabinet Type | картки з картинками | Sink Base, Side Cabinet | третя Sink Base і ширини понад ліміт довжини вимкнені |
| Cabinet Style | картки з картинками | 1 Drawer, 2 Drawer | інша група ящиків позначена як «змішування обмежене» |
| Width (права панель) | вибір значення | ширини типу тумби (таблиця тумб) | ширини, з якими тумба стане довшою за 220 см, недоступні |
| Depth (права панель) | одне значення | 52 см | завжди |
| Handle (права панель, меню 3D) | випадаючий список; під ним картинка вибраної ручки | G57, G50 | завжди; одна ручка на всю тумбу, з підтвердженням |
| Cabinet Color | свотчі | список кольорів конфігуратора (40) | завжди |
| Handle Color | свотчі | список кольорів конфігуратора (22) | завжди; один колір на всю тумбу |
| Leg Color | перемикач "Enable Legs, Then Color" + свотчі | список кольорів конфігуратора (22) | лише коли тумби 2 Drawer; для 1 Drawer блок Leg Color прихований (не показується) |
| Countertop Color | свотчі | список кольорів конфігуратора (70) | кольори, чий матеріал є в таблиці стільниць Mako |
| Thickness | свотчі (лише доступні значення) | 0.5", 0.8" | одне значення на матеріал, ставиться автоматично |
| Countertop Style | картки з картинками | Integrated, Vessel | обидва доступні для всіх поточних матеріалів [derived] |
| Basin Style | картки з картинками | інтегровані раковини вибраного матеріалу або None / Iris / Frame / Plaza | §5 |
| Vessel Color | свотчі | список кольорів vessel (40) | лише коли вибрано Iris, Frame або Plaza |
| Faucet Holes | свотчі | 0, 1, 2, 3 | завжди; спочатку не вибрано |

Відхилена опція лишається видимою й вимкненою з текстом причини; Thickness і Basin Style показують лише доступні значення.

* Фільтри Prebuilt показують Size {All, 24–29″, 30–39″, 40–49″, 50–59″, 60–69″, 70–79″, 80–89″, 90″+} і Style {All, 1 Drawer, 2 Drawer, Single Basin, Double Basin, Asymmetrical, Open Shelving, Multi-level}; для "90″+", "Open Shelving" і "Multi-level" моделей Mako немає (у 2D таких значень теж немає)

### 3.4 Ієрархія вибору
Кожен рівень обмежує наступні; зміна вищого рівня перевіряє і за потреби скидає нижчі.

1. **Cabinet Type** (SB / SC) → набір ширин; кількість SB ≤ 2
2. **Cabinet Style** (1 Drawer / 2 Drawer) → висота 26 / 52 см; один стиль на всю тумбу; доступність ніжок
3. **Width** → довжина тумби і стільниці (≤ 220 см)
4. **Handle** (G57 / G50) → на всю тумбу
5. **Cabinet Color** → матеріал корпусу (Lacquered MT / GL) → ціна тумби
6. **Handle Color** → на всю тумбу
7. **Leg Color** → лише якщо Cabinet Style = 2 Drawer
8. **Countertop Color** → матеріал стільниці → Thickness і набір інтегрованих раковин
9. **Thickness** → одна на матеріал, автоматично
10. **Countertop Style** (Integrated / Vessel) → який набір раковин показує Basin Style
11. **Basin Style** → для vessel відкриває Vessel Color
12. **Vessel Color** → набір кольорів залежить від vessel
13. **Faucet Holes** → незалежний вибір
