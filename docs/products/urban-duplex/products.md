<!-- Urban Duplex · specification revision 2026-10-28 · part of docs/products/urban-duplex/ · statuses: ../_shared/status-legend.md -->

## 2. Продукти
### 2.1 Сімейства продуктів
| Продукт | Код | Ширина (см / дюйми) | Висота (см) | Глибина | Ящики (стиль) | Ручка | Lateral Panel | Раковина |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| Sink Base | SB | {60, 70, 80, 90, 105, 120} / {23.6, 27.6, 31.5, 35.4, 41.3, 47.2} | {56, 53, 38, 28} за стилем (§2.2) | {46 см / 18.1", 50 см / 19.7"} | {2DW, 1DW, 1DWID} | {UG} | {L, R} | так, одна на Sink Base |
| Side Cabinet (Urban Duplex) | SC | {60, 70, 80, 90, 105, 120} | {56, 53, 38, 28} за стилем | {46, 50} | {2DW, 1DW, 1DWID} | {UG} | {L, R} | ні |
| Side Cabinet Urban Standard (гібрид) | SC | {25, 35, 50, 60, 70, 80, 90, 105, 120} / {9.8, 13.8, 19.7, 23.6 … 47.2} | {56 для 2DW, 53 для 1DW / 1DWID} | {46, 50} | {2DW, 1DW, 1DWID} | {UG}, повна ручка | немає | ні |
| Side Cabinet Urban Low Height (гібрид) | SC | {25, 35, 50, 60, 70, 80, 90, 105, 120} | {38, 28} | {46, 50} | {1DW} | {UG}, повна ручка | немає | ні |
| Open Shelf | OS | {25, 35, 50, 60, 70} / {9.8, 13.8, 19.7, 23.6, 27.6} | {56, 53 — 2 полиці; 38, 28 — 1 полиця} | {46, 50} | – | – | – | ні |
| Open Side Shelf | OSS | {15} / {5.9} | {56, 53, 38, 28} (38 підтримується від v100, §7.1) | {46, 50} | – | – | бік L / R за місцем | ні |
| Side Panel (аксесуар) | SP | – | – | – | – | – | – | Not implemented (§6.2) |

* Висота і глибина — одні на всю композицію (Height і Depth передаються всім тумбам) [derived]; ширина задається на кожну тумбу
* Side Cabinet серії Urban Duplex має лише ширини 60–120: 25 / 35 / 50 є в SKU Curation клієнта, але без цін; ці ширини доступні лише як Side Cabinet серій Urban Standard і Urban Low Height
* Гібридні тумби (URSTD / URLH) — це Side Cabinet; у моделях є два винятки з Sink Base іншої серії: модель "83'' 1-Drawer Slim" (Sink Base URLH) і "89'' 2-Drawer" (усі тумби URSTD)
* Кількість SKU у клієнта: SB 120, SC 180, OS 40, OSS 16 → 356; ціни в прайсі Urban Duplex лише для 222 (SB 120, SC 102); OS і OSS — "Use existing cabinet prices" (USH / ULH)
* Глибина (50 = 46) і бік (L = R) не змінюють ціну там, де рядки існують. У прайсі відсутні: Side Cabinet 2DW на 46 см (лише 50 см) та Side Cabinet 1DW 15.0H / 46 см із панеллю зліва (лише справа) — для них ціни може не бути (gap)

### 2.2 Стилі ящиків і висота
| Підпис в UI | Код | Висота (см / дюйми) | Значення |
| :---- | :---- | :---- | :---- |
| 2 Drawer | 2DW | 56 / 22.0 | два ящики; фасад кожного — Base Panel + частина Lateral Panel |
| 1 Drawer | 1DW | 53 / 20.9; Slim: 38 / 15.0, 28 / 11.0 | один ящик; 38 і 28 — "1 Drawer Slim - 15" H" і "- 11" H" |
| 1 Drawer With Inner Drawer | 1DWID | 53 / 20.9 | один фасадний ящик із внутрішнім; ціна як у 1DW |

