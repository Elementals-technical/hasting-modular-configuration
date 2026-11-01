<!-- Lame · specification revision 2026-10-28 · part of docs/products/lame/ · statuses: ../_shared/status-legend.md -->

## 4. Матеріали
Звірка: Cabinet Color (40), Handle Color (22) і Leg Cap Color (22) збігаються з Master File клієнта 1:1 (ті самі назви, порядок, категорії). Countertop Color — 70 проти 71 у 2D (немає Matte White 8cm). Undertop Color і Vessel Color у 2D немає.

| Властивість | Категорія | Кількість | Область |
| :---- | :---- | :---- | :---- |
| Cabinet Color | Lacquered MT / Lacquered GL | 20 / 20 = **40** | уся композиція |
| Cabinet Pattern | – | **5** | уся композиція |
| Handle Color | Metal / Lacquered MT | 2 / 20 = **22** | уся композиція |
| Leg Cap Color | Metal / Lacquered MT | 2 / 20 = **22** | усі ніжки композиції |
| Undertop Color | Metal / Lacquered MT | 2 / 20 = **22** (Provisional) | уся композиція |
| Countertop Color | Solid Surface / HPL / Porcelain / Glass MT / Glass GL | 1 / 14 / 15 / 20 / 20 = **70** | уся стільниця |
| Thickness | – | **2** | уся стільниця |
| Vessel Color | Lacquered MT / Lacquered GL | 20 / 20 = **40** (Provisional) | на кожну vessel |

### 4.1 Cabinet Color (40)
* **Lacquered MT (20):** назви — [`_shared/palettes.md`](../_shared/palettes.md) › GB корпус
* **Lacquered GL (20):** ті самі 20 назв із суфіксом GL (Grigio Argento 403 GL … Zafferano 412 GL).
* Дефолт у конфігураторі: Antracite 400 MT (клієнт дефолтів не задає)
* Колір корпусу фарбує корпус, фасади і ніжки ("matches cabinet color"); внутрішні рамки й стінки ящиків завжди Antracite Matte

### 4.2 Cabinet Pattern (5)
* Набір і токени — §2.4; обмежень за матеріалом корпусу немає
* Дефолт: Oxford

### 4.3 Handle Color (22) [2D L105–L126]
* **Metal (2):** Gold; Silver.
* **Lacquered MT (20):** ті самі 20 назв, що й у лаків корпусу (Grigio Argento 403 MT … Zafferano 412 MT). Без Lacquered GL.
* Фарбує обидві ручки; один колір на всі тумби
* Дефолт у конфігураторі: Antracite 400 MT

### 4.4 Leg Cap Color (22) [2D L208–L229]
* Той самий набір і порядок, що й Handle Color: Gold, Silver і 20 Lacquered MT
* Колір обирається лише для заглушки; сама ніжка — у кольорі корпусу
* Поки колір не вибрано (ніжки щойно ввімкнено), заглушка бере колір ручки

### 4.5 Undertop Color (22) — Provisional
* Палітра Handle Color: Gold, Silver (ціна MTL) і 20 Lacquered MT (ціна LACM)
* Поки колір не вибрано, undertop бере колір ручки
* Клієнт визначає лише дві цінові категорії (Gold/Silver і Matte lacq.); чи колір лаку — вибір користувача чи колір корпусу, не сказано (LAME-ACC-06)

### 4.6 Countertop Color (70)
* **Solid Surface (1):** Matte White.
* **HPL (14):** назви — [`_shared/palettes.md`](../_shared/palettes.md) › GB корпус
* **Porcelain (15):** назви — [`_shared/palettes.md`](../_shared/palettes.md) › GB стільниця
* **Glass MT (20):** 20 назв лаків із суфіксом MT (Grigio Argento 403 MT … Zafferano 412 MT).
* **Glass GL (20):** 20 назв лаків із суфіксом GL (Grigio Argento 403 GL … Zafferano 412 GL).
* Matte White 8cm (2D L128) не пропонується: Lame лише з тонкими стільницями ("Lame is only available in thin countertops")
* Дефолт у конфігураторі: Matte White
* Цінова група (для Solid Surface — Provisional): Matte White → SSTL, HPL → HPL, Porcelain → POR, Glass MT → GLSM, Glass GL → GLSG; з раковиною VA030 → SSTEX. Клієнт не вказав, до якої групи Solid Surface належить Matte White (GEN-MAT-01)

### 4.7 Thickness (2)
| Показано | Значення (дюйми) | Код SKU | Дозволені матеріали [table 597] |
| :---- | :---- | :---- | :---- |
| 0.5" | 1/2 | .5 | Solid Surface, HPL, Glass MT/GL |
| 0.8" | 3/4 | .8 | Porcelain |

* Товстих стільниць (3.1", 4", 4.7") немає — Not in scope
* Дефолту немає; автоматично ставиться дозволена для кольору товщина
* Porcelain: у прайсі 0.8", у прайс-листі клієнта 3/4" (LAME-TOP-03)

### 4.8 Vessel Color (40) — Provisional
* **Lacquered MT (20)** і **Lacquered GL (20)**: назви лаків з суфіксом MT або GL.
* Iris і Frame: лише Lacquered MT; Plaza: Lacquered MT і Lacquered GL. Попередньо вибрані: Iris Salvia 415 MT, Frame Fumo 401 MT, Plaza Antracite 400 MT
* У жодному клієнтському файлі Lame не визначено; взято з Mako / Class (LAME-TOP-01)
