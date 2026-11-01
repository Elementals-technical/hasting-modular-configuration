<!-- Mako · specification revision 2026-10-28 · part of docs/products/mako/ · statuses: ../_shared/status-legend.md -->

## 8. Ціноутворення
Разом = Σ тумб + ніжки (одна пара, якщо увімкнені) + стільниця + на кожну Sink Base (інтегрована раковина або виріз + vessel) + рядок отворів під змішувач (якщо вибрано). Кожен рядок — один SKU, ціну дає сервіс цін; конфігуратор не має власного прайсу [code: UI pricing] [price: Mako xlsx, Class xlsx].

### 8.1 Рядки і склад SKU
| Рядок | Шаблон SKU | К-сть | Ціна залежить від | Джерело ціни |
| :---- | :---- | :---- | :---- | :---- |
| Тумба (шафа) | VAN-MAKOV-<SB/SC>/<1DW/2DW>/<G57/G50>-<W>W-<10.2/20.5>H-20.5D-CAB-<LACM/LACG>-<colour code>-HDL-<LACM/MTL>-<code/GLD/SLV> | 1 на шафу | тип, ящики, ширина, матеріал корпусу (LACM / LACG) | [price: Mako xlsx CabinetPricing] |
| Ніжки | VAN-MAKOV-LEG-<LACM-<colour code> / MTL-<GLD/SLV>> | 2 на композицію (Provisional) | матеріал ніжок (Metal / Lacquered MT) | [price: Mako xlsx CabinetPricing A54] |
| Стільниця | CT-GB<SSTL/HPL/POR/GLSM/GLSG>-<INTG/VES>-<W>W-<.5/.8>H-20.7D[-<material>-<colour code>] | 1 на композицію | цінова група, стиль, довжина (ставка за см × довжина) | [price: Mako xlsx CountertopPricing] |
| Інтегрована раковина | CT-GB<material>-<basin code>-<.5/.8>H | 1 на Sink Base | код раковини, цінова група | [price: Mako xlsx Basin StylePricing] |
| Виріз під vessel | CT-GB<material>-HCUT | 1 на Sink Base зі стилем vessel | цінова група | [price: Class xlsx AccessoriesPricing A3–C10] |
| Vessel | VES-<IRIS/FRM/PLZ>-X-<w>W-<h>H-<d>D-<LACM/LACG>-<code> | 1 на Sink Base з Iris/Frame/Plaza | vessel, оздоблення | **Provisional** – у прайсах клієнта для Mako цін vessel немає; ціна з сервісу цін |
| Отвори під змішувач | CT-GB<material>-FAHO/<0–3> | 1 на композицію, коли вибрано | кількість отворів (3 = $275, інакше $0) | [price: Class xlsx AccessoriesPricing] |

(У шаблонах SKU / у кутових дужках розділяє варіанти.)

Приклади [code: UI SKU tests] [price: Mako xlsx CabinetPricing]: VAN-MAKOV-SB/2DW/G57-23.6W-20.5H-20.5D-CAB-LACG-403-HDL-MTL-SLV ($3,028); VAN-MAKOV-SC/1DW/G50-31.5W-10.2H-20.5D-CAB-LACG-403-HDL-MTL-GLD; VAN-MAKOV-LEG-MTL-GLD ($745 × 2); CT-GBSSTL-VES-47.2W-.5H-20.7D; CT-GBPOR-INTG-63W-.8H-20.7D-POR-338; CT-GBPOR-LV890-.8H; CT-GBSSTL-HCUT; CT-GBSSTL-FAHO/3.

* Ставки стільниці (US, за см): SSTL 13.11; HPL 15.30; POR 29.49; GLSG 19.62; GLSM 25.02. Ціни раковин: LB440 / LB175 / LB575 / LB856 1881.67; VA024 3713.99; LV890 / LV892 3149.49; VA002 / VA005 1054.97 [price: Mako xlsx]
* Цінова група стільниці: від кольору (Matte White → SSTL — Provisional, §4.5)
* Ціна тумби "Incomplete", якщо не вистачає даних: колір без коду (наприклад, live-колір Agata BD MT) або невідомий розмір
* Ширини й висоти в SKU — дюйми з одним знаком (60 см = 23.6", 26 см = 10.2"); у SKU Curation клієнта — см → формат підтвердити
* Звірка з прайс-листом клієнта: SB 60 1DW + стільниця + раковина дають рівно ціни прайс-листа ($4,347 SS, $6,598 Porcelain, $3,911 / $4,235 Glass, $6,311 HPL) [derived]

### 8.2 Що змінює ціну
| Змінює ціну | Не змінює ціну |
| :---- | :---- |
| тип тумби, ширина, стиль ящиків (1DW vs 2DW), матеріал корпусу (Lacquered MT vs GL); ніжки та їх матеріал (Metal vs Lacquered MT); матеріал, стиль і довжина стільниці; код раковини; виріз і vessel з оздобленням; 3 отвори під змішувач | ручка G57 vs G50; колір ручки; конкретний колір у межах матеріалу; товщина (задана матеріалом); 0–2 отвори; група Solid Surface (SSTL = SSTM = SSTEX) [price: Mako xlsx CabinetPricing] |
