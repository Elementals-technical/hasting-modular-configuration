---
name: hasting-countertop
description: Роутер знань про стільницю (countertop, Top_Solid, Cabinet_Cover) у PlayCanvas і UI: позиціонування, offset/remote, drag-and-drop, moveSink/liftSink/landSink, TRAP_KEEPOUT, RuleCountertopLayout, pricing. Do not use for side panels or dividers.
---

# Hasting: стільниця — маршрутизатор

Деталей тут немає навмисно. Спершу визнач **scope**, потім — **підобласть**, і читай лише це.

## Де лежать довідники
1. Підключене репо → `.agents/skills/hasting-countertop/references/<файл>` у корені репо (`.claude/skills/hasting-countertop` — symlink на нього) (PlayCanvas: `hasting-modular-playcanvas-flow-git/src/`, UI: `UI-APP-config-react/`; на Mac — через `device_bash` + `cat`).
2. Інакше — документи проєкту «Hasting Modular - PlayCanvas Rules»: `project_read .agents/skills/hasting-countertop/references/<файл>`.

## Крок 1. Scope

| Scope | Ознаки задачі | Середовище |
|---|---|---|
| `ui` | Position / Drag & Drop у React, chip/stepper/ручки, режим за товщиною, `useSinkLanding`, `countertopRuntimeState`, pricing довжини/каверу, `sceneLayout`, vitest | `UI-APP-config-react/`, `src/features/countertopPlacement`, `configuratorApi` |
| `playcanvas` | CT не там / не тієї довжини / червона / не тягнеться / мийка не туди, `RuleCountertop*`, adapter, `countertop.manipulable`, кавер, `node --test`, sweep | `hasting-modular-playcanvas-flow-git/src/`, `Scripts/app-configuration/domain/countertop` |
| `both` | зміна того, що UI шле або читає (`getState`, події, коди), `moveSink/liftSink/landSink`, нові причини валідації, ціна за те, чого UI не бачить, «перевір там і там», симптом в UI з причиною в сцені | обидва репо або задача названа «3D + UI» |

## Крок 2. Підобласть (лише для `playcanvas` і `both`)

| Підобласть | Ознаки | Файл |
|---|---|---|
| `base` | CT у спокої не там по X/Y або не тієї довжини; отвір мийки; кавер / `CABINET_COVER_RESTORE_FAILED`; `SupportGroupId`, таблиця колекцій, нова колекція; API-методи, `getState`, коди | `playcanvas-base.md` |
| `positioning` | offset / remote / standard, `SpatialOffsetM`, `CountertopLengthM`, `CountertopSinkShiftM`, ресайз з торця, restore/rebase, `_anchorRemoteOffset`, мийка їде за CT / повертається в SB, `resetOffset`, vertical lock | `playcanvas-positioning.md` |
| `validation` | поза червона / snap back / `COUNTERTOP_POSE_INVALID`, `TRAP_KEEPOUT`, `SINK_BASE_NOT_COVERED`, `BASIN_EDGE_TOO_CLOSE`, `SINK_LANDING_*`, `COUNTERTOP_BELOW_COVER`, колізія vs валідність, `dragGuard` | `playcanvas-validation.md` |
| `dnd` | не тягнеться, снап не туди, runaway, ручки/`lengthAtPointer`/`previewLength`, `canDrag`, `finish`, `whenSettled`/`rebase`, колізійні профілі, `spatial-manipulation` | `playcanvas-dnd.md` |
| `testing` | перед комітом, відтворити кейс, знайти тест, sweep/goldens, dev-panel, яким docs вірити | `playcanvas-testing.md` (за потреби до будь-якої підобласті) |

Одна задача — зазвичай одна підобласть, зрідка дві (напр. `positioning` + `validation` для «мийка повертається в SB не тоді»). Не читай усі чотири.

## Крок 3. Що читати

| Scope | Обов'язково | За потреби |
|---|---|---|
| будь-який | `contract.md` — терміни, методи й події, повна форма `getState`, таблиця кодів із серйозністю, що 3D вирішує сам / що UI припускає, розриви, інваріанти на стику (≈90 рядків) | `rules-and-decisions.md` — правила клієнта R*/B1/B2, маніфест HR-CT/HR-CV зі статусами, рішення Андрія, всі числа в одному місці, відомі баги, відкриті питання (кому) — коли задача про правило, число або «як має бути» |
| `ui` | `ui.md` (починай з «Сценарії» та «Інваріанти UI») | — |
| `playcanvas` | файл підобласті з Кроку 2 (починай з його шапки «Сценарії / Інваріанти») | `playcanvas-testing.md` |
| `both` | `contract.md` + `ui.md` + файл підобласті; у кожному спершу шапка | `rules-and-decisions.md`, `playcanvas-testing.md` |

Факт про сусідній шар, якого бракує, спочатку шукай у `contract.md`; немає — переходь у `both`.

## Крок 4. Правила для будь-якого scope
- Стандартну позу й авто-довжину пише лише `RuleCountertopLayout`; drag володіє лише `SpatialOffsetM`. Режими Standard/Offset/Remote — поняття клієнта й UI (за товщиною); у 3D класифікатора режимів **немає**, є `attached/moved`, `verticalLocked`, resting (|y| ≤ 1 см).
- 3D звітує, UI комітить: 3D ніколи не змінює тип тумби; SB↔SC робить UI через `cabinets.moveSink/liftSink/landSink`, id при цьому нові.
- Колізія — лише warning; позу блокують trap / coverage / landing / below-cover. Авторитет для червоного — кадр overlay.
- Зміни лишати в stage, коміт і push — лише за командою Андрія. Нові коди, поля `getState`, події або ціна — узгодити з Олегом (UI) і Назаром (pricing) до коміту. Розбіжність із Config/Positioning-документом клієнта — питання Райану (`rules-and-decisions.md` → «Відкриті питання»).
- Перед коміт-пропозицією: `node --test tests/node/countertop-*.test.mjs` (136/136) + `node tests/sweep-report.mjs` (0 порушень) + повний прогін проти базової лінії в `playcanvas-testing.md`.

Стан довідників звірено 2026-10-20 (PlayCanvas `feture/part-2` @ `5310d1f`, UI `package-3/fix` @ `91257118`); номери рядків — на той момент.
