<!-- Tricot · specification revision 2026-10-28 · part of docs/products/tricot/ · statuses: ../_shared/status-legend.md -->

## 5. Раковини
* Раковини стоять лише на Sink Base, по одній на Sink Base; у тумбі одна або дві раковини (максимум 2 Sink Base)
* 10 кодів раковин — це список із 2D;
* **Відповідність «код → 3D-модель» нижче Provisional для всіх рядків.**

### 5.1 Інтегровані раковини (зараз на тесті, під питанням актуальність звязку до коду)
| Код | 3D-модель | Матеріал стільниці (кольори) | Товщина | Ширина Sink Base | Іконка | Рев'ю відповідності 27.10 |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| LB440 | Top_HPLPrisma | Solid Surface (Matte White, Matte White 8cm) | 0.5", 4.7" | 60–120 | є | ок |
| LB175 | Top_Tekorlux_Ron | Solid Surface | 0.5", 4.7" | 60–120 | є | **не та модель — має бути овальна** |
| LB575 | Top_Tekorlux_Quadra | Solid Surface | 0.5", 4.7" | 60–120 | є | ок |
| LB856 | Top_HPLStrip | Solid Surface | 0.5", 4.7" | 60–120 | є |  не та |
| VA023 | Top_Tekormud_Tivi | Solid Surface (цінова група SSTMT) | лише 3.1" | **80–120** | **немає** | **не та модель** |
| VA024 | Top_HPLCover | HPL (14) | 0.5", 4" | 60–120 | є | ок |
| LV890 | Top_Tekorlux_Trip | Porcelain (15) | 0.8", 4.7" | 60–120 | є | прибрати скіс краю |
| LV892 | Top_Ocritech_Orion | Porcelain | 0.8", 4.7" | 60–120 | є | прибрати перелив |
| VA002 | Top_Ocritech_Oly55 | Glass MT (20), Glass GL (20) | 0.5" | 60–120 | є | **має бути скляна** |
| VA005 | Top_Tekorlux_Rectangular | Glass MT, Glass GL | 0.5" | 60–120 | є | **має бути скляна** |

* Раковина бере колір стільниці [3D: basin material rule].
* Показуються лише раковини вибраного матеріалу стільниці; раковина активна, лише якщо підходить за товщиною і шириною Sink Base; до вибору кольору стільниці жодна не активна
* Sink Base 60 см з 1DWID не приймає інтегровану раковину (лише vessel)
* VA030 є в прайсі Class, але немає в Master File Tricot, тому не пропонується .

### 5.2 Vessel-раковини (Countertop Style = Vessel) (зараз на тесті, під питанням актуальність звязку до коду)
| Опція | 3D-модель | Кольори vessel | Ширина Sink Base | SKU | Статус |
| :---- | :---- | :---- | :---- | :---- | :---- |
| None (лише виріз, vessel не замовляється) | порожній виріз | – | будь-яка | лише виріз | Provisional (немає в оригіналах клієнта) |
| Iris | Vessel_Iris | Lacquered MT (20) | будь-яка | VES-IRIS-X-16.5W-4.3H-16.5D-… | Provisional; модель ок |
| Frame | Vessel_Frame | Lacquered MT (20) | будь-яка | VES-FRM-X-19.7W-4.3H-13.8D-… | Provisional; не видно в 3D, ретест [backlog: #76] |
| Plaza | Vessel_Blade11 (заглушка) | Lacquered MT + GL (40) | будь-яка | VES-PLZ-X-23.6W-4.7H-18.9D-… | Provisional; **не та модель, моделі Plaza в сцені немає** |

* Клієнт називає для Tricot Iris, Frame, Plaza
* Кожна Sink Base із vessel отримує виріз під vessel

### 5.3 Поведінка
* Дві раковини: кожна Sink Base має свою раковину; усі Sink Base мають спільні колір, товщину й стиль стільниці [code: tricot/product-profile.json].
* Зміна стилю стільниці очищає раковину іншого стилю й вибирає першу дозволену
* У 3D модель раковини змінюється разом із вибором, а її кріплення йде за товщиною стільниці
