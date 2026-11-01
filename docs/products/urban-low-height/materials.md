<!-- Urban Low Height · specification revision 2026-10-28 · part of docs/products/urban-low-height/ · statuses: ../_shared/status-legend.md -->

## 4. Матеріали
Списки нижче — оригінали клієнта (Master File). Збірка бере кольори з конфігуратора 4, спільного з Urban Standard Height; у тестах є лише скорочена копія відповіді, тож чи збігається живий список із 232 / 61 — **UNKNOWN — clarify** (перевірити на тесті).

| Властивість | Категорія | Кількість (клієнт) | Область |
| :---- | :---- | :---- | :---- |
| Cabinet Color | 3D / Lacquered MT / Lacquered GL / Soft-Touch / Brushed Metal / HPL / Essenze | 32 / 58 / 58 / 58 / 4 / 12 / 10 = **232** | уся композиція |
| Handle Groove Color | палітра конфігуратора 4 | у 2D немає — **Provisional** | уся композиція |
| Drawer Panel Fluting | – | **5** (None + 4) | на кожну шафу |
| Countertop Color (Upper) | Solid-Surface / Fenix / HPL / Porcelain | 2 / 9 / 12 / 38 = **61** | уся основна стільниця |
| Lower (кавер) | та сама палітра, що Upper | як Upper | на кожен кавер |
| Thickness | – | **6** у збірці; у 2D немає | уся стільниця |
| Vessel Color | палітра конфігуратора 4 за матеріалом vessel | у даних ULH немає — **Provisional** | на кожен vessel |
| Towel Bar Color | палітра конфігуратора 4 | клієнт (USH): 5 | рушник |

### 4.1 Cabinet Color (232) [2D L75–L306]
* **3D (32):** назви — [`_shared/palettes.md`](../_shared/palettes.md) › Urban корпус
* **Lacquered MT (58):** назви — [`_shared/palettes.md`](../_shared/palettes.md) › Urban корпус
* **Brushed Metal (4):** Metal acciaio 2MA; Metal piombo 2MB; Metal titanio 2MC; Metal bronzo 2MD.
* **HPL (12):** назви — [`_shared/palettes.md`](../_shared/palettes.md) › Urban корпус
* **Essenze (10):** назви — [`_shared/palettes.md`](../_shared/palettes.md) › Urban корпус
* Дефолт у конфігураторі: Rox Black TKQ (клієнт дефолтів не задає)
* Цінова колонка за категорією: 3D → 3D, Lacquered MT → LACM, Lacquered GL → LACG, Soft-Touch → ST, Brushed Metal → BM, HPL → HPL, Essenze → ESS. Колонку прайсу "White GL/MT" збірка не використовує (§8.1)

### 4.2 Handle Groove Color — Provisional
* Список — група Handle Groove Color конфігуратора 4, першим іде "None" (паз у кольорі корпусу)
* Лише з Upper Groove; один колір на всю композицію; зміна Cabinet Color вибраний колір пазу не змінює. Push to open скидає колір пазу
* У 2D ULH кроку немає; клієнт описує колір пазу лише для USH ("only available for Urban handle … All cabinets must have the same groove finish")

### 4.3 Countertop Color (61) [2D L307–L367]
* **Solid-Surface (2):** Gloss White; Matte White.
* **Fenix (9):** назви — [`_shared/palettes.md`](../_shared/palettes.md) › Urban стільниця
* **HPL (12):** ті самі 12 назв, що HPL корпусу (Rovere Monet TK3 … Rox Black TKQ).
* **Porcelain (38):** назви — [`_shared/palettes.md`](../_shared/palettes.md) › Urban стільниця
* Дефолт у конфігураторі: Bianco Male TFA (Fenix)
* Збірка бере палітру Urban Standard Height (конфігуратор 4) і таблицю 589, де, крім чотирьох матеріалів клієнта, є Mineralmarmo, Ocritech, Tekorlux, Tekorund, Glass і Syntesi. Gloss White / Matte White у конфігураторі 4 є і як Mineralmarmo, і як Ocritech; якому матеріалу відповідає Solid-Surface клієнта — **UNKNOWN — clarify**. Фільтри Material приховують Tekorlux, Tekormud, Glass MT / GL і Lacquered MT / GL, але раковини цих матеріалів лишаються в списку (§5.1)
* **Lower (кавер):** вкладка Lower показує ту саму палітру, що Upper; поки Lower не вибрано, кавер іде за кольором Upper (рішення команди 28.10.2026). Клієнт для кавера називав матеріали корпусу (3D, LACM, LACG, ST, BM, ESS) і дефолт "колір шафи" — **UNKNOWN — clarify**

### 4.4 Thickness (6)
| Показано | Значення (дюйми) | У таблиці 589 | Матеріали [table 589] | Що може стільниця (§7.3) |
| :---- | :---- | :---- | :---- | :---- |
| 0.4″ | 3/8 | 3/8 | Ocritech, Glass | лише стандартна позиція |
| 0.5″ | 1/2 | 1/2 | Fenix, HPL, Porcelain, Tekorlux, Tekorund, Mineralmarmo, Syntesi | лише стандартна позиція |
| 2.4″ | 2-3/8 | 2-3/8 | Porcelain | зсув вліво / вправо |
| 4″ | 4 | 4 | Fenix, HPL, Porcelain, Tekorlux, Tekorund, Ocritech | зсув; vessel поза Sink Base; довжина |
| 5.1″ | 5-1/8 | 5-1/8 | Fenix, HPL, Tekorlux, Tekorund, Ocritech | зсув; підйом (remote); довжина |
| 5.5″ | 5-1/2 | 5-1/2 | Porcelain | зсув; підйом (remote); довжина |

* Дефолту немає: ставиться перша дозволена для кольору й глибини товщина (для Fenix — 0.5″)
* Клієнт: "thick" = 4″, 5-⅛″, 5-½″; решта тонкі. Для Porcelain клієнт (USH) дає ⅜″ і 2-⅜″, таблиця 589 — ½″ і 2-⅜″ — **UNKNOWN — clarify**
* У профілі є ще значення 0.4 з підписом 0.4″; таблиця 589 його не дає, тому воно не пропонується

### 4.5 Vessel Color — Provisional
* Список — група Vessels конфігуратора 4; кожен vessel приймає лише свої матеріали (§5.2); автоматично ставиться перший дозволений колір
* Кольорів vessel для ULH клієнт не визначає; кількість у живому конфігураторі — перевірити на тесті
