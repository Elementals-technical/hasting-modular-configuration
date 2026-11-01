<!-- Urban Freestanding · specification revision 2026-10-28 · part of docs/products/urban-freestanding/ · statuses: ../_shared/status-legend.md -->

## 4. Матеріали
Звірка кількості з Master File: Cabinet Color 232 = 232 (+3 Wood Veneer лише в конфігураторі); Countertop Color 61 = 61 у конфігураторі, 60 видимих; Basin Style 13 = 13. Handle Color, Vessel Color і Towel Bar Color у 2D немає.

| Властивість | Категорія | Кількість | Область |
| :---- | :---- | :---- | :---- |
| Cabinet Color | 3D / Lacquered MT / Lacquered GL / Soft-Touch / Brushed Metal / HPL / Essenze (+ Wood Veneer) | 32 / 58 / 58 / 58 / 4 / 12 / 10 = **232** (+3 = 235) | уся композиція |
| Handle Color | ті самі 7 категорій + 20 лаків Tricot "MT" | 232 + 20 = **252** (Provisional) | паз, UG / CG |
| Drawer Panel Fluting | – | **4** + None | на кожну тумбу |
| Countertop Color | Solid Surface / Fenix / HPL / Porcelain | 1 / 9 / 12 / 38 = **60** видимих (61 у 2D) | уся стільниця |
| Thickness | – | **1** (0.5") | уся стільниця |
| Vessel Color | Ceramic / Tekorlux / Solid Surface (+ 40 лаків Tricot) | 5 / 2 / 2 = **9** робочих (49 у списку) (Provisional) | на кожну vessel |
| Towel Bar Color | Lacquered MT | **5** (Provisional) | рушникотримач |

### 4.1 Cabinet Color (232 + 3)
* **3D (32):** назви — [`_shared/palettes.md`](../_shared/palettes.md) › Urban корпус
* **Lacquered MT (58):** назви — [`_shared/palettes.md`](../_shared/palettes.md) › Urban корпус
* **Lacquered GL (58):** ті самі 58 назв із суфіксом GL (той самий порядок).
* **Soft-Touch (58):** ті самі 58 назв із суфіксом ST.
* **Brushed Metal (4):** Metal acciaio 2MA; Metal piombo 2MB; Metal titanio 2MC; Metal bronzo 2MD.
* **HPL (12):** назви — [`_shared/palettes.md`](../_shared/palettes.md) › Urban корпус
* **Essenze (10):** назви — [`_shared/palettes.md`](../_shared/palettes.md) › Urban корпус
* **Wood Veneer (3, лише в конфігураторі):** Noce Canaletto 933; Rovere Oro 932; Rovere Termocotto 931 — кольори Tricot; у 2D UF їх немає, SKU будується з матеріалом WDV (наприклад CAB-WDV-933), але у прайсі UF немає колонки WDV → ціни немає; кольори потрібно приховати
* Дефолт у конфігураторі: Metal acciaio 2MA (клієнт дефолтів не задає); нова тумба бере колір композиції
* Цінова колонка за категорією: 3D → 3D, Lacquered MT → LACM, Lacquered GL → LACG, Soft-Touch → ST, Brushed Metal → BM, HPL → HPL, Essenze → ESS. Колонка прайсу "White GL/MT" не використовується — до неї не прив'язаний жоден колір (UNKNOWN — clarify)

### 4.2 Drawer Panel Fluting (4) і обмеження за матеріалом
| Патерн (значення) | Токен SKU | Дозволений матеріал корпусу |
| :---- | :---- | :---- |
| None | X | будь-який |
| FlutingVerticalA | CVA | лише Lacquered MT |
| FlutingVerticalB | CVB | лише Lacquered MT |
| FlutingHorizontalA | CHA | лише Lacquered MT |
| FlutingHorizontalB | CHB | лише Lacquered MT |

* Патерн — рельєф фасадів ящиків поверх кольору корпусу (A — крупніший крок, B — дрібніший); у прайсі клієнта рифлені SKU мають ціну лише в колонці LACM

### 4.3 Handle Color (252) — Provisional
* Ті самі 232 кольори, що й Cabinet Color, плюс 20 лаків Tricot "<назва> MT" (Acqua 419 MT … Zaffiro 411 MT)
* Показується лише при UG або CG; до вибору паз іде за кольором корпусу ("cabinetColor.grooveFollows"); при PTO колір пазу скидається
* У 2D UF вибору кольору пазу немає, але SKU клієнта має елемент HDL-<матеріал>-<колір>; пропонуємо як у USH, клієнт ще не підтвердив
* 20 лаків Tricot у списку зайві для UF

### 4.4 Countertop Color (60 видимих з 61)
* **Solid Surface (1 видимий з 2):** Matte White (**вимкнений**: для нього немає рядка в таблиці 591); Gloss White прихований (немає SKU).
* **Fenix (9):** назви — [`_shared/palettes.md`](../_shared/palettes.md) › Urban стільниця
* **HPL (12):** ті самі 12 назв, що й HPL корпусу (Rovere Monet TK3 … Rox Black TKQ).
* **Porcelain (38):** назви — [`_shared/palettes.md`](../_shared/palettes.md) › Urban стільниця
* Дефолт у конфігураторі: Bianco Statuario Venato Matte TQV (клієнт дефолтів не задає)
* Нижня стільниця (Lower, над короткою тумбою): та сама палітра; до вибору — колір верхньої (Upper) стільниці → **Provisional**
* Цінова група: Porcelain → POR, HPL → HPL, Fenix → FX, Solid Surface Matte White → SSTL (Provisional)

### 4.5 Thickness (1)
| Показано | Значення (дюйми) | Код SKU | Дозволені матеріали [table 591] |
| :---- | :---- | :---- | :---- |
| 0.5" | 1/2 | .5 | усі (Fenix, HPL, Porcelain) |

* Клієнт: "Urban Freestanding is only available for thin countertops (.4 or .5")"; токен .4" (3/8) не пропонується — Porcelain 3/8 vs 1/2 чекає відповіді клієнта
* Кронштейнів (brackets) немає: вони лише для товстих стільниць

### 4.6 Vessel Color (9 робочих) — Provisional
* **Ceramic (5):** Antracite Matte OCF; Cemento Matte OCD; Cenere Matte OCE; Gloss White OCB; Matte White OCC — для Blade 11 і Blade 18.
* **Solid Surface (2):** Matte Black T1D; Matte White T1C — для Urban Modo (дефолт T1C).
* **Tekorlux (2):** Bianco Gloss TAL; Bianco Matte TAM — для Urban Morris.
* У списку конфігуратора ще 40 лаків Tricot (20 MT, 20 GL), які не підходять жодній vessel UF
* У жодному клієнтському файлі UF vessel і їх кольори не визначено; взято з USH

### 4.7 Towel Bar Color (5) — Provisional
* **Lacquered MT (5):** Bianco 0B MT; Carbone 43 MT; Metallizzato Copper M7 MT; Metallizzato Creta M6 MT; Nero 03 MT (збігається з переліком USH: Bianco, Carbone, Creta, Copper, Nero)
