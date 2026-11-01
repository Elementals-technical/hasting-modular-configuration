# Side panels: правила по колекціях, рішення і відкриті питання

Джерело правил — «Hastings Config Guide» (xlsx Роми, аркуші ULH / ClassMako / UF / Tricot / Urban Duplex) і відповіді Райана. Код посилається на правила лише через цей довідник; розбіжність коду з гайдом — питання до Роми/Райана, а не рішення розробника. Стан звірено з кодом 2026-10-14…10-16 (документи проєкту `research/side-panels-config-guide-vs-code-2026-10-14`, `plans/uf-side-panels-plan-2026-10-14`, `handoffs/uf-side-panels-implemented-2026-10-14`, `handoffs/uf-handle-drives-height-2026-10-14`, `handoffs/tricot-side-panels-2026-10-16`, `research/side-panels-group-review-2026-10-14`).

## Терміни
- **Side panel / «саб-панель» / бокова панель** — декоративна панель на відкритому торці ряду тумб. У 3D це окремий продукт-addon, не частина меша тумби.
- **Тип панелі**: `NoG` (без паза), `UpperG` (верхній паз під top-cut ручку), `DoubleG` (два пази; лише UD за гайдом). Тип іде за ручкою тумби-краю, не за запитом UI.
- **end** — панель на зовнішньому торці групи; **joint** — вузька смуга на торці вищої тумби, що дивиться на нижчу сусідку (лише UF). Стільниця подовжується на +1 см тільки за `end`.
- **Legacy pipeline** — два фіксовані слоти `SidePanel_Left/Right` на всю композицію (USH, Class, Mako, UD поки що). **Group pipeline** — панелі по профілю колекції на кожному відкритому торці кожної групи (ULH, UF, Tricot).
- **Profile** — опис колекції для group pipeline: продукти панелей, шаблон, вузли, політика плану/типу (`AC/domain/addons/side-panel-profiles.mjs`).
- **Edge cabinet** — тумба, чий торець отримує панель; від неї беруться Height, Depth, колір, ручка. У group pipeline — фізично крайня по X; у legacy — за `orderIndex`.

## Матриця колекцій

| Колекція | Pipeline | Шаблон | Висоти / глибини | Тип за гайдом | Стан у коді |
|---|---|---|---|---|---|
| ULH (Urban Low Height) | group, профіль `ulh` | `ULH_UniSidePanel` (SmartStretch, таблиці) | 25 / 28 / 35 / 38 / 50 / 56; depth 46 / 50.5 | `Handle` pto → NoG, urban_topcut → UpperG (ULH:88-101); без Handle — запитаний UpperG/NoG, а `CenterG`/`DoubleG` → NoG | ✅ збігається. Панель на кожному торці кожного ряду; стек = 2 панелі, висоти не сумуються |
| UF (Urban Freestanding) | group, профіль `uf` | `UF_SidePanel` (asset 308561879): `Point → Inlay_Bot, Inlay_Top, Panel_Bot, Panel_Full, Panel_Top`, усі з smartStretch margin 0.1 | корпус 50 / 53 / 85 / 88 (82 → 85 з 14.10, `7fa5c98`, `299504b`); depth **46 → StretchZ −0.08, 50 → 0** (гайд писав 45 → −0.1; код змінено в `9463eab`, тест `uf-side-panel.test.mjs` досі шле 45 → 4 червоні) | ручка задає висоту: PTO → 85 (NoG), UG/CG → 88 (UpperG); 50 → NoG, 53 → UpperG; запитаний з UI тип ігнорується. Part-и: 50 Bot; 53 Bot+Inlay_Bot; 85 Full (+0.06, «waits for the artist»); 88 Bot+Top+обидва Inlay | ✅ реалізовано 14.10 (не перевірено live). Joint: лише 88+53 → Inlay_Top+Panel_Top (85+50 — чекає артиста). UF open shelves `sidePanelSupport` не мають |
| Tricot | group, профіль `tricot` | `Tricot_SidePanel` = `RootNode → Tricot_SidePanel_Panel` (один меш 1×40×52, origin у задньому нижньому куті, без Point і без smartStretch) | фіксовано 40 × 52 | завжди NoG, лівий бік — scale x −1, колір = CabinetColor (не патерн) (Tricot:76-87, 115) | ✅ реалізовано 16.10, **unstaged** на `feture/part-2` (handoff `tricot-side-panels-2026-10-16`). До того legacy-правила не знали 40/52 → панель вища й глибша за тумбу |
| UD (Urban Duplex) | legacy | `SidePanel_Left/Right` | legacy знає лише 50 / 53 / 56 і 46 / 50.5 | 56·2D·Right → DoubleG; 56·2D·Left → NoG; 53·1D·Right → UpperG; 28/38 → ULH-панель, Right NoG / Left UpperG (UD:176-198) | ❌ тип = запитаний; `RuleSidePanels` не слухає `HandleSide` / `Drawers`. У гайді суперечність: рядок 193 vs 176-179 — питання Ромі. Немає типу для 53·1DWID, 53·Left, 56·Default |
| USH (Urban Standard Height) | legacy | `SidePanel_Left/Right`, mesh switching | 50 / 53 / 56; 46 / 50.5 | — | працює як було |
| Class / Mako | legacy | `SidePanel_Left/Right` | висота 52 / глибина 52 **без меша** | у гайді side panels **немає** | ❓ чи потрібні взагалі — питання клієнту |
| Lame | — | `Lame_SidePanel` є в сцені (експорт 17) | — | — | не починали |

