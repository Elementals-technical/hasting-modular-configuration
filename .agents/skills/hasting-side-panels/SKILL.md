---
name: hasting-side-panels
description: Роутер знань про бокові панелі (side panels) у PlayCanvas і UI: RuleSidePanels, профілі ulh/uf/tricot, SidePanelLeft/Right, NoG/UpperG/CenterG/DoubleG, URSP SKU, pricing. Do not use for countertop or dividers.
---

# Hasting: side panels — маршрутизатор

Скіл навмисно не тримає деталей у цьому файлі. Спершу визнач **scope**, потім читай лише свою частину.

## Де лежать довідники
1. Підключене репо → `.agents/skills/hasting-side-panels/references/<файл>` у корені репо (`.claude/skills/hasting-side-panels` — symlink на нього; PlayCanvas: `hasting-modular-playcanvas-flow-git/src/`, UI: `UI-APP-config-react/`; на Mac — через `device_bash` + `cat`).
2. Інакше — документи проєкту «Hasting Modular - PlayCanvas Rules»: `project_read .agents/skills/hasting-side-panels/references/<файл>`.
Файли: `contract.md`, `ui.md`, `playcanvas.md`, `playcanvas-testing.md`, `rules-by-collection.md`.

## Крок 1. Визнач scope

| Scope | Ознаки задачі | Ознаки середовища |
|---|---|---|
| `ui` | контрол/сітка SidePanels, Redux `SidePanelLeft/Right`, groove, SKU/URSP, pricing, `product-profile.json`, `ui.json`, пресети UI, vitest, React/TS | cwd або шляхи в `UI-APP-config-react/`, `src/features/sidePanel`, `src/shared/lib/{sku,pricing}` |
| `playcanvas` | панель не там / не того розміру / не того типу в сцені, `RuleSidePanels`, addon, профіль, policy, `sidePanelSupport`, шаблон `*_SidePanel`, стільниця +1 см, towel bar, колізії, dev-panel, `node --test` | cwd або шляхи в `hasting-modular-playcanvas-flow-git/src/`, `Scripts/app-configuration/` |
| `both` | зміна того, що UI шле або читає з 3D; кількість/тип/id панелей; ціна за панелі, яких UI не бачить; «перевір і там, і там»; симптом в UI, причина, ймовірно, в сцені (або навпаки); нова колекція наскрізь | обидва репо в сесії, або задача названа «3D + UI» |

Сумнів між `ui` і `playcanvas` → почни з того репо, де симптом; якщо причина виявляється на іншому боці — підвантаж `contract.md` (він уже прочитаний) і лише потім другий довідник. Не відкривай обидва довідники «про всяк випадок».

## Крок 2. Що читати

| Scope | Обов'язково | За потреби |
|---|---|---|
| будь-який | `references/contract.md` — терміни, що UI шле / читає, що 3D робить, що UI припускає, розриви контракту, інваріанти на стику (≈50 рядків) | `references/rules-by-collection.md` — коли задача про правила колекції, Config Guide, тип панелі, відкриті питання Ромі/Райану |
| `ui` | `references/ui.md` — сценарії, інваріанти UI, карта файлів, Redux, команди, SKU/pricing, пресети, правила, stale-місця, як тестувати | — |
| `playcanvas` | `references/playcanvas.md` — сценарії, інваріанти 3D, карта файлів, data-flow 15 кроків, профілі, таблиці policy, legacy, залежні модулі, snapshot/rehydrate, пастки | `references/playcanvas-testing.md` — тести по файлах, базова лінія, dev-panel (15 кейсів гайду, пресети), docs у репо, live-перевірка |
| `both` | `contract.md` + обидва довідники; у кожному спершу розділи «Робочі сценарії» та «Інваріанти», решту — за посиланнями з них | `playcanvas-testing.md`, `rules-by-collection.md` |

Факт про «сусідній» шар, якого бракує в scope `ui` або `playcanvas`, спочатку шукай у `contract.md` (там є мінімум для кожного боку). Його немає → це і є сигнал перейти в `both`.

## Крок 3. Правила для будь-якого scope
- Тип панелі визначає 3D (Handle / висота корпусу), не запит UI; кількість та id панелей — власність 3D; UI живе в моделі «рівно 2» — це відоме розходження, не баг одного репо.
- Один патч `{ SidePanel, SidePanelSide }` на виклик `setConfigBatch`; bridge завжди повертає `true`.
- Зміни лишати в stage, коміт і push — лише за командою Андрія. Зміна контракту (що шлеться / читається / рахується в ціні) — узгодити з Олегом (UI) і Назаром (pricing) до коміту.
- Розбіжність коду з Config Guide — питання Ромі/Райану (`rules-by-collection.md` → «Відкриті питання»), не самостійне рішення.

Стан довідників звірено 2026-10-19 (PlayCanvas `feture/part-2` @ `5310d1f`, UI `package-3/fix` @ `91257118`); хеші й номери рядків — на той момент, перед правкою перевір `git log`.
