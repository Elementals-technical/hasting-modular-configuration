<!-- Urban Low Height · specification revision 2026-10-28 · part of docs/products/urban-low-height/ · statuses: ../_shared/status-legend.md -->

## 5. Раковини
* Раковини стоять лише на Sink Base, по одній на Sink Base; у композиції одна або дві раковини (максимум 2 Sink Base). Піднята стільниця може нести раковину поза Sink Base (§7.3)
* 2D клієнта має 13 раковин (5 форм: Rectangular, Strip, Cover, Prisma, Quadra по матеріалах Solid-Surface, Fenix, HPL, Porcelain). Збірка пропонує набір Urban Standard Height (27 інтегрованих + 5 vessel), відфільтрований таблицею 589
* Значення раковини в ULH — це одразу назва 3D-моделі (Top_*, Vessel_*) з Urban Standard Height; спільна для Class / Mako / Tricot / Lame мапа кодів (LB…, VA…, LV…) і її рев'ю 27.10 до ULH не застосовуються

### 5.1 Інтегровані раковини [table 589]
| Матеріал | Раковина (підпис) | 3D-модель | Мін. Sink Base | Глибина | Товщина | Макс. довжина (інтегр. / vessel), см | У 2D клієнта | Статус |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| Fenix | Fenix Cover 50 | Top_HPL/Fenix_Cover_Gres | 70 | 46, 50 | 0.5″, 4″, 5.1″ | 270 / 270 | Fenix: Cover | Ready |
| Fenix | Fenix Prisma 50 (дефолт) | Top_HPL/Fenix_Prisma_Gres | 60 | 46, 50 | 0.5″, 4″, 5.1″ | 270 / 270 | Fenix: Prisma | Ready |
| Fenix | Fenix Quadra 50 | Top_HPL/Fenix_Quadra_Gres | 60 | 46, 50 | 0.5″, 4″, 5.1″ | 270 / 270 | Fenix: Quadra | Ready |
| Fenix | Fenix Strip 48 | Top_HPL/Fenix_Strip_Gres | 70 | 46, 50 | 0.5″, 4″, 5.1″ | 270 / 270 | Fenix: Strip | Ready; **дубль "Fenix Strip Gres" (Fenix_Strip_Gres) у 3D не зареєстрований — помилка в консолі, раковина не міняється** |
| HPL | HPL Cover 50 | Top_HPLCover | 70 | 46, 50 | 0.5″, 4″, 5.1″ | 270 / 270 | HPL: Cover | Ready |
| HPL | HPL Prisma 50 | Top_HPLPrisma | 60 | 46, 50 | 0.5″, 4″, 5.1″ | 270 / 270 | HPL: Prisma | Ready |
| HPL | HPL Quadra 50 | Top_HPLQuadra | 60 | 46, 50 | 0.5″, 4″, 5.1″ | 270 / 270 | HPL: Quadra | Ready |
| HPL | HPL Strip 48 | Top_HPLStrip | 70 | 46, 50 | 0.5″, 4″, 5.1″ | 270 / 270 | HPL: Strip | Ready |
| Porcelain | Porcelain Cover / Prisma / Quadra / Strip 48 | Top_Porcelain_Cover / _Prisma / _Quadra / _Strip | 60 | 46, 50 | 0.5″, 2.4″, 4″, 5.5″ | 290 / 290 | Porcelain: Cover / Prisma / Quadra / Strip | Ready |
| Tekorlux | Tekorlux Rectangular 50 | Top_Tekorlux_Rectangular | 60 | 46, 50 | 0.5″, 4″, 5.1″ | 251 / 270 | можливо "Solid-Surface: Rectangular" | UNKNOWN — clarify |
| Tekorlux | Tekorlux Quadra 50 / Trip 50 | Top_Tekorlux_Quadra / _Trip | 60 | 46, 50 | 0.5″, 4″, 5.1″ | 251 (Trip 271) / 270 | немає | UNKNOWN — clarify |
| Tekorlux | Tekorlux Ron 50 | Top_Tekorlux_Ron | 60 | лише 50 | 0.5″, 4″, 5.1″ | 270 / 270 | немає | UNKNOWN — clarify |
| Tekorund | Tekormud TIVI | Top_Tekormud_Tivi | 60 | лише 50 (vessel 46, 50) | 0.5″, 4″, 5.1″ | 340 / 270 | немає | UNKNOWN — clarify |
| Ocritech | Oly 55, Orion | Top_Ocritech_Oly55 / _Orion | 60 | лише 50 | 0.4″, 4″, 5.1″ | 290 / 290 | немає | UNKNOWN — clarify |
| Ocritech | Oly 56 | Top_Ocritech_Oly56 | 70 | лише 50 | 0.4″, 4″, 5.1″ | 290 / 290 | немає | UNKNOWN — clarify |
| Ocritech | Roll / Rayo, Quadra | Top_Ocritech_Roll / _Rayo / _Quadra | 60 / 70 | 46, 50 | 0.4″, 4″, 5.1″ | 290 / 290 | немає | UNKNOWN — clarify |
| Mineralmarmo | Mineralmarmo Diamond | Top_Mineralmarmo_Diamond | 70 | лише 50 | 0.5″ | 340 / 270 | немає | UNKNOWN — clarify |
| Glass | Glass Nettuno / Ovale | Top_Glass_Nettuno / _Ovale | 70 | лише 50 | 0.4″ | 260 / 260 | немає | UNKNOWN — clarify |
| Syntesi | Syntesi 48 | Top_Tekorlux_Syntesi | 60, лише SB 60–120 | лише 50 | 0.5″ | 120 / – | немає | UNKNOWN — clarify |

