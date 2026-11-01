<!-- Urban Duplex · specification revision 2026-10-28 · part of docs/products/urban-duplex/ · statuses: ../_shared/status-legend.md -->

## 5. Раковини
* Раковини стоять лише на Sink Base, по одній на Sink Base; у тумбі одна або дві раковини (максимум 2 Sink Base)
* Кодів раковин (LB / VA / LV) в Urban Duplex немає: значення Basin Style — це назва 3D-моделі; 13 інтегрованих — список із 2D
* Раковина бере колір стільниці

### 5.1 Інтегровані раковини
| У 2D | Підпис в UI / 3D-модель | Матеріал стільниці | Товщина | Мін. Sink Base | Іконка | Статус |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| Solid-Surface: Rectangular | Tekorlux Rectangular 50 / Top_Tekorlux_Rectangular | Tekorlux | 0.5", 4", 5.1" | 60 | Rectangular.jpg | **UNKNOWN — clarify**: фактично недоступна (кольорів Tekorlux у палітрі немає, §4.3) |
| Fenix: Strip | Fenix Strip 48 / Top_HPL/Fenix_Strip_Gres | Fenix (9) | 0.5", 4", 5.1" | 70 | fenix_Strip.jpg | Ready |
| Fenix: Cover | Fenix Cover 50 / Top_HPL/Fenix_Cover_Gres | Fenix | 0.5", 4", 5.1" | 70 | fenix_Cover.jpg | Ready |
| Fenix: Prisma | Fenix Prisma 50 / Top_HPL/Fenix_Prisma_Gres | Fenix | 0.5", 4", 5.1" | 60 | fenix_Prisma.jpg | Ready |
| Fenix: Quadra | Fenix Quadra 50 / Top_HPL/Fenix_Quadra_Gres | Fenix | 0.5", 4", 5.1" | 60 | fenix_Quadra.jpg | Ready |
| HPL: Strip | HPL Strip 48 / Top_HPLStrip (дефолт) | HPL (12) | 0.5", 4", 5.1" | 70 | strip.jpg | Ready |
| HPL: Cover | HPL Cover 50 / Top_HPLCover | HPL | 0.5", 4", 5.1" | 70 | cover.jpg | Ready |
| HPL: Prisma | HPL Prisma 50 / Top_HPLPrisma | HPL | 0.5", 4", 5.1" | 60 | prisma.jpg | Ready |
| HPL: Quadra | HPL Quadra 50 / Top_HPLQuadra | HPL | 0.5", 4", 5.1" | 60 | quadro.jpg | Ready |
| Porcelain: Strip | Porcelain Strip 48 / Top_Porcelain_Strip | Porcelain (38) | 0.5", 2.4", 4", 5.5" | 60 | strip.jpg (як у HPL) | Ready |
| Porcelain: Cover | Porcelain Cover 48 / Top_Porcelain_Cover | Porcelain | 0.5", 2.4", 4", 5.5" | 60 | cover.jpg (як у HPL) | Ready |
| Porcelain: Prisma | Porcelain Prisma 48 / Top_Porcelain_Prisma | Porcelain | 0.5", 2.4", 4", 5.5" | 60 | prisma.jpg (як у HPL) | Ready |
| Porcelain: Quadra | Porcelain Quadra 48 / Top_Porcelain_Quadra | Porcelain | 0.5", 2.4", 4", 5.5" | 60 | quadro.jpg (як у HPL) | Ready |

* Числа 48 / 50 у підписах — ширина раковини з ключів USH; у 2D Urban Duplex розміру немає (DUP-TOP-05)
* Показуються лише раковини вибраного матеріалу стільниці; раковина активна, лише якщо Sink Base не вужча за мінімум і стільниця не довша за максимум; до вибору кольору стільниці жодна не активна

### 5.2 Vessel-раковини (Countertop Style = Vessel) — Provisional
| Опція | 3D-модель | Кольори vessel | Ширина Sink Base | SKU | Статус |
| :---- | :---- | :---- | :---- | :---- | :---- |
| None (лише виріз, vessel не замовляється) | порожній виріз | – | від 80 см | лише виріз HCUT | Provisional |
| Vessel Blade 11 | Vessel_Blade11 | Ceramic (5) | від 80 см | VES-<код серії>-X-<W>W-<H>H-<D>D-CER-<код кольору> | Provisional; іконка з Phase 1 |
| Vessel Blade 18 | Vessel_Blade18 | Ceramic (5) | від 80 см | те саме | Provisional; іконка з Phase 1 |
| Vessel Urban Modo | Vessel_UrbanModo | Solid Surface (2) | від 80 см | … -SS-<code> | Provisional; іконка з Phase 1 |
| Vessel Urban Morris | Vessel_UrbanMorris | Tekorlux (2) | від 80 см | … -SSTKR-<code> | Provisional; іконка з Phase 1 |
| Vessel Acquarius (так у підписі) | Vessel_Aquarius | Tekorlux (2) | від 80 см | … -SSTKR-<code> | Provisional; іконка з Phase 1 |

* У SKU vessel код серії: BLD11 (Blade 11), BLD18 (Blade 18), URMOD (Urban Modo), URMORS (Urban Morris), ACQS (Acquarius); W/H/D — фіксовані розміри самої чаші (USH-таблиця), не розміри тумби
* Клієнт для Urban Duplex vessel не називає ("same as USH"); набір і правила — як у Urban Low Height (USH-vessel)
* Vessel вимкнений для Sink Base 60 і 70 см ("Not available for selected sink base cabinet width. Minimum width required 80cm …"); збігається з клієнтом ("We should grey out the Vessel sink options when the Sink Base cabinet size is 23.6” or 27.6”", USH P0277)
* Vessel недоступний на стільниці Fenix (Fenix не в списку vessel-сумісних матеріалів), хоча таблиця 595 дає Fenix ліміт vessel 270 см — UNKNOWN — clarify
* Кожна Sink Base із vessel отримує виріз під vessel

### 5.3 Поведінка
* Дві раковини: кожна Sink Base має свою раковину; усі Sink Base мають спільні колір, товщину й стиль стільниці
* Зміна стилю стільниці очищає раковину іншого стилю й вибирає першу дозволену
* У 3D інтегрований чи vessel визначає лише вибрана раковина (Countertop Style 3D не читає); модель раковини змінюється разом із вибором, а її кріплення йде за висотою тумби (56 / 53 / 38 / 28)
* Раковина по центру Sink Base; край інтегрованої раковини не ближче 10 см до краю стільниці; сифон — у межах Sink Base (§7.3)
* Дефолтна раковина: UI — HPL Strip 48; у 3D до першої синхронізації — Top_HPLPrisma (UI завжди надсилає своє значення)
