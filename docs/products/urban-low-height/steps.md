<!-- Urban Low Height · specification revision 2026-10-28 · part of docs/products/urban-low-height/ · statuses: ../_shared/status-legend.md -->

## 3. Кроки і секції
Обидва сценарії мають п'ять кроків. Кроки 2–5 однакові в обох [code: urban-low-height/ui.json]. Колекція відкривається з ?collectionId=urban-low-height (за замовчуванням застосунок відкриває USH).

### 3.1 Сценарій Prebuilt
| # | Крок | Блоки (по порядку) | Що налаштовується | Крок у 2D |
| :---- | :---- | :---- | :---- | :---- |
| 1 | Urban Low Height Models | фільтр Size, фільтр Style, сітка моделей, деталі моделі | вибір однієї з 59 моделей | 1 Select Model (Size, Style, Model) [2D L2–L74] |
| 2 | Color | Cabinet Color, Handle Groove Color (Optional), Drawer Panel Fluting | колір корпусу; колір пазу (лише Upper Groove); fluting (лише Lacquered MT) | 2 Select Cabinet Color (колір пазу й fluting у 2D немає) |
| 3 | Countertop & Basin | Countertop Color (вкладки Upper / Lower, коли є кавер), Thickness, Countertop Style, Basin style (заголовок "Vessel Sink Style" для vessel), Vessel Color | колір основної стільниці й кавера, товщина, Integrated / Vessel, раковина або vessel, колір vessel | 3 Select Countertop Color, 4 Select Countertop Basin Style (Thickness, Style і vessel у 2D немає) |
| 4 | Accessories | Side Panels, Towel Bar | None / No groove / 1 groove (upper); рушник None / Left / Right / Both і його колір | немає (клієнт: "Accessories – Same as Urban Standard Height") |
| 5 | Summary | ціна і список позицій | – | – |

* Фільтри: Size {All, 24-29", 30-39", 40-49", 50-59", 60-69", 70-79", 80-89", 90"+}; Style {All, 1 Drawer, Single Basin, Double Basin, Asymmetrical, Open Shelving, Multi-level}
* 59 моделей, як у 2D. Розкладу моделей на шафи клієнт не дав, тому композиції наші (Provisional):
  * 53 звичайні моделі: усі шафи 38 см, глибина 46 см, Upper Groove, Rox Black TKQ; 12 моделей містять Open Shelf; 11 моделей мають дві Sink Base. Стільниця й раковина беруться з дефолтів (Bianco Male TFA, Fenix Prisma 50) або переносяться з попередньої моделі
  * 6 моделей Multi-Level (60", 61", 70", 73", 82", 83"): два ряди (нижній на 38 см нижче), стільниця 0.5″ Bianco Male TFA з раковиною Fenix Cover 50, кавер на нижньому ряду
  * Жодна модель не має Push to open, висоти 35 / 28 / 25 або fluting
* Resize і Reposition шафи в Prebuilt пропонують перейти в Create your own; Drag & Drop стільниці доступний в обох сценаріях

### 3.2 Сценарій Create your own
| # | Крок | Блоки | Що налаштовується |
| :---- | :---- | :---- | :---- |
| 1 | Urban Low Height Cabinet Builder | Cabinet Type, Cabinet Style; права панель вибраної шафи: Width, Depth, Height, Handle | додати Sink Base / Side Cabinet / Open Shelf (кнопкою "+" або Drag to Place); 1 Drawer / 1 Drawer Slim; розміри; ручка |
| 2–5 | як у Prebuilt 2–5 |  |  |

* Порожній конструктор стартує з висоти 38 см і Upper Groove
* Кнопка "Drag to Place" з'являється над композицією, поки показані "+"; вона одразу ставить шафу-чернетку, яку можна тягнути

### 3.3 Деталі блоків
| Блок | Контрол | Джерело опцій | Коли показаний / активний |
| :---- | :---- | :---- | :---- |
| Cabinet Type | картки з картинками | Sink Base, Side Cabinet, Open Shelf | третя Sink Base вимкнена; "+" ховається там, куди шафа стати не може |
| Cabinet Style | картки з картинками | 1 Drawer, 1 Drawer Slim | картка іншої висоти сіра з "Cannot mix 1 Drawer and 1 Drawer Slim…"; вибір після "Update Design?" переводить усі шафи |
| Width / Depth / Height / Handle | селектори правої панелі | таблиця 580 | Height — лише висоти вибраної ручки; для Open Shelf Height і Handle немає |
| Cabinet Color | свотчі з фільтрами Material / Color | конфігуратор 4, група Cabinet Color | завжди; один колір на всю композицію |
| Handle Groove Color | свотчі, перший "None" | конфігуратор 4, група Handle Groove Color | лише з Upper Groove |
| Drawer Panel Fluting | картки з картинками | None, Vertical A, Vertical B, Horizontal A, Horizontal B | лише для кольору Lacquered MT |
| Countertop Color | свотчі з фільтрами Material / Color; вкладки Upper / Lower | конфігуратор 4, група Countertop Color | кольори, чий матеріал підходить ширині, глибині й позиції стільниці (таблиця 589); відхилені — з причиною |
| Thickness | свотчі (усі 6 значень; недоступні для матеріалу й глибини вимкнені) | 0.4″, 0.5″, 2.4″, 4″, 5.1″, 5.5″ | значення, які таблиця 589 дає матеріалу і глибині |
| Countertop Style | картки з картинками | Integrated, Vessel | обидва; блокується, поки стільниця несе раковину поза Sink Base |
| Basin style | картки з картинками | інтегровані раковини матеріалу стільниці або None / 5 vessel | §5; блокується, поки стільниця несе раковину |
| Vessel Color | свотчі | конфігуратор 4, група Vessels | лише з vessel; кольори, які приймає вибраний vessel |
| Side Panels | картки з картинками | None, No groove, 1 groove (upper) | §6.1 |
| Towel Bar | свотчі + картки кольору | None, Left, Right, Both; група Towel Bar Color | колір — лише коли рушник вибрано |

Відхилена опція лишається видимою й вимкненою з текстом причини. Виняток — Basin style: ховаються раковини іншого стилю (Integrated / Vessel) та інтегровані раковини, яких немає в таблиці 589 для вибраного кольору; раковини, що не підходять за товщиною чи шириною Sink Base, лишаються видимими й вимкненими. У Thickness завжди видно всі 6 значень, недоступні — вимкнені.

### 3.4 Меню вибраного об'єкта в 3D
| Об'єкт | Prebuilt | Create your own |
| :---- | :---- | :---- |
| Шафа | Resize, Reposition (обидва ведуть у Create your own), Color, Add, Details, Duplicate, Open, Delete | Resize ▸ Width / Depth / Height; Reposition ▸ Move Left / Move Right / Drag & Drop; Color; Add; Details (Cabinet Style, Handle Style, Accessories); Duplicate (сховано для третьої Sink Base); Open; Delete |
| Стільниця | Color; Resize ▸ Thickness / Length; Countertop Style; Basin Style; Position ▸ Standard / Drag & Drop; для vessel — Vessel Style / Vessel Color | так само |

* Resize ▸ Length — лише для товщин 4″, 5.1″, 5.5″; Position — для 2.4″ і товщих (§7.3)
