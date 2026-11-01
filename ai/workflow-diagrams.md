# Схеми AI workflow Hastings UI

Підтримуване візуальне пояснення [спільного workflow](workflow.md).
Власником правил залишається `ai/workflow.md`; процедури належать канонічним skills,
а межі дій задають вбудовані дозволи рантаймів (`.claude/settings*.json`, sandbox Codex).

## Цикл реалізації

Цей цикл стосується задач зі зміною коду Hastings UI.

```mermaid
flowchart TD
    A["1 · Preflight<br/>Контекст, дозволи, Git-стан"]
    B["2 · Intake<br/>Мета, джерела, критерії прийняття"]
    C["3 · Plan<br/>Основний skill, кроки та спосіб перевірки"]
    D["4 · Execute<br/>Зміни в узгоджених межах"]
    E["5 · Verify<br/>Тести, браузер, SKU/price oracle"]
    F{"Результат перевірки"}
    G["6 · Review<br/>Diff і покриття вимог<br/>Незалежний reviewer для високого ризику"]
    H["7 · Docs sync<br/>Оновити документацію та знання"]
    I["8 · Handoff<br/>Результат, докази, обмеження"]
    J["Зафіксувати прогалину<br/>BLOCKED / UNKNOWN / NOT_RUN"]

    A --> B --> C --> D --> E --> F
    F -->|PASS| G
    F -->|FAIL| D
    F -->|Немає даних або перевірки| J
    J --> I
    G -->|Є зауваження| D
    G -->|Прийнято| H --> I
    D -.->|Дві невдалі спроби: переглянути план| C
```

Для планування результатом є план; для рев’ю — висновки без редагування коду.
Невідому причину помилки спочатку досліджує `local-debug-root-cause`.
Один наявний план або checkpoint зберігає стан задачі; SDD підключається за потреби.

`BLOCKED`, `UNKNOWN` і `NOT_RUN` залишають критерій непідтвердженим: handoff фіксує
прогалину та відповідального, а не означає успішне завершення. Зелені тести не
замінюють потрібної браузерної перевірки; очікувані SKU й ціни потребують незалежного oracle.

## Адаптери та дозволи

Claude та Codex використовують спільні правила й процедури.

```mermaid
flowchart TD
    C["Claude"] --> CA["CLAUDE.md<br/>та symlink .claude/skills"]
    X["Codex"] --> XA["AGENTS.md<br/>та canonical skills"]

    CA --> R["Спільні правила<br/>AGENTS.md + AGENTS.local.md"]
    XA --> R
    R --> W["Спільний цикл<br/>ai/workflow.md"]
    W --> S["Процедури<br/>.agents/skills"]

    C -.-> P1["permissions.deny / ask<br/>.claude/settings*.json + /sandbox"]
    X -.-> P2["sandbox workspace-write<br/>.codex/rules"]
```

Дозволи рантаймів — єдиний жорсткий шар: текст у `AGENTS.md` — інструкція, правило в
`permissions.deny` чи sandbox — заборона, яку модель не може проігнорувати.

Поточний режим пілоту — без commit, push і deploy. Handoff не запускає доставку.
