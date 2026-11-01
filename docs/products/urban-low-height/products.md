<!-- Urban Low Height · specification revision 2026-10-28 · part of docs/products/urban-low-height/ · statuses: ../_shared/status-legend.md -->

## 2. Продукти
### 2.1 Сімейства продуктів
| Продукт | Код | Ширина (см / дюйми) | Висота (см) | Глибина (см / дюйми) | Ящики | Ручка | Fluting | Раковина | Статус |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| Sink Base | SB | {60, 70, 80, 90, 105, 120} / {23.6, 27.6, 31.5, 35.4, 41.3, 47.2} | {38, 28} з UG; {35, 25} з PTO | {46, 50} / {18.1, 19.7} | {1 Drawer} | {Upper Groove, Push to open} | лише Lacquered MT | так, одна на Sink Base | Ready |
| Side Cabinet | SC | {25, 35, 50, 60, 70, 80, 90, 105, 120} / {9.8, 13.8, 19.7, 23.6, 27.6, 31.5, 35.4, 41.3, 47.2} | як у SB | {46, 50} | {1 Drawer} | як у SB | лише Lacquered MT | ні | Ready |
| Open Shelf | OS | {25, 35, 50, 60, 70} | {38, 35, 28, 25} (за шафами композиції) | {46, 50} | – | немає | немає | ні | Ready (див. нижче) |
| Open Side Shelf | OSS | {15} | {35, 25} | {46, 50} | – | немає (лише з PTO) | немає | ні | **Not implemented** |
| Side Panel (аксесуар) | SP | товщина 1 см (.4″) | як у шаф | як у шаф | – | – | ні | – | Ready / Provisional (§6.1) |

* Open Shelf 80–120 см при висоті 28 / 25 см є в таблиці 580 і в прайсі клієнта, але конструктор їх не пропонує (колонку ширин за висотою ніхто не читає) — **Not implemented**
* Open Side Shelf є в профілі й таблиці 580, але в 3D немає моделі: картка прихована в конструкторі, ціни немає — **Not implemented**
* Глибина: у документі клієнта 50.5 см, у прайсі й відповідях Ryan 50 см; збірка використовує 46 / 50 і читає 50.5 як 50
* Кількість SKU у клієнта: SB 6 ширин × 4 висоти (2 UG + 2 PTO) × 5 fluting × 2 глибини = 240; SC 9 × 4 × 5 × 2 = 360; OS 56; OSS 8 → 664

### 2.2 Стиль ящиків (Cabinet Style)
| Картка в UI | Код у SKU | Висота | Значення |
| :---- | :---- | :---- | :---- |
| 1 Drawer | 1DW | 38 см (UG) / 35 см (PTO) | один ящик, звичайна висота |
| 1 Drawer Slim | 1DW | 28 см (UG) / 25 см (PTO) | один ящик, низька висота |

* Обидві картки — той самий один ящик; відрізняються лише висотою. Рендерів Slim ще немає: обидві картки показують ту саму картинку
* 2 Drawer, 1 Drawer + Inner Drawer і Central Groove у ULH немає (клієнт: "only 1 Drawer units are available for Urban LH")

### 2.3 Ручка і висота
| Підпис в UI | Значення | Код SKU | Висоти | Паз і колір пазу |
| :---- | :---- | :---- | :---- | :---- |
| Upper Groove | handle_urban_topcut | UG | 38, 28 | є; колір пазу на вибір |
| Push to open | handle_pto | PTO | 35, 25 | немає |

* Одна ручка на всю композицію; зміна з уже поставленими шафами просить підтвердження "The handle style will be updated for all drawer cabinets."
* Без явного вибору діє Upper Groove (і в UI, і в ціні); у 3D дефолт сцени — Push to open, але UI завжди надсилає ручку
* Висоту вибирають у трьох місцях: картки Cabinet Style, Height у правій панелі, Resize ▸ Height у меню шафи. Кожне показує лише дві висоти вибраної ручки
* Open Shelf ручки не має; поки вибрано Open Shelf, Height і Handle не пропонуються

### 2.4 Fluting (Drawer Panel Fluting)
| Підпис в UI | Значення | Код SKU |
| :---- | :---- | :---- |
| None | None | X |
| Vertical A | FlutingVerticalA | CVA |
| Vertical B | FlutingVerticalB | CVB |
| Horizontal A | FlutingHorizontalA | CHA |
| Horizontal B | FlutingHorizontalB | CHB |

* Лише для кольорів корпусу Lacquered MT; лише фасади ящиків SB і SC (не Open Shelf, не бокові панелі)
* У 2D клієнта кроку fluting немає; правило клієнт дав для USH і підтвердив для ULH ("Urban Standard Height, Urban Low Height + Urban Freestanding use the same fluted patterning options and logic")
* У Prebuilt fluting ставиться на всі шафи, у Create your own — на кожну шафу окремо

### 2.5 Типи продуктів, яких у Urban Low Height немає
* 2 Drawer, 1DWID, Central Groove — клієнт виключає (§2.2) — Not in scope
* Open Side Shelf — є в даних клієнта, у збірці немає (§2.1) — **Not implemented**
* Undermount — "We don't have Undermount in the experience currently" — Not in scope
