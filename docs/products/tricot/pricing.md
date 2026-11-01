<!-- Tricot · specification revision 2026-10-28 · part of docs/products/tricot/ · statuses: ../_shared/status-legend.md -->

## 8. Ціноутворення
Разом = Σ тумб + Σ бокових панелей + стільниця + на кожну Sink Base (інтегрована раковина або виріз + vessel) + кронштейни + рядок отворів під змішувач ($0). Кожен рядок — один SKU, ціну дає сервіс цін; конфігуратор не має власного прайсу [code: UI pricing] [price: Tricot xlsx, Class xlsx].

### 8.1 Рядки і склад SKU
| Рядок | Шаблон SKU | К-сть | Ціна залежить від | Джерело ціни |
| :---- | :---- | :---- | :---- | :---- |
| Тумба | VAN-TRIC-<SB/SC>/<1DW/2DW/1DWID>/<LOD/CAN/TWLL/GES/SAT>-<W>W-15.7H-20.5D-CAB-<LACM/WDV>-<colour code>-HDL-LACM-<groove code> | 1 на тумбу | тип, ящики, ширина, матеріал корпусу (WDV / LACM) | [price: Tricot xlsx CabinetPricing] |
| Бокова панель | VAN-TRIC-SP-.8W-15.7H-20.5D-CAB-<LACM/WDV>-<colour code> | 1 на активний бік | матеріал корпусу | [price: Tricot xlsx CabinetPricing A176] |
| Стільниця | CT-GB<material>-<INTG/VES>-<W>W-<thickness>H-20.7D[-<material>-<colour code>] | 1 на тумбу | цінова група, товщина, стиль, довжина (тумби + 1 см на бокову панель) | [price: Class xlsx CountertopPricing] |
| Інтегрована раковина | CT-GB<material>-<basin code>-<thickness>H | 1 на Sink Base | код раковини, цінова група | [price: Class xlsx Basin StylePricing] |
| Виріз під vessel | CT-GB<material>-HCUT | 1 на Sink Base зі стилем vessel | цінова група | [price: Class xlsx AccessoriesPricing A3–C10] |
| Vessel | VES-<IRIS/FRM/PLZ>-X-<w>W-<h>H-<d>D-<LACM/LACG>-<code> | 1 на Sink Base з Iris/Frame/Plaza | vessel, оздоблення | **Provisional** – ціни vessel із Class; у даних клієнта для Tricot цін vessel немає |
| Кронштейн | CT-GB-BRKT | 2, коли товщина 3.1", 4" або 4.7" | – | [price: Class xlsx Basin StylePricing A42–A43] |
| Отвори під змішувач | CT-GB<material>-FAHO/0 | 1 на стільницю, завжди 0 отворів | – ($0) | [price: Class xlsx AccessoriesPricing] |

(У шаблонах SKU / у кутових дужках розділяє варіанти.)

Приклади [code: UI SKU tests] [price: Tricot xlsx CabinetPricing C2, H2]: VAN-TRIC-SC/1DW/TWLL-15.7W-15.7H-20.5D-CAB-WDV-933-HDL-LACM-412; VAN-TRIC-SC/1DWID/LOD-47.2W-15.7H-20.5D-CAB-LACM-413-HDL-LACM-413; CT-GBHPL-INTG-23.6W-.5H-20.7D-HPL-250; CT-GBPOR-LV890-.8H.

* Цінова група стільниці: від раковини, якщо раковина належить одній групі (VA023 → SSTMT), інакше від кольору (Matte White SSTL, Matte White 8cm SSTMT, HPL, POR, GLSM, GLSG) [code: tricot/sku-profile.json]. Групування Solid Surface — Provisional (§4.4).
* Ширини в SKU — дюйми з одним знаком після коми (60 см = 23.6"); у SKU Curation клієнта також використовуються см [price: Tricot xlsx SKU Curation] → формат підтвердити (§10.3).

### 8.2 Що змінює ціну
| Змінює ціну | Не змінює ціну |
| :---- | :---- |
| тип тумби, ширина, стиль ящиків (1DW vs 2DW/1DWID), матеріал корпусу (Wood Veneer vs Lacquered MT); кількість бокових панелей; матеріал, товщина, стиль і довжина стільниці; код раковини; vessel і його оздоблення; кронштейни товстої стільниці | патерн у межах Wood Veneer (Cannette = Twill = Gessato = Satin); колір пазу; 2DW vs 1DWID; конкретний колір у межах матеріалу [price: Tricot xlsx CabinetPricing] |

##