* 1DW і 1DWID змішуються; 2DW з ними ні ("Cannot mix 1 Drawer and 2 Drawer cabinet styles in one vanity configuration.")
* Висота 1DW (53 / 38 / 28) вибирається полем Height у правій панелі вибраної тумби. Окремих карток "1 Drawer Slim" (п'ять карток у ескізі клієнта) немає — **Provisional** (у клієнта це "may display", підписи карток не узгоджені, DUP-STY-01)
* Стиль, що потребує іншої висоти, ніж у поставлених тумб, питає підтвердження і перемикає всі тумби (напр., Slim → 1DWID і 53 см; Urban Low Height → 1 Drawer і 38 см); "Cancel" лишає як було
* Cabinet Style для Side Cabinet має три групи: **Urban Duplex** (2 Drawer, 1 Drawer, 1 Drawer With Inner Drawer), **Urban Standard** (ті самі три), **Urban Low Height** (1 Drawer). Для Sink Base груп немає (лише Urban Duplex). Стиль серії, яка не може стати поруч із поставленою тумбою іншої серії, вимкнено з текстом "Not available with the {series} cabinet in this design."

### 2.3 Ручка і Lateral Panel
* Ручка завжди Upper Groove: "Urban Duplex only utilizes the Urban upper groove handle – ergo, no handle selection". Поле Handle у правій панелі має одне значення UG
* **Lateral Panel** — вертикальна панель-ручка на одному боці фасаду тумби (на 2DW — з двох частин). Бік L / R ("Lateral Panel") задається у правій панелі вибраної тумби і в меню плеєра, на кожну тумбу окремо; дефолт R (Provisional: клієнт дефолту не задає, DUP-PNL-01). Лише для тумб серії Urban Duplex
* Ширина Lateral Panel не налаштовується (задана 3D-моделлю); клієнт її не визначив
* Паз ручки фарбується кольором Lateral Panel; окремого вибору кольору пазу немає — **Provisional** (клієнт: "Contrasting Handle Groove Color applies", але в усіх його прикладах SKU колір HDL = LTLP, і в 2D опції пазу немає; DUP-PNL-02)
* Гібридні тумби URSTD / URLH: без Lateral Panel, у 3D повна ручка (HandleStyle Default); корпус у кольорі Base Panel, паз — у кольорі Lateral Panel

### 2.4 Багаторівневі моделі (Multi-level, колони)
* П'ять моделей Multi-level: 57", 61", 70", 71", 94". Усі тумби 28 см; верхній рівень — тумби під стільницею (зі Sink Base), нижній — тумби, опущені на 28 см і зсунуті вбік [code: urban-duplex/presets.json]
* UI перетворює їх у колони сцени: одне місце ряду тримає дві тумби — верхня висить від площини стільниці, нижня стоїть під нею зі зсувом. Це не стекінг: тумба на тумбу не ставиться ("Urban Duplex cabinets cannot be stacked.")
* У Create your own колону можна зібрати кнопками "+" (вирівняно) або drag-and-drop (зі зсувом) — перевірити на тесті
* Номінальна глибина п'яти Multi-level у даних — 50 см (виправлено з непідтримуваних 50.5 см 2026-11-03). У v99 вона застосовується, але фізична глибина тумб / OS становить 50.5 см, а стільниць — 50 см; узгодження геометрії — **UNKNOWN — clarify**, [HO-011](../../ai/qa/handoffs/HO-011-urban-duplex-nominal-depth-geometry.md). Для 57" і 71" окремої перевірки цільової глибини за 2D немає; 50 см — нормалізація попередньої глибокої версії
* Нижня тумба без стільниці над собою отримує нижню стільницю (Lower, §4.3) — **Provisional**
* Клієнт: multi-level лише з тумбами 38H / 28H однакової висоти; зсув, яка тумба внизу і де стільниця — не визначено; для 57" і 71" складу немає. Склад наших моделей 57" і 71" — наш (**Provisional**)

### 2.5 Типи продуктів, яких у Urban Duplex немає
* Ручки PTO і Central Groove, fluting (Ryan: "Urban Duplex – does not have a fluting option"), 2DW у висотах 53 / 38 / 28, стекінг (тумба на тумбі), undermount: Not in scope; ніжки — UNKNOWN — clarify (§6.2)
* Side Panels і Drawer Dividers: клієнт називає їх ("same as USH + ULH"), у збірці немає — Not implemented (§6.2)
