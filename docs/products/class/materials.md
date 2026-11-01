<!-- Class · specification revision 2026-10-28 · part of docs/products/class/ · statuses: ../_shared/status-legend.md -->

## 4. Матеріали
Звірка кількості: Cabinet Side Color і Frame Color збігаються з Master File клієнта 1:1. Cabinet Color і Countertop Color у збірці ширші за списки клієнта: конфігуратор 8 досі несе палітри Mako/Urban (#79). Кількості нижче — зі знімка конфігуратора 8 від 26.10.2026; чи збігається з ним живий конфігуратор — UNKNOWN — clarify.

| Властивість | Категорія (у клієнта) | У збірці | У клієнта (Master File) | Область |
| :---- | :---- | :---- | :---- | :---- |
| Cabinet Color | Lacquered MT / Lacquered GL / Smoke Glass / Porcelain / Glass MT / Glass GL / Laminates | **343** | 20 / 20 / 1 / 15 / 20 / 20 / 12 = **108** | уся тумба |
| Cabinet Side Color | Lacquered MT / Lacquered GL / Laminates | **52** | 20 / 20 / 12 = **52** | уся тумба |
| Frame Color | Lacquered MT | **20** | **20** | уся тумба |
| Countertop Color | Solid Surface / HPL / Porcelain / Glass MT / Glass GL | **170** | 2 / 14 / 15 / 20 / 20 = **71** | уся стільниця |
| Thickness | – | **5** | у 2D немає; у прайсі 5 | уся стільниця |
| Vessel Color | Lacquered MT / Lacquered GL | 78 (Iris, Frame) / 156 (Plaza) | не визначено (Provisional) | на кожну vessel |

### 4.1 Cabinet Color (343 у збірці; 108 у клієнта)
* **Lacquered MT (20):** назви — [`_shared/palettes.md`](../_shared/palettes.md) › GB корпус
* **Lacquered GL (20):** ті самі 20 назв із суфіксом GL (Grigio Argento 403 GL … Zafferano 412 GL).
* **Porcelain (15):** назви — [`_shared/palettes.md`](../_shared/palettes.md) › GB стільниця
* **Laminates (12):** назви — [`_shared/palettes.md`](../_shared/palettes.md) › GB корпус
* **Glass MT (20), Glass GL (20), Smoke Glass (1, Fume)** — **Provisional — підлягає видаленню (вимога команди, письмового джерела клієнта не знайдено)**. Glass — ті самі 20 назв лаків (значення з технічним префіксом G, напр. GAcqua 419 MT); Fume у SKU має код кольору SG.
* **Зайві у збірці (235), яких немає в Master File Class:** ще 58 Lacquered MT і 58 Lacquered GL, Soft-Touch 58, 3D 32, HPL 12, Essenze 10, Brushed Metal 4, Wood Veneer 3. Це палітри Mako/Urban у групі конфігуратора 8 → Known issue (окремого тікета немає; пов'язано з #79).
* Дефолт у конфігураторі: Invisible White Lucido 334 (Porcelain); клієнт дефолтів не задає.

### 4.2 Cabinet Side Color (52)
* **Lacquered MT (20)**, **Lacquered GL (20)**, **Laminates (12)** — ті самі назви, що в §4.1. Без скла й порцеляни.
* Дефолт у конфігураторі: Nero 433 MT.
* Колір боку не впливає на ціну (клієнт: "Ignore the CABS material").

### 4.3 Frame Color (20)
* **Lacquered MT (20):** ті самі 20 назв лаків MT. Без GL, скла, порцеляни, ламінату.
* Дефолт у конфігураторі: Nero 433 MT.
* Nero 433 MT → ціновий клас /B ("Matte Black Frame"), інший колір → /C ("Matte Color Frame").

### 4.4 Countertop Color (170 у збірці; 71 у клієнта)
* **Solid Surface (2):** Matte White; Matte White 8cm.
* **HPL (14):** назви — [`_shared/palettes.md`](../_shared/palettes.md) › GB корпус
* **Porcelain (15):** ті самі 15 назв, що в Cabinet Color.
* **Glass MT (20), Glass GL (20)** — 20 назв лаків із суфіксом MT / GL — **Provisional — підлягає видаленню (вимога команди, письмового джерела клієнта не знайдено)**.
* **Зайві у збірці (+99)** [backlog: #79, в роботі]: кожен колір Glass MT / GL показаний двічі (Acqua 419 MT і GAcqua 419 MT, однаковий підпис і SKU) +40; Porcelain +38; HPL +12; Fenix +9.
* Очікувано вимкнені з причиною (за кодом, у браузері не перевірено): 9 кольорів Fenix (у таблиці 578 немає рядка) і Matte White 8cm (матеріал "Solid Surface 3 ⅛" не розпізнається). Інші зайві кольори активні.
* Цінова група (Provisional): Matte White → SSTL, Matte White 8cm → SSTMT, HPL → HPL, Porcelain → POR, Glass MT → GLSM, Glass GL → GLSG. Клієнт не вказав, до якої групи Solid Surface належать обидва Matte White.
* Дефолт у конфігураторі: Invisible White Lucido 334 (Porcelain).

### 4.5 Thickness (5)
| Показано | Значення (дюйми) | Код SKU | Дозволені матеріали [table 578] |
| :---- | :---- | :---- | :---- |
| 0.5" | 1/2 | .5 | Solid Surface (раковини LB), HPL, Glass MT/GL (Provisional — підлягає видаленню) |
| 0.8" | 3/4 | .8 | Porcelain |
| 3.1" | 3-1/8 | 3.1 | лише Solid Surface з VA023 на Sink Base від 80 см |
| 4" | 4 | 4 | HPL |
| 4.7" | 4-3/4 | 4.7 | Solid Surface (раковини LB), Porcelain |

* Дефолту немає; автоматично ставиться перша дозволена товщина (дефолт Porcelain + LV890 → 0.8").
* У 2D товщини немає; значення взяті з прайсу Class і таблиці 578.

### 4.6 Vessel Color — Provisional
* Vessel Color показує всі кольори групи "Select Cabinet Color" (343 у знімку конфігуратора 8); доступні лише кольори палітри обраної чаші: Iris і Frame — 78 (Lacquered MT), Plaza — 156 (Lacquered MT + GL). Решта, зокрема скляні й Porcelain, лишається видимою, але вимкнена з текстом «Not available for selected vessel sink style.» (у клієнтському списку: 20 / 40).
* Через розширену групу (§4.1) Iris і Frame отримують 78 кольорів MT, Plaza — 156 (MT + GL), а не 20 / 40 (за кодом, у браузері не перевірено).
* Попередньо вибрані: Iris Salvia 415 MT, Frame Fumo 401 MT, Plaza Antracite 400 MT.
* У жодному клієнтському файлі Class кольори vessel не визначено.
