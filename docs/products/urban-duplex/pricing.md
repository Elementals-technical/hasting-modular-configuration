<!-- Urban Duplex · specification revision 2026-10-28 · part of docs/products/urban-duplex/ · statuses: ../_shared/status-legend.md -->

## 8. Ціноутворення
Разом = Σ тумб (включно з Open Shelf і Open Side Shelf) + стільниця + на кожну Sink Base (інтегрована раковина або виріз + vessel) + рядок отворів під змішувач ($0) + рушникотримач + нижня стільниця (Lower). Кожен рядок — один SKU, ціну дає сервіс цін; конфігуратор не має власного прайсу [code: UI pricing] [price: Urban Duplex xlsx]. Стільниця, раковини, vessel, отвори і рушникотримач оцінюються як USH (у прайсі Urban Duplex їх немає).

### 8.1 Рядки і склад SKU
| Рядок | Шаблон SKU | К-сть | Ціна залежить від | Джерело ціни |
| :---- | :---- | :---- | :---- | :---- |
| Тумба Urban Duplex | VAN-URDPX-<SB/SC>/<2DW/1DW/1DWID><L/R>/UG/X-<W>W-<22.0/20.9/15.0/11.0>H-<19.7/18.1>D-BASP-<mat>-<code>-LTLP-<mat>-<code>-HNDL-<mat>-<code> | 1 на тумбу | тип, ширина, клас висоти (56 / 53 vs 38 / 28), категорія матеріалу (§8.2) | [price: Urban Duplex xlsx Pricing] |
| Гібридна тумба | VAN-<URSTD/URLH>-SC/<2DW/1DW/1DWID>/UG/X-<W>W-<H>H-<D>D-CAB-<mat>-<code>-HDL-<mat>-<code> | 1 на тумбу | серія, ширина, висота, матеріал | прайси USH / ULH (Provisional) |
| Open Shelf | VAN-UROS-<2S/1S>-<W>W-<H>H-<D>D-CAB-<mat>-<code> | 1 на модуль | ширина, кількість полиць, матеріал (Base Panel) | "use existing cabinet prices" USH / ULH |
| Open Side Shelf | VAN-UROSS-<L/R>-5.9W-<H>H-<D>D-CAB-<mat>-<code> | 1 на модуль | висота, матеріал (Lateral Panel) | "use existing cabinet prices" USH / ULH |
| Стільниця | CT-UR<HPL/FX/POR>-<INTG/VES>-<W>W-<thickness>H-<D>D-<mat>-<code> | 1 на стільницю | матеріал, товщина, стиль, довжина | USH (Provisional) |
| Інтегрована раковина | CT-UR<mat>-<basin>-<thickness>H-<mat>-<code> (напр. CT-URHPL-STRIP-.5H-HPL-TKH) | 1 на Sink Base | раковина, матеріал, товщина | USH (Provisional) |
| Виріз під vessel | CT-UR<mat>-HCUT | 1 на Sink Base зі стилем vessel | – ($637) | [price: Accessories Pricing, скріншот USH] |
| Vessel | VES-<код серії>-X-<W>W-<H>H-<D>D-<CER/SS/SSTKR>-<код кольору> (код серії: BLD11, BLD18, URMOD, URMORS, ACQS; W/H/D — фіксовані розміри самої чаші, USH-таблиця) | 1 на Sink Base з vessel | vessel, оздоблення | **Provisional** — у даних клієнта для Urban Duplex vessel і цін немає |
| Отвори під змішувач | CT-UR<mat>-FAHO/<0–3> | 1 на стільницю | – ($0) | [price: Accessories Pricing] |
| Рушникотримач | VAN-URTWLBR-STB/<L/R>-15.7W-1.4H-2D-LACM-<код кольору> MT (напр. VAN-URTWLBR-STB/R-15.7W-1.4H-2D-LACM-43 MT); сервіс цін зіставляє базу VAN-URTWLBR-STB/<L/R>-15.7W-1.4H-2D ($380 за бік) | 1 на кожен бік | – ($380) | [price: Accessories Pricing] |
| Нижня стільниця (Lower) | CT-UR<mat>-<INTG/VES>-<W>W-.5H-<D>D-<mat>-<code> (стиль — як у Upper) | 1 на непокриту нижню тумбу | матеріал, довжина | **Provisional** (DUP-TOP-01) |

(У шаблонах SKU / у кутових дужках розділяє варіанти.)

Приклади [code: UI SKU tests]: VAN-URDPX-SB/2DWR/UG/X-27.6W-22.0H-19.7D-BASP-ST-DA-LTLP-HPL-TKH-HNDL-HPL-TKH; VAN-URSTD-SC/2DW/UG/X-19.7W-22H-19.7D-CAB-ST-DA-HDL-HPL-TKH; VAN-UROS-2S-13.8W-22H-19.7D-CAB-ST-DA; VAN-UROSS-L-5.9W-20.9H-19.7D-CAB-HPL-TKH; CT-URHPL-INTG-47.2W-.5H-19.7D-HPL-TKH; CT-URHPL-STRIP-.5H-HPL-TKH; CT-URHPL-FAHO/0.

* Розміри в SKU — дюйми з одним знаком (60 см = 23.6"; 50 см = 19.7D, 46 см = 18.1D); у SKU Structure / SKU Curation клієнта — см, у Pricing і листах Ryan — дюйми
* Елемент пазу: у тумбах Urban Duplex — HNDL (як у колонці K прайсу), у гібридних — HDL (як у SKU Structure клієнта) → UNKNOWN — clarify, який токен очікує сервіс цін
* Колір пазу (HNDL / HDL) у SKU — колір Lateral Panel (Provisional, DUP-PNL-02)

### 8.2 Що змінює ціну
| Змінює ціну | Не змінює ціну |
| :---- | :---- |
| тип тумби (SB / SC), ширина, клас висоти (висока 56 / 53 vs низька 38 / 28), категорія матеріалу (3D < White GL/MT < LACM < LACG = ST = BM < HPL = ESS); при різних матеріалах Base Panel / Lateral Panel / паз колонку вибирає сервіс цін за повним SKU (за правилом USH — найдорожча, Provisional); серія гібридної тумби; Open Shelf, Open Side Shelf; матеріал, товщина, стиль і довжина стільниці; раковина; vessel і його оздоблення; виріз; рушникотримач; нижня стільниця | глибина (50 = 46); бік Lateral Panel (L = R); 56 vs 53 і 38 vs 28; 2DW vs 1DW vs 1DWID у межах класу висоти; конкретний колір у межах матеріалу; кількість отворів під змішувач ($0) [price: Urban Duplex xlsx Pricing] |

* Глибина (50 = 46) і бік (L = R) не змінюють ціну там, де рядки існують. У прайсі відсутні: Side Cabinet 2DW на 46 см (лише 50 см) та Side Cabinet 1DW 15.0H / 46 см із панеллю зліва (лише справа) — для них ціни може не бути (gap). Рядок SB/1DWL…35.4W-11.0H-18.1D у прайсі відрізняється від решти (імовірна помилка клієнта)
* Колонка "White GL/MT" у прайсі клієнта для Urban Duplex не використовується: Bianco 0B MT / GL пишуться LACM / LACG [derived]; до яких кольорів клієнт застосовує цю колонку — UNKNOWN — clarify
