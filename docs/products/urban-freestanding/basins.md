<!-- Urban Freestanding · specification revision 2026-10-28 · part of docs/products/urban-freestanding/ · statuses: ../_shared/status-legend.md -->

## 5. Раковини
* Раковини стоять лише на Sink Base, по одній на Sink Base; у композиції одна або дві раковини (максимум 2 Sink Base)
* 13 інтегрованих раковин — це список із 2D ("Basin Style"); значення в UI одночасно є назвою 3D-моделі (без таблиці відповідності), тому рев'ю відповідності 27.10 (Class / Mako / Tricot / Lame) на UF не поширюється
* Мінімальна ширина Sink Base і максимальна довжина стільниці — з таблиці 591; значення збігаються з правилами USH, на які посилається клієнт

### 5.1 Інтегровані раковини
| Значення в UI = 3D-модель | Підпис UI | 2D (Basin Style) | Матеріал стільниці (кольори) | Товщина | Мін. Sink Base | Макс. довжина стільниці | Іконка | Статус |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| Top_HPL/Fenix_Strip_Gres | Fenix Strip 48 | Fenix: Strip | Fenix (9) | 0.5" | 70 | 270 | fenix_Strip.jpg | Ready |
| Top_HPL/Fenix_Cover_Gres | Fenix Cover 50 | Fenix: Cover | Fenix | 0.5" | 70 | 270 | fenix_Cover.jpg | Ready |
| Top_HPL/Fenix_Prisma_Gres | Fenix Prisma 50 | Fenix: Prisma | Fenix | 0.5" | 60 | 270 | fenix_Prisma.jpg | Ready |
| Top_HPL/Fenix_Quadra_Gres | Fenix Quadra 50 | Fenix: Quadra | Fenix | 0.5" | 60 | 270 | fenix_Quadra.jpg | Ready |
| Top_HPLStrip | HPL Strip 48 | HPL: Strip | HPL (12) | 0.5" | 70 | 270 | strip.jpg (спільна з Porcelain) | Ready |
| Top_HPLCover | HPL Cover 50 | HPL: Cover | HPL | 0.5" | 70 | 270 | cover.jpg (спільна) | Ready |
| Top_HPLPrisma | HPL Prisma 50 | HPL: Prisma | HPL | 0.5" | 60 | 270 | prisma.jpg (спільна) | Ready |
| Top_HPLQuadra | HPL Quadra 50 | HPL: Quadra | HPL | 0.5" | 60 | 270 | quadro.jpg (спільна) | Ready |
| Top_Porcelain_Strip | Porcelain Strip 48 | Porcelain: Strip | Porcelain (38) | 0.5" | 60 | 290 | strip.jpg (спільна) | Ready (товщина Provisional) |
| Top_Porcelain_Cover | Porcelain Cover 48 | Porcelain: Cover | Porcelain | 0.5" | 60 | 290 | cover.jpg (спільна) | Ready (дефолт; товщина Provisional) |
| Top_Porcelain_Prisma | Porcelain Prisma 48 | Porcelain: Prisma | Porcelain | 0.5" | 60 | 290 | prisma.jpg (спільна) | Ready (товщина Provisional) |
| Top_Porcelain_Quadra | Porcelain Quadra 48 | Porcelain: Quadra | Porcelain | 0.5" | 60 | 290 | quadro.jpg (спільна) | Ready (товщина Provisional) |
| Top_Tekorlux_Rectangular | Tekorlux Rectangular 50 | Solid-Surface: Rectangular | Tekorlux (у палітрі UF немає) | 0.5" | 60 | 251 | Rectangular.jpg | **UNKNOWN — clarify**: недосяжна [derived] |