## Спільні правила (гайд + рішення Андрія 14.10)
1. Розміщення по групах — ULH/UF/Tricot (group pipeline); legacy лишається з 2 слотами.
2. Стек (ряд на ряду): дві панелі, по одній на ряд; висоти не сумуються.
3. Вибір панелей глобальний на композицію: left / right / both; **UI API не змінюється**. Per-end перемикання — не вирішено.
4. Торці біля розриву ряду (gap edges) отримують панелі (spec AC-20) — рекомендовано «так», **Райан ще не підтвердив**; у коді завжди увімкнено, фільтра `includeGapEdges` немає.
5. Накриті (covered) і часткові (partial) торці панелі не отримують; непідтримувана висота → `unresolved` з `reason`, панелі немає, стільниця все одно розкладається (див. відомі проблеми).
6. Ключ панелі — `cabinetId:side`; id панелей змінюються, коли змінюється крайня тумба (UI і pricing мають перелічувати 0..N панелей на сторону, не два фіксовані імені).
7. OSS (бічна відкрита полиця) займає місце панелі (UF, UD; гайд Condition 1-3) — **не реалізовано**.
8. `ULH-Open-Shelf` без `sidePanelSupport` → OS на краю без панелі; гайд такого обмеження не має — ймовірно баг.
9. Стільниця: +1 см на кожну `end`-панель; joint не подовжує. Towel bar бере крайню тумбу по X.

## Відомі проблеми в коді (рев'ю `bdd0f85`, 14.10; перевір, чи ще актуальні)
| Пріоритет | Проблема | Де |
|---|---|---|
| high | `RuleCountertopLayout` при `unresolved` плані панелей робить `return` і пропускає розкладку стільниці цілком (тригер: тумба без entity під час імпорту, `cabinet-bounds-missing`) | `composition/rules/RuleCountertopLayout.mjs` ~:136 |
| medium | Панелі створюються/знищуються всередині `RuleCountertopLayout` (`materializeGroupPlan`), переписується `shared.allProducts` — потрібен один власник | там само |
| medium | Групування `rowId \|\| SupportGroupId`, перевіряється лише крайня тумба — застарілий ряд ховає gap (2 панелі замість 4) | `side-panel-group-policy.mjs` ~:47 |
| medium | Gap edges завжди on, рішення Райана немає | `SIDE_PANEL_API.md` описує як фінал |
| medium | У `reconcileGroupPanels` `_executeProductRules` до `composition.addProduct` — зворотно до базового lifecycle `addon-state-machine.mjs:329-334` | |
| low | План міряється щоциклу з `waitForFrames(2)`; `RuleSidePanels` чекає 2 кадри на панель послідовно; hard-coded `'group-1'` у `composition-scene.mjs`; `SupportGroupId` на конфігу панелі ніхто не читає | |
| open | UF joint strip стоїть на 1 см назовні над нижчою тумбою; низ смуги на 1.3 мм вище її верху; cover нічого не вкорочує — перевірити візуально | `handoffs/uf-side-panels-implemented` |
| open | Композиція лише з UF open shelves тепер без панелей (раніше — legacy, неправильні) | |

## Відкриті питання (кому)
- **Рома (3D-арт / Config Guide):** UD рядок 193 vs 176-179; UF StretchZ −0.1 при depth 45 — навмисно?; joint-пари 88+50, 85+53, 88+85; depth stretch на joint; Tricot `Tricot_Sink_Point` / −0.16 не звірено з шаблоном; значення stretch для висот, яких немає в таблицях ULH.
- **Райан:** gap edges — так/ні; SP1 — одна чи дві панелі на стек і SKU для сумарної висоти; X8 — неврівняні торці; partial face (50.5 біля 46, 35 біля 25) — лишати голий торець чи блокувати; per-end чи глобальний перемикач; чи потрібні панелі Class/Mako; чи стільниця/плінтус подовжуються під end-панель.
- **Олег / Назар (UI, pricing):** joint strip — окрема позиція в ціні?; UI має перелічувати 0..N панелей на сторону, id змінюються; чи `features.sidePanelSelection` переживає export/import пресетів.
- **Андрій:** joint гейтиться вибором сторони, в яку дивиться торець, чи завжди при різних висотах; чи UF open shelves отримують `sidePanelSupport`.

## Dev-panel: тест-кейси гайду
Секція «Side panels» тестової панелі (`Scripts/dev-panel/data/side-panel-guide.mjs`): група Handle (поля колекції на всіх / лівій / правій / вибраній тумбі), per-panel очікуваний тип ✓/✗, 12 кейсів гайду + 4 UF (88+53, 82→85+50, 88+50 unknown pair, одна тумба з обома сторонами) + Tricot позначено implemented. Пресети `ulh-stack-*`, UF `88+53` тощо — див. `playcanvas-testing.md` §2.
