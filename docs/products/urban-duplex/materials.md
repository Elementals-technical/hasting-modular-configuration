<!-- Urban Duplex · specification revision 2026-11-03 · part of docs/products/urban-duplex/ · statuses: ../_shared/status-legend.md -->

## 4. Матеріали
Звірка: списки Base Panel, Lateral Panel і Countertop Color збігаються з Master File клієнта 1:1 (ті самі назви й категорії; порядок у конфігураторі алфавітний). Vessel Color і Towel Bar Color у 2D немає.

| Властивість | Категорія | Кількість | Область |
| :---- | :---- | :---- | :---- |
| Base Panel | 3D / Lacquered MT / Lacquered GL / Soft-Touch / Brushed Metal / HPL / Essenze | 32 / 58 / 58 / 58 / 4 / 12 / 10 = **232** | уся композиція |
| Lateral Panel | ті самі категорії | **232** (той самий список) | уся композиція (+ паз, Open Side Shelf) |
| Countertop Color | Solid Surface / Fenix / HPL / Porcelain | 2 / 9 / 12 / 38 = **61** (60 видимих) | уся стільниця |
| Thickness | – | **5** | уся стільниця |
| Vessel Color | Ceramic / Tekorlux / Solid Surface | 5 / 2 / 2 = **9** (Provisional) | на кожну vessel |
| Towel Bar Color | Lacquered MT | **5** (Provisional) | рушникотримач |

### 4.1 Base Panel (232)
* **3D (32):** назви — [`_shared/palettes.md`](../_shared/palettes.md) › Urban корпус
* **Lacquered MT (58):** назви — [`_shared/palettes.md`](../_shared/palettes.md) › Urban корпус
* **Lacquered GL (58):** ті самі 58 назв із суфіксом " GL".
* **Soft-Touch (58):** ті самі 58 назв із суфіксом " ST".
* **Brushed Metal (4):** Metal acciaio 2MA; Metal piombo 2MB; Metal titanio 2MC; Metal bronzo 2MD.
* **HPL (12):** назви — [`_shared/palettes.md`](../_shared/palettes.md) › Urban корпус
* **Essenze (10):** назви — [`_shared/palettes.md`](../_shared/palettes.md) › Urban корпус
* Де застосовується: корпус і базова частина фасадів тумб Urban Duplex; корпус гібридних тумб URSTD / URLH; Open Shelf
* Дефолт у конфігураторі: Bianco Calce DA ST (клієнт дефолтів не задає)

### 4.2 Lateral Panel (232)
* Той самий список і ті самі категорії, що в §4.1 (у 2D — значення в значення)
* Де застосовується: Lateral Panel тумб Urban Duplex, паз ручки всіх тумб (включно з URSTD / URLH), корпус Open Side Shelf — **Provisional** (як на рендерах клієнта)
* Дефолт у конфігураторі: Pulpis Chiaro TKH
* Колір кожної панелі один на всю композицію; чи може клієнт хотіти різні кольори на різних тумбах — UNKNOWN — clarify (GEN-MAT-02)

### 4.3 Countertop Color (60 видимих з 61)
* **Solid Surface (2):** Gloss White; Matte White.
* **Fenix (9):** назви — [`_shared/palettes.md`](../_shared/palettes.md) › Urban стільниця
* **HPL (12):** ті самі 12 назв, що в HPL корпусу (Rovere Monet TK3 … Rox Black TKQ).
* **Porcelain (38):** назви — [`_shared/palettes.md`](../_shared/palettes.md) › Urban стільниця
* Solid Surface: Gloss White прихований (немає SKU матеріалу); Matte White видимий, але в таблиці 595 немає рядка Solid Surface, тому він вимкнений [derived] → **UNKNOWN — clarify** (до якої групи Solid Surface USH належить, GEN-MAT-01)
* Цінова група: HPL → HPL, Fenix → FX, Porcelain → POR, Matte White → SSTL
* Дефолт у конфігураторі: Pulpis Chiaro TKH (HPL)
* **Lower (нижня стільниця) — Provisional:** з'являється на кроці як Upper / Lower, коли сцена кладе покриття на голий верх нижньої тумби (Multi-level, зсунуті тумби). Кольори — ті самі, що в Upper; дефолт — колір Lateral Panel, якщо це один із кольорів стільниці (лише HPL), інакше колір Upper; товщина 0.5". Клієнт для ULH хоче таку стільницю в матеріалах корпусу (3D, LACM, LACG, ST, BM, ESS) і за замовчуванням у кольорі корпусу; для Urban Duplex не підтверджено (DUP-TOP-01 / 03)

### 4.4 Thickness (5)
| Показано | Значення (дюйми) | Код SKU | Дозволені матеріали [table 595] | Що може стільниця (зсув / підйом) |
| :---- | :---- | :---- | :---- | :---- |
| 0.5" | 1/2 | .5 | HPL, Fenix, Porcelain (Tekorlux) | лише стандартне положення |
| 2.4" | 2-3/8 | 2.4 | Porcelain | зсув |
| 4" | 4 | 4 | HPL, Fenix, Porcelain (Tekorlux) | зсув, несе vessel, довжина змінюється |
| 5.1" | 5-1/8 | 5.1 | HPL, Fenix (Tekorlux) | зсув, підйом, довжина змінюється |
| 5.5" | 5-1/2 | 5.5 | Porcelain | зсув, підйом, довжина змінюється |

* Дефолту немає; автоматично ставиться перша дозволена для кольору товщина
* Товщини — з USH (через таблицю 595, скопійовану з ULH); клієнт для Porcelain у USH пише ⅜", таблиця має ½" — UNKNOWN — clarify

### 4.5 Vessel Color (9) — Provisional
| Назва | Матеріал | SKU | Для яких vessel |
| :---- | :---- | :---- | :---- |
| Antracite Matte OCF | Ceramic | CER | Blade 11, Blade 18 |
| Cemento Matte OCD | Ceramic | CER | Blade 11, Blade 18 |
| Cenere Matte OCE | Ceramic | CER | Blade 11, Blade 18 |
| Gloss White OCB | Ceramic | CER | Blade 11, Blade 18 |
| Matte White OCC | Ceramic | CER | Blade 11, Blade 18 |
| Bianco Gloss TAL | Tekorlux | SSTKR | Urban Morris, Acquarius |
| Bianco Matte TAM | Tekorlux | SSTKR | Urban Morris, Acquarius |
| Matte Black T1D | Solid Surface | SS | Urban Modo |
| Matte White T1C | Solid Surface | SS | Urban Modo (дефолт) |

* У жодному клієнтському файлі Urban Duplex vessel і їх кольори не визначені; взято з USH / ULH

### 4.6 Towel Bar Color (5) — Provisional
* **Lacquered MT (5):** Bianco 0B MT; Carbone 43 MT; Metallizzato Copper M7 MT; Metallizzato Creta M6 MT; Nero 03 MT.
* Клієнт (USH): "5 colours" без назв; дефолт Carbone 43 MT — рішення команди 2026-11-03, у клієнта його немає (§7.4 п. 24)
