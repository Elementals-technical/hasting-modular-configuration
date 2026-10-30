# Lamè: Side Panels UI / SKU / pricing / history

Дата: 2026-10-29. [Галерея](index.html), [оточення](environment.json), [час кадрів](captures.json).

## Результат

У shared Accessories для prebuilt та custom додано None / Yes. Використано наявний side-panel command port і history wrapper. PlayCanvas source та export у цій задачі не змінювались; перевірено локально на наданому користувачем v90 export.

- Матриця: 1DW/26H та 2DW/52H, depth 52 см, NoG.
- Номінально 5 см за активну сторону. Оновлено pricing top/undertop length, guards, scene top sync і Full Dimensions; legacy fallback інших колекцій лишився 1 см.
- SKU: `VAN-LAMEV-SP/{1DW|2DW}/{GAL|GES|OXF|PIQ|PLIS}-2.0W-{10.2|20.5}H-20.5D-CAB-{LACM|LACG}-{color}`. Патерн, drawers і колір читаються з відповідної крайньої шафи в порядку сцени.
- Кожна активна сторона має pricing line quantity 1. Обидві активні — сумарно 2 одиниці, за прямим рішенням користувача від 2026-10-29.
- Summary обох потоків показує відповідні SKU, кількість і price line; повторні рядки не дублюються через uncovered-lines fallback.
- Перемикання й відновлення використовують існуючі `useHistoryStep`, `applyGroove`, `restoreSidePanelState`.

## Oracle та джерела

Primary: data repo, Lame/input/Lame Vanities - SKUs + Pricing.xlsx, CabinetPricing rows 121–131, SKU Curation U10/Y10. SHA-256 workbook та export в environment.json. Норма: R-LAME-SP-001/002, WebGL Logic P0245–P0247, ревізія ab178e09; колір/патерн та зовнішнє положення — підтверджені правила. Рішення щодо quantity — користувач у поточній сесії. Точне зовнішнє позиціонування погоджене раніше; реалізація належить canonical 3D.

Live public GET pricing-v2/resolve, без авторизаційних параметрів:

| Панель | Unit price | Доказ |
| --- | ---: | --- |
| 1DW Oxford, Fumo 401 MT | 2285 | [API](evidence/price-1dw-mt.json) |
| 2DW Oxford, Fumo 401 MT | 3345 | [API](evidence/price-2dw-mt.json) |
| 2DW Oxford, Fumo 401 GL | 3550 | [API](evidence/price-2dw-gl.json) |

Resolver VAN/matrix, matrix 556, colorMap 495, error null. Ці значення ціни за одиницю підтверджені API; множник за кожну панель визначений користувачем. Загальний UI total включає також зміну ціни довшої стільниці; його не слід трактувати як ціну самих панелей.

## Browser TCs

IAB, browser 2, agent-owned tab 17; localhost:5173, 1280 × 720. Client viewer у цьому UI проході не відкривався. Не використовувались приховані API для вибору чи перевірки сцени.

