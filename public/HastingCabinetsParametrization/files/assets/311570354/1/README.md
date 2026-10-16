# Пресети: формати, методи API, стара і нова логіка

Пресет — документ, з якого будується сцена: prebuilt-модель у UI, тестова сцена в dev-панелі, збережена конфігурація покупця.
Ця тека вирішує одне питання: **у якому форматі документ і хто його читає**. Геометрію рядів і колон тут не рахують —
вона лишається в `cabinet-placement/compact-preset.mjs` (ряди в см → exact) і `portable-preset.mjs` (exact → сцена).

## Три рівні пресетів

| Рівень | Формат (`id`) | Як виглядає | Позиції | Колекції | Чим вантажиться |
|---|---|---|---|---|---|
| **list** | `preset-products` | масив `[{ name, Width, … }]` | ні — один ряд зліва направо | усі | `ConfiguratorAPI.presetProducts(items, globalConfig)` |
| **rows** | `ulh-compact-v1` | `{ format, collection, shared, rows: [{ elevation, offsetX, products }], top }`, см | з ширин, `offsetX`, `elevation` | ULH (і UD без колон) | `composition.importPreset` (або старий `importCompactPreset`) |
| **rows** | `urban-compact-v2` | як v1, але елемент ряду може бути колоною `{ top, bottom: { offsetX } }` | те саме + колони | UD | `composition.importPreset` (або старий `importCompactPreset`) |
| **exact** | `exact-v2` | `{ presetSchemaVersion: 2, presetLayout: { layoutMode: 'exact', … } }`, метри | точні, відносно anchor | модульні (ULH, UD) | `composition.importPreset` |

Повний контракт rows-формату з прикладами — шапка `cabinet-placement/compact-preset.mjs`. Exact — `portable-preset.mjs`.

### Який рівень для якої колекції

| Колекція | Prebuilt-моделі в UI | Збереження сцени |
|---|---|---|
| ULH | rows (`ulh-compact-v1`) для кількох рядів / стеків; list для одного ряду | exact |
| UD | rows (`urban-compact-v2`) для колон / Multi-Level; list для одного ряду | exact |
| USH, Class, Mako, UF, Tricot, Lame | list | legacy (Redux + `presetProducts`) — `importPreset` їх не приймає |

Правило: rows і exact мають сенс лише там, де бувають кілька рядів, стеки або колони, тобто в модульних колекціях
(`cabinet-placement/modular-collections.mjs`). Однорядним колекціям достатньо list.

## Методи API

### Нова логіка (рекомендовано)

| Метод | Що приймає | Що робить |
|---|---|---|
| `composition.importPreset({ …command, preset, anchorPositionM? })` | документ **будь-якого** зареєстрованого формату рівня rows або exact | реєстр визначає формат → rows розгортається в exact → сцена замінюється. List → помилка `PRESET_LEVEL_NOT_IMPORTABLE` (його вантажить `presetProducts`) |
| `composition.exportPreset({ …scope, anchorCabinetId?, format? })` | без `format` — як раніше; з `format: 'ulh-compact-v1' \| 'urban-compact-v2' \| 'exact-v2'` | сцена → документ у вибраному форматі. `preset-products` → `PRESET_FORMAT_NOT_EXPORTABLE` |

Клієнт (`bridge/clients/cabinet-api-client.mjs`) сам підставляє scope, `requestId` і `expectedCompositionRevision`:

```js
await client.importPreset(document);                    // rows або exact — формат визначиться сам
await client.exportPreset(undefined, 'urban-compact-v2'); // сцена UD → компактний документ з колонами
await client.exportPreset();                            // exact, як і раніше
```

### Стара логіка (працює, не ламаємо)

| Метод | Статус | Різниця з новим |
|---|---|---|
| `ConfiguratorAPI.presetProducts(items, globalConfig)` | основний для рівня list | без змін; реєстр його не чіпає |
| `composition.importCompactPreset({ …command, preset })` | deprecated, лишається для UI і dev-панелі | той самий шлях, що `importPreset`, але приймає лише rows; інше → `PRESET_INVALID` |
| `composition.exportCompactPreset({ …scope, anchorCabinetId? })` | лишається | сам обирає v1 (без колон) або v2 (є колони); `exportPreset({ format })` — те саме з явним вибором |
| `composition.importPreset` з exact-документом | без змін | так UI відновлює збережену сцену (`sceneLayout.ts`) |