* Раковина бере колір і матеріал стільниці; іконки є для 33 із 34 значень (None без іконки)
* Показуються лише раковини матеріалу вибраного кольору стільниці; раковина активна, лише якщо кожна Sink Base не вужча за "Мін. Sink Base" і глибина підходить. Наприклад, Sink Base 60 см приймає Fenix / HPL лише Prisma або Quadra
* Дефолт Fenix Prisma 50 вибрано, бо дефолтна Sink Base 60 см не приймає Fenix Cover 50 (потрібно ≥ 70 см)
* Обмеження клієнта в нотатках таблиці 589 (Syntesi і Tekorlux Ron — лише одна шафа, без бокових панелей, лише TAN / TAP) у ULH не застосовуються — **Not implemented**

### 5.2 Vessel-раковини (Countertop Style = Vessel) — Provisional
| Опція (підпис) | 3D-модель | Матеріал / кольори vessel | Мін. Sink Base | Статус |
| :---- | :---- | :---- | :---- | :---- |
| None (лише виріз, vessel не замовляється) | порожній виріз (Vessel) | – | 80 см | Ready (клієнт USH: "None" — дефолт) |
| Vessel Blade 11 | Vessel_Blade11 | кераміка (напр. Antracite Matte OCF) | 80 см | Provisional |
| Vessel Blade 18 | Vessel_Blade18 | кераміка | 80 см | Provisional |
| Vessel Urban Modo | Vessel_UrbanModo | Solid Surface T1C / T1D; HPL TKF / TKH / TKJ / TKN / TKP / TKQ; Porcelain (крім TQ2) | 80 см | Provisional |
| Vessel Urban Morris | Vessel_UrbanMorris | Tekorlux TAL / TAM | 80 см | Provisional |
| Vessel Acquarius (підпис з помилкою, як у профілі) | Vessel_Aquarius | Tekorlux TAL / TAM | 80 см | Provisional |

* Список vessel ULH у даних клієнта немає; це набір Urban Standard Height. Клієнт (USH): vessel недоступні для Sink Base 60 і 70 см — збірка так і робить (мін. 80 см для всіх матеріалів)
* Кожна Sink Base із vessel отримує виріз; якщо vessel вибрано, він ставиться на кожну Sink Base
* Vessel_Frame і Vessel_Iris є в 3D, але ULH їх не пропонує

### 5.3 Поведінка
* Дві раковини: кожна Sink Base має свою раковину; колір, товщина й стиль стільниці спільні
* Зміна стилю стільниці очищає раковину іншого стилю й вибирає першу дозволену; "Basin style" стає "Vessel Sink Style"
* Countertop Style 3D не читає: вигляд визначає вибрана раковина (Top_* — інтегрована, Vessel_* — vessel, None — лише виріз)
* У 3D раковина кріпиться до Sink Base і зміщується за висотою шафи й товщиною стільниці
* Поки стільниця несе раковину поза Sink Base, стиль, раковина і колір vessel заблоковані (§7.3)
