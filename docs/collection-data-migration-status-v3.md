# Collection data migration status v3

Цей документ продовжує [Collection data migration status v2](./collection-data-migration-status-v2.md) і [Collection data migration status v1](./collection-data-migration-status-v1.md) після впровадження єдиного readiness gate для конфігуратора. V1 залишається початковим baseline, v2 описує інтеграцію даних Developers B, C та I, а v3 є актуальним контрактом для життєвого циклу active collection і доступу production-компонентів до готових даних.

Міграцію hardcoded Configurator/DataTable consumers завершено в [Collection data migration status v4](./collection-data-migration-status-v4.md).

## Що змінилося

Prebuilt і Custom тепер монтуються лише після того, як колекція завантажилася, пройшла валідацію та надала `catalog.configurator`. Під час завантаження весь shell замінюється повноекранним loading-станом. Невідома колекція, помилка джерела, помилка валідації або відсутній configurator catalog показують контрольований error-стан; Player, сторінки, sidebars та їхні запити у цей момент не запускаються.

Загальна manifest schema не вимагає configurator source. Це дозволяє мати test fixtures і пакети для інших продуктів без такого джерела. Вимога `catalog.configurator` належить саме shell цього конфігуратора і перевіряється readiness gate.

Маршрути `/restore` та `/ar-download` залишаються поза collection provider і readiness gate. Restore спочатку визначає identity збереженої конфігурації, а потім переходить у gated configurator route.

## Публічний API для компонентів

Production-компоненти під gate отримують лише готові дані:

```ts
const collection = useActiveCollection();

const configurator = useActiveCollection(
  (collection) => collection.catalog.configurator,
);
```

Для цього API не потрібно й не слід писати `collection.status === "ready"`. Тип `ReadyCollectionData` гарантує `catalog.configurator`; інші каталоги залишаються optional відповідно до manifest і контракту конкретної feature.

Повний lifecycle доступний окремо:

```ts
const collectionState = useActiveCollectionState();
```

`useActiveCollectionState()` призначений для collection provider, readiness gate, `CollectionStateBridge`, `RuntimeBindingsBridge` та їхніх тестів. Звичайні сторінки, hooks і UI-компоненти не повинні обробляти `resolving`, `loading` або `error` локально. Виклик `useActiveCollection()` поза ready provider є помилкою композиції та кидає зрозумілий invariant error.

Мігровано production consumers, які вже читали active collection: flow redirect, presets, navigation, customization sections, countertop rules, restore integration, model defaults, cabinet builder і PlayCanvas customization selection. Пошук у production source залишає lifecycle-перевірки лише у двох bridges; readiness gate і provider також законно працюють із повним lifecycle.

## Незмінна identity сесії

`collectionId` зчитується один раз під час старту configurator session. Його початкова присутність і значення є частиною identity:

- URL без `collectionId` запускає implicit default session і має залишатися без цього параметра;
- explicit `collectionId` має залишатися присутнім із тим самим значенням;
- зміна, додавання, видалення або очищення `collectionId` через client-side navigation блокує shell екраном `Restart required`;
- зміни інших query parameters, route або hash не перезавантажують active collection;
- перехід на іншу колекцію виконується лише full-page navigation і створює нову сесію.

`Retry` повторює повний pipeline для тієї самої зафіксованої identity без reload сторінки. Старі асинхронні відповіді не можуть замінити результат нової спроби. `Open default collection` доступна лише для explicit non-default identity, прибирає тільки `collectionId`, зберігає path, інші query parameters і hash та запускає нову сесію через full-page navigation.

## Що ця міграція не завершила

Readiness gate вирішує життєвий цикл і безпечний доступ до active collection, але не робить усі product features collection-driven.

У production досі є 15 місць із власними запитами до Configurator `4` та/або DataTable `438`. До них належать сторінки Prebuilt і Custom, summary, `RightCabinetStyleSidebar`, `SwatchOrder`, `PlayCanvasIntegration` та `usePriceCalculation`. Повний перелік і ownership наведені у розділі [Production consumers, які ще треба мігрувати](./collection-data-migration-status-v2.md#production-consumers-які-ще-треба-мігрувати). Ці споживачі мають окремо перейти на `catalog.configurator`, `catalog.countertops` та collection pricing contract; readiness task не змінював їхні product queries або runtime semantics.

`urban-low-height` і `class` зареєстровані та проходять shell gate, але залишаються partial collections. Вони не мають presets, ProductProfile, runtime bindings, cabinet SKU mappings і collection-specific pricing data. UI чесно показує відсутність preset compositions. Відомі межі та потрібні inputs зафіксовані у [Urban Low Height and Class readiness](./urban-low-height-class-readiness.md).

Не виконано browser acceptance для реальної declared-source failure та повного PlayCanvas command/readback flow. Source failure, retry, stale-response protection і missing-configurator capability покриті автоматизованими тестами; реальна scene acceptance залишається роботою відповідних B/C/I/D вертикалей.

## Перевірка

Стан на 16.09.2026, Node `22.18.0`:

| Перевірка | Результат |
| --- | --- |
| Vitest | 82/82 files, 849/849 tests passed |
| TypeScript (`npm run tsc`) | Passed |
| Production build (`npm run build`) | Passed; залишилися інформаційні Rollup/Zod і chunk-size warnings |
| Repository-wide lint | Не зелений через baseline: 102 errors і 5 warnings; нових помилок від цієї міграції не додано |
| Production lifecycle search | Active-collection status checks залишилися лише у `CollectionStateBridge` та `RuntimeBindingsBridge` |

Headless Chrome smoke проти production preview:

| Сценарій | Фактичний результат |
| --- | --- |
| `/prebuilt/model` | implicit default USH відкрився з Urban Standard presets |
| `?collectionId=urban-standard-height` | explicit USH відкрився з Urban Standard presets |
| `?collectionId=urban-low-height` | відкрився Urban Low Height UI; показано відсутність presets |
| `?collectionId=class` | відкрився Class UI; показано відсутність presets |
| `?collectionId=unknown` | shell заблоковано екраном `Collection unavailable`; доступні `Retry` і `Open default collection` |
| Retry unknown identity | pipeline повторився для того самого URL та повернув контрольований unknown-collection error |
| Open default collection | прибрано лише `collectionId`; `campaign=smoke`, route і hash збережено; відкрився USH |
| Client-side identity change | shell заблоковано екраном `Restart required` із дією `Restart configurator` |

У цьому checkout системний Node 18 не запускає jsdom workers через ESM dependency, тому перевірки потрібно виконувати на Node 22.18 або суміснішій новішій версії.

## Правила для наступних змін

Новий production consumer має читати готову колекцію через `useActiveCollection()` або selector form. Lifecycle hook використовується лише там, де компонент справді керує інфраструктурним станом чи очищенням опублікованих даних. Відсутній optional catalog обробляється на рівні feature capability; відсутній shell configurator уже обробляє загальний gate.

Колекцію не можна перемикати в межах активної сесії. Посилання на іншу колекцію має виконувати повну browser navigation. Додавання нового collection package не означає feature completeness: окремо перевіряються declared sources, presets, ProductProfile, bindings, SKU/pricing data та реальна browser/scene поведінка.
