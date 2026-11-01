<!-- Urban Low Height · specification revision 2026-10-28 · part of docs/products/urban-low-height/ · statuses: ../_shared/status-legend.md -->

## 8. Ціноутворення
Разом = Σ шаф + Σ бокових панелей + основна стільниця (і кожна копія стільниці для розсунутих Sink Base) + на кожну Sink Base (інтегрована раковина або виріз + vessel) + рядок отворів під змішувач ($0) + кожен кавер + рушник. Кожен рядок — один SKU, ціну дає сервіс цін; конфігуратор не має власного прайсу. Стільниця, раковини, vessel, бокові панелі й рушник цінуються як Urban Standard Height [code: UI pricing] [price: ULH xlsx].

### 8.1 Рядки і склад SKU
| Рядок | Шаблон SKU | К-сть | Ціна залежить від | Джерело ціни |
| :---- | :---- | :---- | :---- | :---- |
| Шафа SB / SC | VAN-URLH-<SB/SC>/1DW/<UG/PTO>/<X/CVA/CVB/CHA/CHB>-<W>W-<H>H-<D>D-CAB-<material>-<code>[-HDL-<material>-<code>] | 1 на шафу | тип, ширина, цінова колонка матеріалу (3D / LACM / LACG = ST = BM / HPL = ESS), fluting | [price: ULH xlsx Pricing] |
| Open Shelf | VAN-UROS-1S-<W>W-<H>H-<D>D-CAB-<material>-<code> | 1 на полицю | ширина, цінова колонка | [price: ULH xlsx Pricing] |
| Open Side Shelf | – (Not implemented) | – | – | є в прайсі клієнта |
| Стільниця | CT-UR<group>-<INTG/VES>-<W>W-<T>H-<D>D-<group>-<code> | 1 на стільницю (+ кожна копія) | група матеріалу, товщина, стиль, довжина (шафи + 1 см на панель або власна довжина) | **Provisional** — ціни USH; у прайсі ULH стільниць немає |
| Інтегрована раковина | CT-UR<group>-<BASIN>-<T>H-<group>-<code> | 1 на Sink Base (або раковину, яку несе стільниця) | раковина, група | **Provisional** — ціни USH |
| Виріз під vessel | CT-UR<group>-HCUT | 1 на Sink Base зі стилем Vessel | група | [price: USH Accessories, $637] |
| Vessel | VES-<vessel>-X-<w>W-<h>H-<d>D-<material>-<code> | 1 на Sink Base з вибраним vessel | vessel, оздоблення | **Provisional** — ціни USH |
| Отвори під змішувач | CT-UR<group>-FAHO/0 | 1 на стільницю, завжди 0 отворів | – ($0) | [price: USH Accessories] |
| Кавер (Lower) | CT-UR<group>-<INTG/VES>-<W>W-.5H-<D>D-<group>-<code> | 1 рядок на кожну різну плиту | група, довжина відкритої частини, глибина шафи під ним; стиль — як в Upper | **лише HPL має ціну**; інші матеріали — без ціни, разом неповний |
| Бокова панель | VAN-URSP-<0G/1GU>-.4W-<H>H-<D>D-CAB-<material>-<code>[-HDL-<material>-<code>] | 1 на активний бік | тип панелі | **Provisional** — у прайсі клієнта рядки лише для висот USH ($135.5 / $207) |
| Рушник | VAN-URTWLBR-STB/<L/R>-15.7W-1.4H-2D-LACM-<code> | 1 на бік | – | [price: USH Accessories, $380] |
| Кронштейни | рядка немає | – | – | UNKNOWN — clarify (клієнт: "ghost brackets", SKU немає) |

(У шаблонах SKU / у кутових дужках розділяє варіанти.)

* Розміри в SKU — дюйми: висота 38 → 15H, 35 → 13.8H, 28 → 11H, 25 → 9.8H (у прайсі клієнта 15.0H, 11.0H); глибина 46 → 18.1D, 50 → 19.7D
* HDL (паз) додається лише для Upper Groove: вибраний колір пазу або, поки він None, колір корпусу. Push to open — без HDL
* Група матеріалу стільниці — токен USH (FX, HPL, POR тощо)

Приклади [code: UI SKU tests]: VAN-URLH-SB/1DW/UG/X-35.4W-15H-19.7D-CAB-HPL-TKF-HDL-HPL-TKF; VAN-URLH-SC/1DW/PTO/X-23.6W-13.8H-19.7D-CAB-LACM-0B; VAN-URLH-SB/1DW/PTO/CVB-41.3W-13.8H-19.7D-CAB-LACM-09; VAN-UROS-1S-9.8W-15H-18.1D-CAB-3D-1A1; CT-URFX-INTG-23.6W-.5H-18.1D-FX-TFA; CT-URFX-PRISMA-.5H-FX-TFA; VES-BLD11-X-19.7W-6.1H-15D-CER-OCF; VAN-URSP-1GU-.4W-15H-17.9D-CAB-3D-1C1-HDL-3D-1C1.

### 8.2 Що змінює ціну
| Змінює ціну | Не змінює ціну |
| :---- | :---- |
| тип шафи, ширина, цінова колонка матеріалу корпусу; fluting (рифлена шафа є лише в колонці LACM і коштує як гладка LACG / ST / BM); кількість бокових панелей і рушників; матеріал, товщина, стиль і довжина стільниці; раковина; vessel і його оздоблення; кавери | ручка (UG vs PTO), висота (38 / 35 / 28 / 25), глибина (46 vs 50), конкретний колір у межах колонки, вид fluting (CVA = CVB = CHA = CHB), позиція стільниці ("Countertop position does not impact price") [price: ULH xlsx Pricing] |
