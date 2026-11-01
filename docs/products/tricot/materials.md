<!-- Tricot · specification revision 2026-10-28 · part of docs/products/tricot/ · statuses: ../_shared/status-legend.md -->

## 4. Матеріали

Звірка кількості: усі списки нижче збігаються з Master File клієнта 1:1 (ті самі назви, порядок, категорії)

| Властивість | Категорія | Кількість | Область |
| :---- | :---- | :---- | :---- |
| Cabinet Color | Lacquered MT / Wood Veneer | 20 / 3 = **23** | уся тумба |
| Cabinet Pattern | – | **5** | на кожну тумбу   |
| Handle Groove Color | Lacquered MT | **20** | уся тумба |
| Countertop Color | Solid Surface / HPL / Porcelain / Glass MT / Glass GL | 2 / 14 / 15 / 20 / 20 = **71** | уся стільниця |
| Thickness | – | **5** | уся стільниця |
| Vessel Color | Lacquered MT / Lacquered GL | 20 / 20 = **40** (Provisional) | на кожну vessel |

### 4.1 Cabinet Color (23)
* **Lacquered MT (20):** назви — [`_shared/palettes.md`](../_shared/palettes.md) › GB корпус
* **Wood Veneer (3):** Noce Canaletto 933; Rovere Oro 932; Rovere Termocotto 931.
* Дефолт у конфігураторі: Rovere Oro 932 (клієнт дефолтів не задає)
* Відображення Wood Veneer на ретесті

### 4.2 Cabinet Pattern (5) і обмеження за матеріалом
| Патерн (підпис) | Дозволений матеріал корпусу | Токен SKU |
| :---- | :---- | :---- |
| Loden | лише Lacquered MT | LOD |
| Cannette (підпис "Cannete", як у Master File) | лише Wood Veneer | CAN |
| Twill | лише Wood Veneer | TWLL |
| Gessato | лише Wood Veneer | GES |
| Satin (без рельєфу) | лише Wood Veneer | SAT |

* Наслідок: лакований корпус може мати лише Loden; корпус у шпоні — Cannette, Twill, Gessato або Satin
* Дефолт: Satin
* Патерн — рельєф поверхні фасадів ящиків; колір корпусу лишається видимим

### 4.3 Handle Groove Color (20) [2D L84–L103]
* **Lacquered MT (20):** ті самі 20 назв, що й у лаків корпусу (Grigio Argento 403 MT … Zafferano 412 MT). Без дерева, глянцю чи металу.
* Якщо колір пазу дорівнює кольору корпусу і колір корпусу змінюється на інший лак, паз йде за ним
* Дефолт у конфігураторі: Nero 433 MT на моделях;

### 4.4 Countertop Color (71)
* **Solid Surface (2):** Matte White; Matte White 8cm.
* **HPL (14):** назви — [`_shared/palettes.md`](../_shared/palettes.md) › GB корпус
* **Porcelain (15):** назви — [`_shared/palettes.md`](../_shared/palettes.md) › GB стільниця
* **Glass MT (20):** 20 назв лаків із суфіксом MT (Grigio Argento 403 MT … Zafferano 412 MT).
* **Glass GL (20):** назви — [`_shared/palettes.md`](../_shared/palettes.md) › GB стільниця
* Цінова група (для Solid Surface — Provisional): Matte White → SSTL, Matte White 8cm → SSTMT, HPL → HPL, Porcelain → POR, Glass MT → GLSM, Glass GL → GLSG [code: список кольорів конфігуратора]. Клієнт не вказав, до якої групи Solid Surface належать обидва Matte White

### 4.5 Thickness (5)
| Показано | Значення (дюйми) | Код SKU | Дозволені матеріали [table 593] |
| :---- | :---- | :---- | :---- |
| 0.5" | 1/2 | .5 | Solid Surface (раковини LB), HPL, Glass MT/GL |
| 0.8" | 3/4 | .8 | Porcelain |
| 3.1" | 3-1/8 | 3.1 | лише Solid Surface з VA023 |
| 4" | 4 | 4 | HPL |
| 4.7" | 4-3/4 | 4.7 | Solid Surface (раковини LB), Porcelain |

* Дефолту немає; автоматично ставиться перша дозволена для кольору товщина
* Товщин взяті з прайсу Class

### 4.6 Vessel Color (40) — Provisional
* **Lacquered MT (20)** і **Lacquered GL (20)**: назви лаків із суфіксом MT або GL.
* Iris і Frame: лише Lacquered MT; Plaza: Lacquered MT і Lacquered GL. Попередньо вибрані: Iris Salvia 415 MT, Frame Fumo 401 MT, Plaza Antracite 400 MT
* У жодному клієнтському файлі Tricot не визначено; взято з Class
