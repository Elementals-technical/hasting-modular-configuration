<!-- Lame · specification revision 2026-10-28 · part of docs/products/lame/ · statuses: ../_shared/status-legend.md -->

## 5. Раковини
* Раковини стоять лише на Sink Base, по одній на Sink Base; у тумбі одна або дві раковини (максимум 2 Sink Base)
* 10 інтегрованих кодів. Набір відрізняється від 2D: замість VA023 (2D L202) збірка пропонує VA030 із прайсу Lame — **UNKNOWN — clarify**
* **Відповідність «код → 3D-модель» нижче Provisional для всіх рядків.**

### 5.1 Інтегровані раковини
| Код | 3D-модель | Матеріал стільниці (кольори) | Товщина | Ширина Sink Base | Іконка | Рев'ю відповідності 27.10 |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| LB440 | Top_HPLPrisma | Solid Surface (Matte White) | 0.5" | 60–120 | є | ок |
| LB175 | Top_Tekorlux_Ron | Solid Surface | 0.5" | 60–120 | є | **не та модель — має бути овальна** |
| LB575 | Top_Tekorlux_Quadra | Solid Surface | 0.5" | 60–120 | є | ок |
| LB856 | Top_HPLStrip | Solid Surface | 0.5" | 60–120 | є | трохи не та |
| VA030 | **немає** | Solid Surface (цінова група SSTEX) | 0.5" | 60–120 | **немає** | **Not implemented у 3D**: моделі в сцені немає |
| VA024 | Top_HPLCover | HPL (14) | 0.5" | 60–120 | є | ок |
| LV890 | Top_Tekorlux_Trip | Porcelain (15) | 0.8" | 60–120 | є | прибрати скіс краю |
| LV892 | Top_Ocritech_Orion | Porcelain | 0.8" | 60–120 | є | прибрати перелив |
| VA002 | Top_Ocritech_Oly55 | Glass MT (20), Glass GL (20) | 0.5" | 60–120 | є | **має бути скляна** |
| VA005 | Top_Tekorlux_Rectangular | Glass MT, Glass GL | 0.5" | 60–120 | є | **має бути скляна** |

* Показуються лише раковини вибраного матеріалу стільниці; раковина активна, лише якщо підходить за товщиною і шириною Sink Base
* Оскільки Matte White — єдиний колір Solid Surface і дефолт, стартова стільниця — Solid Surface 0.5" з LB440. HPL лишає лише VA024, Porcelain — LV890 / LV892, Glass — VA002 / VA005
* На відміну від Tricot, обмеження "Sink Base 60 см + 1DWID" немає: Sink Base 60 см приймає інтегровану раковину з будь-яким стилем ящиків
* VA030: сцена відхиляє вибір (моделі немає), тумба лишається без моделі раковини, а в ціні VA030 є
* VA023 є в Master File, але прив'язана до товстої стільниці 3.1" (Technomat), якої в Lame немає, і в прайсі Lame її немає, тому не пропонується

### 5.2 Vessel-раковини (Countertop Style = Vessel)
| Опція | 3D-модель | Кольори vessel | Ширина Sink Base | SKU | Статус |
| :---- | :---- | :---- | :---- | :---- | :---- |
| None (лише виріз, vessel не замовляється) | порожній виріз | – | будь-яка | лише виріз | Provisional (немає в оригіналах клієнта); іконки немає |
| Iris | Vessel_Iris | Lacquered MT (20) | будь-яка | VES-IRIS-X-16.5W-4.3H-16.5D-… | Provisional; модель ок |
| Frame | Vessel_Frame | Lacquered MT (20) | будь-яка | VES-FRM-X-19.7W-4.3H-13.8D-… | Provisional; не видно в 3D, ретест [backlog: #76] |
| Plaza | Vessel_Blade11 (заглушка) | Lacquered MT + GL (40) | будь-яка | VES-PLZ-X-23.6W-4.7H-18.9D-… | Provisional; **не та модель, моделі Plaza в сцені немає** |
| Art, Diamond | – | – | – | – | **Not implemented**: клієнт називає, даних немає (LAME-TOP-01, LAME-TOP-04) |

* Клієнт називає для Lame Iris, Frame, Plaza, Art, Diamond
* Кожна Sink Base із vessel отримує виріз під vessel

### 5.3 Поведінка
* Дві раковини: кожна Sink Base має свою раковину; усі Sink Base мають спільні колір, товщину й стиль стільниці
* Зміна стилю стільниці очищає раковину іншого стилю й вибирає першу дозволену
* У 3D модель раковини змінюється разом з вибором; кріплення йде за товщиною стільниці, а з увімкненим undertop раковина й стільниця на 2 см вище. Integrated / vessel у 3D визначається лише кодом раковини
