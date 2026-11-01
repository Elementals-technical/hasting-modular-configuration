<!-- Mako · specification revision 2026-10-28 · part of docs/products/mako/ · statuses: ../_shared/status-legend.md -->

## 4. Матеріали
Усі списки кольорів приходять live з конфігуратора 9 (він використовується лише для Mako; Class має власний конфігуратор 8); показуються лише кольори, які ввімкнені й мають SKU. Кількості нижче — за знімком конфігуратора 23.09; live-конфігуратор 9 28.10 повернув 343 кольори корпусу замість 40 → ризик зайвих кольорів без ціни ("Incomplete price") [team].

Звірка з Master File: Cabinet Color, Handle Color і Leg Color збігаються 1:1 за назвами; Countertop Color — 70 проти 71 (без Matte White 8cm, §4.5).

| Властивість | Категорія | Кількість | Область |
| :---- | :---- | :---- | :---- |
| Cabinet Color | Lacquered MT / Lacquered GL | 20 / 20 = **40** | уся тумба |
| Handle Color | Metal / Lacquered MT | 2 / 20 = **22** | уся тумба |
| Leg Color | Metal / Lacquered MT | 2 / 20 = **22** | уся тумба (2DW) |
| Countertop Color | Solid Surface / HPL / Porcelain / Glass MT / Glass GL | 1 / 14 / 15 / 20 / 20 = **70** | уся стільниця |
| Thickness | – | **2** | уся стільниця |
| Vessel Color | Lacquered MT / Lacquered GL | 20 / 20 = **40** (Provisional) | на кожну vessel |

### 4.1 Cabinet Color (40)
* **Lacquered MT (20):** палітра GB, назви — [`_shared/palettes.md`](../_shared/palettes.md#gb-lacquers)
* **Lacquered GL (20):** ті самі 20 назв з суфіксом GL (Grigio Argento 403 GL … Zafferano 412 GL).
* Матеріал визначає ціну тумби: Lacquered MT → LACM, Lacquered GL → LACG
* Дефолт у конфігураторі: Antracite 400 MT (клієнт дефолтів не задає)
* Без шпону, Fenix і патернів

### 4.2 Handle Style
* Див. §2.3: G57, G50; на ціну не впливає

### 4.3 Handle Color (22) [2D L98–L119]
* **Metal (2):** Gold; Silver.
* **Lacquered MT (20):** ті самі 20 назв, що й лаки корпусу MT (Grigio Argento 403 MT … Zafferano 412 MT). Глянцевих кольорів ручки немає.
* Збірка пропонує всі 22 кольори і для G57, і для G50. На картинці клієнта G50 є лише в Gold і Silver — лакована G50 **UNKNOWN — clarify**
* Дефолт у конфігураторі: Antracite 400 MT
* Код у SKU: Gold → MTL-GLD (код GLD — Provisional, клієнт його не дає), Silver → MTL-SLV, лак → LACM-<номер>

### 4.4 Leg Color (22) [2D L201–L222]
* **Metal (2):** Gold; Silver. **Lacquered MT (20):** ті самі 20 назв MT. Глянцевих ніжок немає (у прайсі LACG для ніжок "-").
* Початково ніжки вимкнені; після ввімкнення стоїть Antracite 400 MT
* Цінові групи: Metal $745, Lacquered MT $1,340 (за ніжку)

### 4.5 Countertop Color (70)
* **Solid Surface (1):** Matte White.
* **HPL (14):** назви — [`_shared/palettes.md`](../_shared/palettes.md) › GB стільниця
* **Porcelain (15):** назви — [`_shared/palettes.md`](../_shared/palettes.md) › GB стільниця (значення великими літерами, як у Master File)
* **Glass MT (20):** 20 назв лаків із суфіксом MT (Grigio Argento 403 MT … Zafferano 412 MT).
* **Glass GL (20):** ті самі 20 назв з суфіксом GL.
* **Matte White 8cm** є в Master File (L121), але не пропонується: Mako лише з тонкими стільницями, а в прайсі Mako немає товстого рядка. У live-конфігураторі може з'являтися вимкненим з причиною — **UNKNOWN — clarify** (прибрати з Master File?)
* Зайві матеріали у списку Countertop Color для Class/Mako — у роботі [backlog: #79]
* Дефолт у конфігураторі: Matte White
* Цінова група: Matte White → SSTL (Provisional: клієнт не вказав групу; SSTL, SSTM і SSTEX коштують однаково), HPL → HPL, Porcelain → POR, Glass MT → GLSM, Glass GL → GLSG

### 4.6 Thickness (2)
| Показано | Значення (дюйми) | Код SKU | Дозволені матеріали [table 577] |
| :---- | :---- | :---- | :---- |
| 0.5" | 1/2 | .5 | Solid Surface, HPL, Glass MT / GL |
| 0.8" | 3/4 | .8 | Porcelain |

* Клієнт: "Mako is only available with thin countertops"; товстих стільниць (3.1", 4", 4.7") немає
* Дефолту немає; ставиться єдина дозволена для матеріалу товщина
* Porcelain у прайсах 0.8", у прайс-листі клієнта 3/4" (POR.75); у SKU .8

### 4.7 Vessel Color (40) — Provisional
* **Lacquered MT (20)** і **Lacquered GL (20)**: ті самі назви, що в Cabinet Color.
* Iris і Frame: лише Lacquered MT; Plaza: Lacquered MT і Lacquered GL. Попередньо вибрані: Iris Salvia 415 MT, Frame Fumo 401 MT, Plaza Antracite 400 MT
* У жодному клієнтському файлу Mako кольори vessel не визначені; набір — рішення команди