* Усі 17 значень Basin Style (13 інтегрованих + None + 4 vessel) зареєстровані як моделі в сцені
* Раковина бере колір стільниці
* Показуються лише раковини вибраного матеріалу стільниці; раковина активна, лише якщо Sink Base не вужча за мінімум і стільниця не довша за максимум; до вибору кольору стільниці жодна не активна
* "Solid-Surface: Rectangular" з 2D у нас — Top_Tekorlux_Rectangular (матеріал Tekorlux, як у USH); оскільки в палітрі UF немає Tekorlux, а Matte White вимкнений, раковина Solid Surface фактично недоступна

### 5.2 Vessel-раковини (Countertop Style = Vessel) — Provisional
| Опція (підпис UI) | 3D-модель | Матеріал кольору vessel | Кольори vessel | Ширина Sink Base | Статус |
| :---- | :---- | :---- | :---- | :---- | :---- |
| None (лише виріз, vessel не замовляється) | порожній виріз | – (vessel не обирається) | – | від 80 см | Provisional; доступний на стільницях, що мають vessel-рядок у таблиці 591 (HPL, Fenix, Porcelain, Solid Surface) |
| Blade 11 | Vessel_Blade11 | лише Ceramic | Ceramic (5): Antracite Matte OCF; Cemento Matte OCD; Cenere Matte OCE; Gloss White OCB; Matte White OCC | від 80 см | Provisional; доступна на стільницях з даними vessel у таблиці 591 (від 80 см) |
| Blade 18 | Vessel_Blade18 | лише Ceramic (ті самі кольори, що й Blade 11) | Ceramic (5): Antracite Matte OCF; Cemento Matte OCD; Cenere Matte OCE; Gloss White OCB; Matte White OCC | від 80 см | Provisional; доступна так само, як Blade 11 |
| Urban Modo | Vessel_UrbanModo | Solid Surface T1C / T1D (дефолт T1C; для Porcelain Fokos Rena TQ2 недоступний) | Solid Surface (2): T1C, T1D | від 80 см | Provisional; доступна на стільницях з даними vessel у таблиці 591 |
| Urban Morris | Vessel_UrbanMorris | лише Tekorlux TAL / TAM | Tekorlux (2) | від 80 см | Provisional; доступна на стільницях з даними vessel у таблиці 591 |

* Клієнт для UF vessel не називає (у 2D лише інтегровані раковини; "Countertops … Basin Style rules — Same as Urban Standard Height")
* Кожна Sink Base із vessel отримує виріз під vessel (рядок HCUT у ціні)
* Vessel на Sink Base 60 і 70 см недоступна (min_vsl_cm = 80 у таблиці 591), що відповідає пропозиції USH "vessel greyed out for 23.6"/27.6""
* За таблицею 591 Fenix допускає vessel (min_vsl 80, max 270 см), як і HPL; у коді окремого виключення Fenix немає (токени vesselCompatibleCountertopMaterialTokens без Fenix у рантаймі не використовуються) — клієнту уточнити, чи потрібно забороняти vessel на Fenix
* Обмеження vesselCompatibility стосується кольору vessel, а не матеріалу стільниці; усі чотири vessel (Blade 11, Blade 18, Urban Modo, Urban Morris) вибираються на будь-якій стільниці з даними vessel у таблиці 591

### 5.3 Поведінка
* Дві раковини: кожна Sink Base має свою раковину; колір, товщина й стиль стільниці спільні для всіх Sink Base [code: urban-freestanding/product-profile.json]
* Countertop Style 3D не читає: інтегрована чи vessel визначає лише вибрана раковина. Зміна стилю очищає раковину іншого стилю й вибирає першу дозволену
* У 3D модель раковини змінюється разом із вибором; її висота кріплення йде за висотою тумби (53 / 56 / 88 / 91) і товщиною стільниці
* Раковина стоїть по центру своєї Sink Base; переміщення раковини в UF немає (Not implemented: у USH користувач може зсувати раковину)
* Faucet Holes (0–3) впливають лише на ціну, у 3D не відображаються; позиції отворів (Left / Right / Diagonal з USH) не пропонуються
