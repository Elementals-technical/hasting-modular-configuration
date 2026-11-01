<!-- Class · specification revision 2026-10-28 · part of docs/products/class/ · statuses: ../_shared/status-legend.md -->

## 8. Ціноутворення
Разом = Σ тумб + стільниця + на кожну Sink Base (інтегрована раковина або виріз + vessel) + кронштейни + рядок отворів під змішувач (коли вибрано). Кожен рядок — один SKU, ціну дає сервіс цін; конфігуратор не має власного прайсу [code: UI pricing] [price: Class xlsx].

### 8.1 Рядки і склад SKU
| Рядок | Шаблон SKU | К-сть | Ціна залежить від | Джерело ціни |
| :---- | :---- | :---- | :---- | :---- |
| Тумба | VAN-CLSV-<SB/SC>/<1DW/2DW/1DWID>-<W>W-<15.7/20.5>H-20.5D-CABF-<material>/<B/C>-<colour code>-CABS-<material>-<colour code>-FRM-LACM-<colour code> | 1 на кожну тумбу-шафу | тип, стиль ящиків, ширина, матеріал Cabinet Color, клас рамки /B або /C | [price: Class xlsx CabinetPricing] |
| Стільниця | CT-GB<material>-<INTG/VES>-<W>W-<thickness>H-20.7D[-<material>-<colour code>] | 1 на всю композицію (ширина = сумарна довжина всіх тумб) | цінова група, товщина, стиль, довжина | [price: Class xlsx CountertopPricing] |
| Інтегрована раковина | CT-GB<material>-<basin code>-<thickness>H | 1 на Sink Base | код раковини, цінова група | [price: Class xlsx Basin StylePricing] |
| Виріз під vessel | CT-GB<material>-HCUT | 1 на Sink Base зі стилем vessel | цінова група | [price: Class xlsx AccessoriesPricing A3–C10] |
| Vessel | VES-<IRIS/FRM/PLZ>-X-<w>W-<h>H-<d>D-<LACM/LACG>-<code> | 1 на Sink Base з Iris/Frame/Plaza | vessel, оздоблення | **Provisional** – у прайсі Class цін vessel немає |
| Кронштейн | CT-GB-BRKT | 2, коли товщина 3.1", 4" або 4.7" | – | [price: Class xlsx Basin StylePricing A42–A43] |
| Отвори під змішувач | CT-GB<material>-FAHO/<0–3> | 1 на стільницю, після вибору | кількість отворів ($0 або $275 за 3) | [price: Class xlsx AccessoriesPricing] |
| Органайзер ящика | VAN-GBDIV-MTL-3.9W-2H-16.9D / VAN-GBDIV-OAK-3.8W-2.6H-16.9D | – | – | Not implemented (у UI недосяжно); у клієнта $170 / $150 |

(У шаблонах SKU / у кутових дужках розділяє варіанти.)

Приклади [code: UI SKU tests] [price: Class xlsx CabinetPricing]: VAN-CLSV-SB/2DW-31.5W-20.5H-20.5D-CABF-POR/C-338-CABS-LACM-410-FRM-LACM-410 = 5084 (як у прайсі клієнта); VAN-CLSV-SB/1DWID-39.4W-15.7H-20.5D-CABF-SGLS/B-SG-CABS-LACM-433-FRM-LACM-433; CT-GBHPL-INTG-47.2W-.5H-20.7D-HPL-259 = 1836; CT-GBHPL-VA024-.5H = 3714; CT-GBPOR-LV890-.8H.

* Матеріал Cabinet Color у SKU: LACM, LACG, POR, LAM, GLSM, GLSG, SGLS (Glass і Smoke Glass — Provisional — підлягає видаленню). Код кольору — число з назви (433), для Fume — SG.
* Висота тумби в SKU: 15.7H (40 см) або 20.5H (52 см, 2DW). У прайсі клієнта для 2DW записано 52H → формат підтвердити (UNKNOWN — clarify).
* Як клас /B / /C виводиться з кольору рамки, клієнт прямо не сказав; наш висновок «Nero 433 MT → /B» — Provisional.
* Цінова група стільниці: від раковини, якщо раковина належить одній групі (VA023 → SSTMT), інакше від кольору (Matte White SSTL, Matte White 8cm SSTMT, HPL, POR, GLSM, GLSG). Групування Solid Surface — Provisional (§4.4).
* Ширини в SKU — дюйми з одним знаком після коми (60 см = 23.6"); у SKU Curation клієнта використовуються см → формат підтвердити.

### 8.2 Що змінює ціну
| Змінює ціну | Не змінює ціну |
| :---- | :---- |
| тип тумби, ширина, стиль ящиків (1DW vs 2DW/1DWID), матеріал Cabinet Color (LACM / GLSM / GLSG / SGLS / LAM vs дорожчі POR / LACG), клас рамки (Nero 433 MT vs інший колір рамки); матеріал, товщина, стиль і довжина стільниці; код раковини; vessel і його оздоблення; кронштейни товстої стільниці; 3 отвори під змішувач | Cabinet Side Color (матеріал і колір); колір рамки в межах класу /C; конкретний колір у межах матеріалу; 2DW vs 1DWID (однакова ціна); 0, 1 або 2 отвори [price: Class xlsx CabinetPricing] |