**Для UI нічого не змінилось:** ті самі методи, аргументи, відповіді й коди помилок. Перейти на один `importPreset`
для всіх rows/exact-пресетів можна окремою задачею.

## Що відбувається при `importPreset`

1. `DEFAULT_PRESET_FORMATS.resolve(document)` — рівно один формат має впізнати документ.
   Ніхто не впізнав → документ іде в exact-завантажувач як раніше і падає з його кодом (`PRESET_INVALID_DOCUMENT`, …).
2. Рівень `list` → `PRESET_LEVEL_NOT_IMPORTABLE`.
3. Рівень `rows` → `expandRowsPreset` (`bridge/plugins/cabinet-local-runtime.mjs`):
   колекція з `preset.collection` або з першої тумби → `format.expand(document, context)` → перевірка
   `CabinetColor` для кавера (`PRESET_MISSING_CABINET_COLOR`) → exact.
4. `importExact` → `instantiateExactPreset` → коміт сцени (rollback при помилці правил, кавера, стільниці).

Як формат впізнає документ:
- `preset-products` — непорожній масив об'єктів з `name`;
- `ulh-compact-v1` — `format: 'ulh-compact-v1'`, **або** `rows` без `format` і без колон;
- `urban-compact-v2` — `format: 'urban-compact-v2'`, **або** `rows` без `format`, де є колона;
- `exact-v2` — `presetSchemaVersion: 2` і `presetLayout.layoutMode: 'exact'`.

## Коди помилок

| Код | Коли |
|---|---|
| `PRESET_FORMAT_UNKNOWN` | жоден формат не впізнав документ (у `importPreset` — fallback у exact, див. вище) |
| `PRESET_FORMAT_AMBIGUOUS` | два формати впізнали документ — баг у їх `matches` |
| `PRESET_LEVEL_NOT_IMPORTABLE` | list передали в `importPreset` |
| `PRESET_FORMAT_NOT_EXPORTABLE` | `exportPreset({ format: 'preset-products' })` |
| `PRESET_NOT_COMPACTABLE` | експорт у `ulh-compact-v1`, а в сцені є колони — проси `urban-compact-v2` |
| `PRESET_INVALID` | компактний документ зламаний (немає rows, невалідний `offsetX` тощо) |
| `PRESET_COLLECTION_UNSUPPORTED` | колекцію rows-документа не знайдено серед модульних |
| `PRESET_MISSING_CABINET_COLOR` | кавер увімкнено, а в тумби немає `CabinetColor` |
| `PRESET_COLLECTION_MISMATCH`, `PRESET_CHOICE_NOT_PORTABLE`, `PRESET_INVALID_*` | exact-документ не підходить колекції / каталогу (`portable-preset.mjs`) |

## Зворотна сумісність і нові версії

- Збережені документи не мігруються: кожна версія формату лишається зареєстрованою під своїм `id`.
- Нова версія = новий файл у `formats/` з новим `id`; старий запис лишається, його `expand` дає поточний exact —
  старі пресети відкриваються без ланцюжка міграцій.
- Не зберігай у пресеті runtime-ID продуктів чи імена entity — лише каталожні ключі (`portable-preset.mjs`).

## Як додати формат

1. `formats/<format-id>.mjs`: `export const X = defineFormat({ id, level, matches, expand?, compact? })`.
   - `matches(document)` не кидає і не перетинається з іншими форматами;
   - `expand` обов'язковий для rows і exact; `compact` — якщо формат можна експортувати.
2. Додай запис у `default-preset-formats.mjs`.
3. Додай приклад у `Scripts/dev-panel/data/collection-presets.mjs` (або UD-пресети) — він автоматично потрапить
   у `tests/node/preset-format-goldens.test.mjs`. Знімок оновлюється: `UPDATE_PRESET_GOLDENS=1 node --test tests/node/preset-format-goldens.test.mjs`.

## Тести

- `tests/node/preset-format-goldens.test.mjs` — кожен пресет dev-панелі → свій формат; rows → збережений знімок exact;
  rows → compact → expand дає те саме.
- `tests/node/preset-import-entry.test.mjs` — `importPreset` = `importCompactPreset` для rows; list відхиляється;
  `exportPreset({ format })`.
- Старі: `tests/node/compact-preset*.test.mjs`, `cabinet-portable-preset*.test.mjs`.