- **TC-SP-01 PASS**: Preset 1 · 1DW, 60 × 26 × 52 см. 60 → 70 см; $4,477 → $9,178. Панелі й стільниця видимі. Дві панелі 1DW: 2 × $2,285; різниця загальної ціни також включає подовження стільниці. [Кадри](index.html#TC-SP-01).
- **TC-SP-02 PASS**: Preset 1 · Undo / Redo. Undo: None, 60 см, $4,477. Redo: Yes, 70 см, $9,178. Остаточні значення після синхронізації; проміжну ціну не приймали за результат. [Кадри](index.html#TC-SP-02).
- **TC-SP-03 PASS**: Preset 13 · 2 × 60 см, 2DW. 120 → 130 см; $11,366 → $18,187. Панелі на зовнішніх торцях; ціна двох 2DW Matte панелей: 2 × $3,345 = $6,690, плюс подовження стільниці. [Кадри](index.html#TC-SP-03).
- **TC-SP-04 PASS**: Preset 13 · матеріал і патерн. UI підтвердив Latte 417 GL та Plisse. Модель залишилась із двома шафами, двома раковинами та шириною 130 см. Підсумкова ціна $19,157. У другому повному кадрі частину панелі UI перекриває навігація; модель видима. [Кадри](index.html#TC-SP-04).
- **TC-SP-05 PASS**: Custom із Preset 13. None: 120 см і $11,366. Yes: 130 см і $18,187. Знімки зроблені в порядку on → off; у галереї розташовано off / on. Customize переносить рецепт і починає стан add-ons заново — наявний контракт маршруту. [Кадри](index.html#TC-SP-05).
- **TC-SP-06 PASS**: Custom · одна права панель. Одна права панель: 125 см і $14,776. Undo повертає None, 120 см і $11,366. Ціна панелі — одна одиниця SKU 2DW Matte, а не пара. [Кадри](index.html#TC-SP-06).
- **TC-SP-07 PASS**: Custom · Redo правої панелі. Redo повертає саме праву панель, 125 см і $14,776. У console є warning про пропущені snapshot values; панель, геометрія та підсумкова ціна відновлені. Відновлення всіх інших атрибутів окремо не приймалося. [Кадри](index.html#TC-SP-07).

## Автоматична перевірка

- Цільовий прогін: 22 файли, **278 PASS**. SidePanel rules/service/port, Lamè package, UI, history, width overlay, collection boundaries/reason codes та Tricot regression. [Лог](evidence/tests-focused.txt).
- Ширший adapter прогін: 549 PASS, 1 FAIL, 1 expected fail, 3 todo. FAIL: Urban Duplex model 29 очікує depth 50, current preset gives 50.5. Код та дані цього сценарію цією задачею не змінювалися. [Лог](evidence/tests-adapter-wide.txt).
- Повний pricing + useCountertopLength: 273 PASS, 1 FAIL, 8 skipped. FAIL: Class defaults test expects porcelain334/side433, current profile provides porcelain332/side417. Class profile не змінювався цією задачею. [Лог](evidence/tests-pricing.txt).
- Нові тести SKU покривають усі 5 патернів × 2 drawer styles × Matte/Gloss, окремі кольори двох торців у переставленому порядку, 0/1/2 активні сторони, unknown pattern та невідповідність selection/activation. History test проходить реальними applyGroove/capture/restore шляхами із scene stand-ins.
- `npm run build` — PASS, включаючи TypeScript. Vite warnings: existing large chunk та annotations у zod. [Лог](evidence/build.txt).
- ESLint усіх змінених TS/TSX: 15 errors і 1 warning у legacy PlayCanvasIntegration; HEAD того самого файла має ті самі 15 errors/1 warning. Нових lint violations у змінених рядках не виявлено. [Current](evidence/lint-current.txt), [HEAD](evidence/lint-head-baseline.txt).
- Prettier цільових нових/відформатованих файлів — PASS; у legacy файлах форматувались лише зачеплені блоки. `git diff --check` — PASS. [Лог](evidence/format.txt).

Не складати кількості PASS різних прогонів: набори перекриваються.

## Обмеження та не виконано

- **NOT_RUN**: live Summary rendering, Quote submit, Save/Share, PDF. Summary автоматично POST-ить configuration; поточний дозвіл не охоплює backend write. Правило: docs/ai/qa/browser-validation.md, Read-only rules; AGENTS.local.md. Рядки комерційного результату перевірені як дані та обчислення, а не відправлений quote.
- **PARTIAL**: повна історія всіх інших атрибутів. Console після custom undo/redo містить warning `[History] The scene did not take every value of the snapshot`; інтерфейс логів не розкриває список skipped values. Панелі, кількість, ширина та фінальна ціна після restore підтверджені знімками; warning не приховується й не видається за повне acceptance усієї сцени.
- **NOT_RUN**: повний каталог 44 пресетів, всі кольори, усі add/remove/reorder комбінації, екстремальні countertop limits, активний undertop при одній панелі, save/reload restore та інші браузери. Це перевірка доданої UI-функції, не повторний повний аудит Lamè.
- Матеріал оцінювався за exact UI selection + SKU та зміною потрібних поверхонь; піксельна схожість сама по собі не вважалась oracle.
- HMR після source/JSON правок скидав тимчасовий state. Такі незавершені спроби не включені до PASS; фінальні контрольні проходи починалися через preset URL. Baseline-off.png знятий уже після UI реалізації й не є доказом до зміни.
- Під час restore короткочасно з'являлась проміжна ціна до завершення countertop sync; зафіксовано остаточну ціну після осідання сцени.

## Межі змін

Змінені: 4 JSON Lamè, спільний optional panel-width/variant schema, SKU/pricing, залежні width consumers, обидва Summary, UI/logic regression tests та документація. Presets.json, canonical PlayCanvas, export і backend не редагувались. Незалежні user-owned зміни збережені. Реалізація збережена локальним комітом `3748c10a`; цей звіт і докази підготовлено окремим docs-комітом. Push/deploy не виконувались.

Learning check: рішення quantity та актуальний контракт записані у provenance профілю і docs/side-panel-logic.md з посиланнями на цей звіт; нових особистих workflow правил не додавалось.
