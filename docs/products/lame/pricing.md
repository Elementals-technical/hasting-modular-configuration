<!-- Lame · specification revision 2026-10-28 · part of docs/products/lame/ · statuses: ../_shared/status-legend.md -->

## 8. Ціноутворення
Разом = Σ тумб + ніжки (2 ніжки + 2 заглушки, якщо увімкнено) + undertop (якщо увімкнено) + стільниця + на кожну Sink Base (інтегрована раковина або виріз + vessel) + рядок отворів під змішувач (коли вибрано). Кожен рядок — один SKU, ціну дає сервіс цін; конфігуратор не має власного прайсу [code: UI pricing] [price: Lame xlsx, Class xlsx].

### 8.1 Рядки і склад SKU
| Рядок | Шаблон SKU | К-сть | Ціна залежить від | Джерело ціни |
| :---- | :---- | :---- | :---- | :---- |
| Тумба | VAN-LAMEV-<SB/SC>/<1DW/2DW>/G58/<GAL/GES/OXF/PIQ/PLIS>-<W>W-<10.2/20.5>H-20.5D-CAB-<LACM/LACG>-<colour code>-HDL-<LACM/MTL>-<colour code/GLD/SLV> | 1 на тумбу | тип, ящики, ширина, матеріал корпусу (LACM / LACG) | [price: Lame xlsx CabinetPricing] |
| Ніжка | VAN-LAMEV-LEG/<1DW-22.6H/2DW-12.4H>-CAB-<LACM/LACG>-<colour code> | 2 на композицію | стиль ящиків, матеріал корпусу | **Provisional** – [price: Lame xlsx CabinetPricing A135–A137] |
| Заглушка ніжки | VAN-LAMEV-LEGCAP-<MTL-GLD/MTL-SLV/LACM-<code>> | 2 на композицію | – ($0) | [price: Lame xlsx CabinetPricing A139–A140] |
| Undertop | CT-GB<MTL/LACM>-UDTP-<W>W-.7H-20.5D-<MTL-GLD/MTL-SLV/LACM-<code>> | 1 на композицію | матеріал (MTL / LACM) × см ширини композиції | [price: Lame xlsx CountertopPricing A18–I21] |
| Стільниця | CT-GB<material>-<INTG/VES>-<W>W-<.5/.8>H-20.7D[-<material>-<colour code>] | 1 на композицію | цінова група, товщина, стиль, довжина (сума ширин) | [price: Class xlsx CountertopPricing] |
| Інтегрована раковина | CT-GB<material>-<basin code>-<.5/.8>H | 1 на Sink Base | код раковини, цінова група | [price: Class xlsx Basin StylePricing] |
| Виріз під vessel | CT-GB<material>-HCUT | 1 на Sink Base зі стилем vessel | цінова група | [price: Class xlsx AccessoriesPricing A3–C10] |
| Vessel | VES-<IRIS/FRM/PLZ>-X-<w>W-<h>H-<d>D-<LACM/LACG>-<code> | 1 на Sink Base з Iris/Frame/Plaza | vessel, оздоблення | **Provisional** – ціна за SKU vessel із таблиці SKU_Vessels_V2 (542) сервісу цін, як у Mako; у прайсах клієнта цін vessel немає |
| Отвори під змішувач | CT-GB<material>-FAHO/<0–3> | 1 на стільницю, коли вибрано | кількість (3 отвори $275) | [price: Class xlsx AccessoriesPricing] |
| Бокова панель | VAN-LAMEV-SP/<2DW/1DW>/<pattern>-2.0W-<20.5/10.2>H-20.5D | – | – | **Not implemented** (є в прайсі клієнта) |

(У шаблонах SKU / у кутових дужках розділяє варіанти.)

Приклади [code: UI SKU tests]: VAN-LAMEV-SB/2DW/G58/OXF-23.6W-20.5H-20.5D-CAB-LACM-417-HDL-LACM-433; VAN-LAMEV-SB/2DW/G58/OXF-23.6W-20.5H-20.5D-CAB-LACG-411-HDL-MTL-GLD; VAN-LAMEV-LEG/1DW-22.6H-CAB-LACM-400; VAN-LAMEV-LEGCAP-MTL-GLD; CT-GBLACM-UDTP-63W-.7H-20.5D-LACM-433; CT-GBHPL-INTG-47.2W-.5H-20.7D-HPL-259; CT-GBPOR-LV890-.8H; CT-GBSSTEX-VA030-.5H.

* Ціни тумб у клієнта (LACM / LACG): SB 2DW $3,014–4,411 / $3,294–4,852; SB 1DW $1,808–2,647 / $1,937–2,856; SC 2DW $2,773–4,639 / $3,054–5,130; SC 1DW $1,567–2,687 / $1,697–2,921. Ніжка: 1DW $1,285 / $1,495, 2DW $1,180 / $1,355
* Цінова група стільниці: від раковини, якщо раковина визначає групу (VA030 → SSTEX), інакше від кольору (Matte White SSTL, HPL, POR, GLSM, GLSG). Групування Solid Surface — Provisional (§4.6)
* Ширина undertop і стільниці = сума ширин тумб (бокових панелей у збірці немає); SKU не будується, поки сцена не повідомила ширину
* Ширини в SKU — дюйми з одним знаком після коми (60 см = 23.6"); у SKU Curation клієнта — см (VAN-LAMEV-SB/2DW/G58/OXF-60W-52H-52D) → формат підтвердити (GEN-SKU-02)
* Глибина стільниці в SKU 20.7", тумб і undertop — 20.5" (LAME-TOP-02)

### 8.2 Що змінює ціну
| Змінює ціну | Не змінює ціну |
| :---- | :---- |
| тип тумби, ширина, стиль ящиків (1DW vs 2DW), матеріал корпусу (Lacquered GL vs Lacquered MT); ніжки увімк. (і їхня ціна за стилем ящиків та матеріалом корпусу); undertop увімк., його матеріал (MTL vs LACM) і ширина композиції; матеріал, товщина, стиль і довжина стільниці; код раковини; vessel і його оздоблення; 3 отвори під змішувач | патерн; колір ручки і його матеріал (ціна тумби однакова для HDL-LACM і HDL-MTL); колір заглушки; конкретний колір у межах матеріалу; 0–2 отвори [price: Lame xlsx CabinetPricing] |
