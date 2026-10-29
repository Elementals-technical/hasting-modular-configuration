# Hastings — личный local-only слой агента

Дополняет командные [`AGENTS.md`](AGENTS.md) и [`ai/AGENTS.md`](ai/AGENTS.md); при конфликте главнее командные. Source of truth, evidence, scope, invariants, commands и Definition of done живут только там. Файл не коммитится.

## Общение

- По-русски; результат первым; факты отдельно от выводов и `unknown`.
- Разделяй: норма клиента (источник + якорь) / код / наблюдаемое в браузере / гипотеза.
- Не называй проверку пройденной без запуска; «не воспроизвелось» ≠ «исправлено».

## Маршрутизация

Один workflow на задачу из `.agents/skills/local-*` (в Claude — обёртки `.claude/skills/`):

| Задача | Workflow |
|---|---|
| Реализация, fix известной причины, UI/3D/конфигуратор | `local-implement-change` |
| Баг с неизвестной причиной, регрессия, падающий тест | `local-debug-root-cause` |
| План, дизайн, PRD/issues | `local-plan-change` |
| Утверждённый план или issue из `plans/` | `local-execute-plan` |
| Review diff/ветки/PR (read-only) | `local-review-change` |
| Guidance, skills, MCP, этот слой | `local-maintain-agent-guidance` |
| «Как устроено» | [`docs/ai/README.md`](docs/ai/README.md) → одна справка |

| Область | Читать |
|---|---|
| Код `src/**` | маршрут `ai/AGENTS.md` › Where to read more |
| Коллекция USH/ULH/Class/Mako | `skills/hastings-<id>/SKILL.md` → `docs/products/<id>.md` |
| Правило клиента, семейство | [`domain-index.md`](docs/ai/hastings/domain-index.md) → `domain-rules.csv` |
| Blast radius изменения | [`dependency-graph.md`](docs/ai/hastings/dependency-graph.md) |
| SKU, цена, summary, PDF | [`sku-price-oracle-map.md`](docs/ai/hastings/sku-price-oracle-map.md) |
| Расхождение источников | [`conflicts-and-decisions.md`](docs/ai/hastings/conflicts-and-decisions.md) |
| Браузер, UI-тест, 3D | [`browser-validation.md`](docs/ai/qa/browser-validation.md), [`ui-test-matrix.csv`](docs/ai/qa/ui-test-matrix.csv) |
| Дефект PlayCanvas/backend | [`ownership-handoff-template.md`](docs/ai/qa/handoffs/ownership-handoff-template.md) |
| Ветки, окружения, MCP | [`env/`](docs/ai/env/environment-branch-map.md), [`MCP runbook`](docs/ai/env/windows-mac-mcp-runbook.md) |
| Свежесть и доступ к источникам | [`source-ledger.csv`](docs/ai/hastings/source-ledger.csv) |

Многосессионная работа — сначала [`checkpoint.md`](docs/ai/checkpoint.md).

## Жёсткие границы

- Backend и PlayCanvas (scene, models, `public/HastingCabinetsParametrization/**`) — чужие: только чтение, диагностика, handoff. Изменение — лишь по отдельному явному разрешению.
- Без commit, push, deploy, смены веток/remote, production-данных и правок командных tracked-инструкций.
- UI read-only: перед Save/Share/Quote submit или иной записью в backend — стоп и вопрос с тем, что уйдёт. PDF можно.
- Phase 2 и старый модульный production не смешивать.
- SKU и ожидаемую цену не угадывать: нет oracle — `BLOCKED`.
- Комментарий клиента не норма без класса (`approved`/`proposed`/`superseded`/`question`/`conflicting`/`bug evidence`/`resolved unverified`/`unknown`).
- Недоступный документ не считается изученным: точный blocker и просьба о доступе.
- Секреты, cookies, приватные детали и личные пути — никогда в tracked-файлы и отчёты.

## Инструменты

- Команды репозитория — с Node 20.19+ (см. [`verified-commands.md`](docs/ai/verified-commands.md)).
- Chrome DevTools MCP (`chrome-devtools`, `--autoConnect` к Chrome пользователя) — основной браузер; Firefox DevTools MCP (`firefox-devtools`, свой профиль) — кросс-проверка. Один controller, чужие вкладки не трогать.
- Google Drive connector — только чтение; 404 ≠ «нет файла»: проверь в Chrome.
- Почту, календарь и прочие личные коннекторы для репозитория не используй.

## Definition of done — дополнения

- UI/3D/конфигуратор: браузерный acceptance gate [`ui-regression.md`](.agents/skills/local-implement-change/references/ui-regression.md).
- SKU/цена — сверка с oracle; без ожидания не `passed`.
- Отчёт: браузер, класс URL, сценарий, TC id, факт, evidence; непроверенное и почему; ревизии источников; owners отклонений.
- Learning check через `local-maintain-agent-guidance`; `checkpoint.md` в длинной работе.
