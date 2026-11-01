<!-- Urban Freestanding · specification revision 2026-10-28 · part of docs/products/urban-freestanding/ · statuses: ../_shared/status-legend.md -->

## 2. Продукти
### 2.1 Сімейства продуктів
| Продукт | Код | Ширина (см / дюйми) | Висота (з цоколем 3 см) | Глибина | Ящики | Ручка | Fluting | Раковина |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| Sink Base | SB | {60, 70, 80, 90, 105, 120} / {23.6, 27.6, 31.5, 35.4, 41.3, 47.2} | {91 см / 35.8" для UG, CG; 88 см / 34.6" для PTO} | {46 см / 18.1", 50 см / 19.7"} | {2DW} | {UG, PTO, CG} | {None + 4 патерни} | так, одна на Sink Base |
| Side Cabinet | SC | {25, 35, 50, 60, 70, 80, 90, 105, 120} / {9.8, 13.8, 19.7, 23.6, 27.6, 31.5, 35.4, 41.3, 47.2} | так само, як Sink Base | {46, 50} | {2DW} | {UG, PTO, CG} | {None + 4 патерни} | ні |
| Floor-Mount Short Cabinet (Provisional) | SC (1DW) | ті самі, що Side Cabinet | {56 см / 22" для UG, CG; 53 см / 20.9" для PTO} | {46, 50} | {1DW} | за композицією | UNKNOWN — clarify | ні |
| Open Shelf (3 полиці) | OS | {25, 35, 50} / {9.8, 13.8, 19.7} | {91 поруч з UG/CG, 88 поруч з PTO} (у SKU 88H / 85H) | {46, 50} | – | – | ні | ні |
| Open Side Shelf (лівий / правий) | OSS | {15} / {5.9} | {88, лише з PTO} (у SKU 85H) | {46, 50} | – | – | ні | ні |
| Side Panel (аксесуар) | SP | товщина 1 см (.4") | за тумбою (§6.1) | за тумбою | – | – | ні (гладка або з пазом) | – |

* Висоти 53 / 56 / 88 / 91 включають цоколь 3 см (91 = 88 + 3, 88 = 85 + 3) [price: UF xlsx SKU Curation B8, E8, H8]; вибору висоти немає — її задає ручка (§2.3)
* Підписи типів в UI: Sink Base, Side Cabinet, Open Shelf, Open Side Shelf, Floor-Mount Short Cabinet; Side Cabinet у даних має значення Sink-Cabinet (як у таблиці 590)
* Коротка тумба: у клієнта названа ("New 1DW Floor-Mount Short Cabinet"), але розмірів, SKU і цін немає; ширини й висоти 53/56 — наші (таблиця 590) → **Provisional**, ціни немає (§8)
* Кількість SKU у клієнта: SB 3 ручки × 5 fluting × 2 глибини × 6 ширин = 180; SC 3 × 5 × 2 × 9 = 270; OS 3 ширини × 2 висоти × 2 глибини = 12; OSS 2 боки × 2 глибини = 4 → 466. Коротка тумба й бокова панель у прайсі UF відсутні

### 2.2 Стилі ящиків
| Підпис в UI | Код | Значення |
| :---- | :---- | :---- |
| 2 Drawer | 2DW | два ящики; єдиний стиль для Sink Base і Side Cabinet (усі 54 моделі — 2-Drawer) |
| 1 Drawer | 1DW | один ящик; лише коротка тумба (Floor-Mount Short Cabinet) |

* 1DWID у Urban Freestanding немає
* 1 Drawer і 2 Drawer не змішуються ("Cannot mix 1 Drawer and 2 Drawer cabinet styles…"), окрім короткої тумби — вона стоїть поруч із 2DW

### 2.3 Ручка
| Підпис в UI | Код | Висота тумби (коротка) | Паз / колір пазу |
| :---- | :---- | :---- | :---- |
| Upper Groove | UG | 91 (56) | верхній паз, колір пазу є |
| Central Groove | CG | 91 (56) | центральний паз, колір пазу є |
| Push-to-Open | PTO | 88 (53) | без пазу |

* Ручка одна на всю композицію: зміна на поставлених тумбах питає підтвердження "The handle style will be updated for all drawer cabinets."
* Висоту тумби бере UI з таблиці 590 за ручкою; 3D висоту з ручки не виводить, а лише показує паз за отриманою висотою (CG на 91 — окремий варіант фасадів) [code: handleRule.ts, table 590] [3D: RuleHandleCabinetUrbanFreestanding]. Внутрішня примітка "ручка не змінює висоту (з 22.10)" стосується 3D — **перевірити на тесті**, що PTO дає 88/53
* Значення за замовчуванням — UG (моделі мають UG); у клієнта дефолту немає
* Open Shelf і Open Side Shelf ручки не мають; Open Side Shelf можлива лише з PTO
* Селектор ручки — у правій панелі вибраної тумби (разом із Width і Depth) [derived]

### 2.4 Fluting (Drawer Panel Fluting)
* Набір: {None, FlutingVerticalA, FlutingVerticalB, FlutingHorizontalA, FlutingHorizontalB}; токени SKU X / CVA / CVB / CHA / CHB
* Fluting лише для кольорів корпусу **Lacquered MT**; для інших матеріалів скидається на None ("Fluting is available only for Lacquer Matte (LACM).")
* Лише на фасадах ящиків, ніколи на бокових панелях, Open Shelf чи Open Side Shelf
* Fluting задається на кожну тумбу; дефолт None
* Дефолтний колір корпусу (Metal acciaio 2MA, Brushed Metal) fluting не допускає

### 2.5 Цоколь
* Один спільний цоколь на композицію в 3D, колір першої тумби; окремого вибору, SKU чи ціни немає (входить у висоту тумби)
* Якщо в композиції змішані глибини 46 і 50, цоколь ховається (попередження в консолі) — UNKNOWN — clarify, чи це прийнятно
* Ніжок немає (Not in scope: у даних клієнта для UF ніжок немає)

### 2.6 Типи продуктів, яких у Urban Freestanding немає
* 1DWID, тумби на ніжках, підвісні тумби: немає в прайсі й тексті UF
* Багаторівневі (multi-level) композиції і другий ряд тумб: Not in scope — UF лінійна композиція
