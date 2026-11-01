<!-- Mako · specification revision 2026-10-28 · part of docs/products/mako/ · statuses: ../_shared/status-legend.md -->

## 5. Раковини
* Раковини стоять лише на Sink Base, по одній на Sink Base; у тумбі одна або дві раковини (максимум 2 Sink Base)
* 2D дає 10 кодів; збірка пропонує 9 з них (без VA023, див. нижче)
* **Відповідність «код → 3D-модель» нижче Provisional для всіх рядків** (спільна для Class / Mako / Tricot / Lame, клієнт не затвердив).

### 5.1 Інтегровані раковини
| Код | 3D-модель | Матеріал стільниці (кольори) | Товщина | Ширина Sink Base | Іконка | Рев'ю відповідності 27.10 |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| LB440 | Top_HPLPrisma | Solid Surface (Matte White) | 0.5" | 60–120 | є | ок |
| LB175 | Top_Tekorlux_Ron | Solid Surface | 0.5" | 60–120 | є | **не та модель — має бути овальна** |
| LB575 | Top_Tekorlux_Quadra | Solid Surface | 0.5" | 60–120 | є | ок |
| LB856 | Top_HPLStrip | Solid Surface | 0.5" | 60–120 | є | трохи не та |
| VA024 | Top_HPLCover | HPL (14) | 0.5" | 60–120 | є | ок |
| LV890 | Top_Tekorlux_Trip | Porcelain (15) | 0.8" | 60–120 | є | прибрати скіс краю |
| LV892 | Top_Ocritech_Orion | Porcelain | 0.8" | 60–120 | є | прибрати перелив |
| VA002 | Top_Ocritech_Oly55 | Glass MT (20), Glass GL (20) | 0.5" | 60–120 | є | **має бути скляна** |
| VA005 | Top_Tekorlux_Rectangular | Glass MT, Glass GL | 0.5" | 60–120 | є | **має бути скляна** |

* Раковина бере колір стільниці
* Показуються лише раковини вибраного матеріалу стільниці; мінімальна Sink Base для інтегрованої раковини 60 см, тож усі ширини Sink Base Mako підходять
* **VA023** є в Master File (L195), але не пропонується: у прайсі Mako її немає, а за правилами GB вона потребує товстої (3.1") стільниці — **UNKNOWN — clarify**
* **VA030** (Solid Surface, група SSTEX) є в прайсі Mako і в таблиці стільниць, але немає в Master File, тому не пропонується — **UNKNOWN — clarify**
* LB856: за таблицею — лише стандартне положення при 0 отворах. Положення раковини (standard / closer to wall) у збірці не налаштовується — **Not implemented**

### 5.2 Vessel-раковини (Countertop Style = Vessel)
| Опція | 3D-модель | Кольори vessel | Ширина Sink Base | SKU | Статус |
| :---- | :---- | :---- | :---- | :---- | :---- |
| None (лише виріз, vessel не замовляється) | порожній виріз | – | будь-яка | лише виріз | Provisional (немає в оригіналах клієнта) |
| Iris | Vessel_Iris | Lacquered MT (20) | будь-яка | VES-IRIS-X-16.5W-4.3H-16.5D-… | Provisional; модель ок |
| Frame | Vessel_Frame | Lacquered MT (20) | будь-яка | VES-FRM-X-19.7W-4.3H-13.8D-… | Provisional; виправлено для Mako [backlog: #33], видимість — ретест [backlog: #76] |
| Plaza | Vessel_Blade11 (заглушка) | Lacquered MT + GL (40) | будь-яка | VES-PLZ-X-23.6W-4.7H-18.9D-… | Provisional; **не та модель, моделі Plaza в сцені немає** |

* Клієнт називає для Mako Iris, Frame, Plaza
* Іконки vessel — іконки Phase 1 (Aquarius48, UrbanMorris, Blade11), а не зображення Iris / Frame / Plaza — Provisional
* Кожна Sink Base із vessel отримує виріз під vessel ("for each SB cab")

### 5.3 Поведінка
* Дві раковини: кожна Sink Base має свою раковину; усі Sink Base мають спільні колір, товщину й стиль стільниці
* Зміна стилю стільниці очищає раковину іншого стилю й вибирає першу дозволену
* У 3D модель раковини змінюється разом із вибором; її кріплення йде за висотою тумби (26 / 52 см) і товщиною стільниці. Integrated / vessel у 3D визначає лише вибрана раковина
