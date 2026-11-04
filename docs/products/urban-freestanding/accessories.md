<!-- Urban Freestanding · specification revision 2026-11-03 · part of docs/products/urban-freestanding/ · statuses: ../_shared/status-legend.md -->

## 6. Аксесуари
### 6.1 Доступно: бокові панелі (на тесті, backlog #73)
| Пункт | Значення |
| :---- | :---- |
| Де | крок "Accessories", блок "Side Panels" (обидва сценарії) |
| Опції | None; No groove (NoG); 1 groove (upper) (UpperG) |
| Доступність | тумби 91 см (UG, CG): No groove, 1 groove (upper); тумби 88 см (PTO): лише No groove; поруч з Open Shelf і Open Side Shelf — панелі немає |
| Стартовий вибір | UG → 1 groove (upper); CG і PTO → No groove |
| Розміщення | лише на відкритих торцях композиції; лівий і правий бік окремо |
| Вигляд у 3D | залежить від висоти тумби, а не від вибору: 53/88 — без пазу, 56/91 — з верхнім пазом [derived] → No groove на 91 см у 3D показує паз; перевірити |
| Колір | панель — Cabinet Color; паз — Handle Color (або колір корпусу); без fluting |
| Висота | клієнт: висота корпусу без цоколя ("It does not extend down to the floor where the plinth is"); у 3D — **перевірити** (backlog #32 "Side Panels висять у повітрі" — in progress) |
| Вплив на стільницю | стільниця подовжується з боковими панелями (параметр 2 см; у USH +1 см на кожен торець) |
| Ціна | як у USH (VAN-URSP-…) за висотою першої високої тумби → **Provisional**. Увага: рядки цін USH для VAN-URSP є лише до висоти 22"; для UF-панелей 34.6H / 35.8H відповідного рядка в прайсі немає — ціна панелі потребує підтвердження клієнтом (UNKNOWN — clarify). Бокова панель поруч із короткою тумбою не має ціни і блокує підсумок (blocksTotal: true), доки клієнт не надасть прайс (аналогічно роздільнику та Lower cover) |
| Ліміт | у правилах є блокування панелі при довжині тумб 340 см — поведінку перевірити на тесті |

* Клієнт: біля короткої тумби потрібні панелі двох висот (низька — з боку короткої тумби, висока — з іншого краю) → для короткої тумби **Not implemented** у ціні; 3D — перевірити

### 6.2 Доступно: рушникотримач (Towel Bar)
| Пункт | Значення |
| :---- | :---- |
| Де | крок "Accessories", блок "Towel Bar" |
| Опції | None, Left, Right, Both |
| Колір | 5 кольорів Lacquered MT (§4.7); блок видимий лише коли рушникотримач вибрано; рушникотримач стартує в Carbone 43 MT і отримує цей колір при кожному додаванні, при None колір скидається |
| 3D | бічний рушникотримач на крайній тумбі, вирівняний по її верху; враховує бокову панель (backlog #31 — Done) |
| Ціна | як у USH: VAN-URTWLBR-STB/<L/R>-15.7W-1.4H-2D-<колір>, $380 за бік (Provisional) |

* Рушникотримач поруч із короткою тумбою: UNKNOWN — clarify (Q27)

### 6.3 Недоступно
| Аксесуар | Статус |
| :---- | :---- |
| Drawer Dividers (A, B, C) | **Not implemented** (backlog #65, гілка divider/phase-2). Секція Dividers видима, але в 3D немає точок для органайзерів, ціни немає, і вибір стилю блокує підсумкову ціну |
| Анімація відкриття ящиків | Not implemented для UF (у моделі UF немає точок відкриття) |
| Inner LED | Not in scope (для UF не визначено; GEN-ACC-01) |
| Grain Direction / Book Matching | UNKNOWN — clarify (у тексті UF немає, але прайс посилається на SKU Book Matching з USH; GEN-STY-01) |
| Undermount | Not in scope (клієнт: "We don't have Undermount in the experience currently") |
| Ніжки | Not in scope (цоколь замість ніжок) |
