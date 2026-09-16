# Urban Low Height і Class: partial launch та readiness handoff

Цей документ описує результат [PRD Developer A](../plans/developer-a-urban-low-height-class-manifests.prd.md) і продовжує [Collection data migration status v1](./collection-data-migration-status-v1.md). Загальний active-collection контракт і перелік legacy-споживачів залишаються у v1; тут зафіксовано стан двох нових production packages.

## Що доступно зараз

Urban Standard Height залишається default collection. Дві нові колекції зареєстровані з підтвердженими application IDs:

| Колекція | Package | Public URL |
|---|---|---|
| Urban Low Height | [`public/collections/urban-low-height`](../public/collections/urban-low-height/manifest.json) | `/prebuilt?collectionId=urban-low-height` |
| Class | [`public/collections/class`](../public/collections/class/manifest.json) | `/prebuilt?collectionId=class` |

Обидва manifests містять `defaults: {}`, власний `ui.json` і погоджені shared remote sources:

- Configurator ID `4`, `view: "full"`, `serialize: true`;
- Countertop DataTable ID `438`;
- Cabinet DataTable ID `439`.

`ui.json` кожної колекції оголошує мінімальний prebuilt entry `/prebuilt/model` і custom entry `/custom/cabinet-builder`. Prebuilt сторінка показує назву активної колекції та явний empty state, бо затверджених preset compositions ще немає. URL-навігація зберігає `collectionId`.

## Межа partial launch

У manifests навмисно не оголошені:

- `defaultPresetId` і presets;
- ProductProfile;
- runtime bindings;
- cabinet SKU mappings;
- pricing data.

Тому цей реліз підтверджує resolution, loading, isolation, navigation і collection-specific UI shell. Він не підтверджує cabinet placement, зміну сцени, Save/restore, SKU, quote, price або checkout для Urban Low Height чи Class. За відсутності runtime bindings runtime port має повертати unsupported/not-ready і не використовувати USH mappings.

| Capability | Urban Low Height | Class |
|---|---|---|
| Registry identity і manifest | Ready | Ready |
| Remote `4/438/439` loading | Ready за погодженим shared-source рішенням | Ready за погодженим shared-source рішенням |
| Collection-specific navigation і empty UI | Ready | Ready |
| Defaults | Очікуються | Очікуються |
| Preset BOMs та images | Очікуються | Очікуються |
| ProductProfile і rule semantics | Очікуються | Очікуються |
| Runtime product types і bindings | Очікуються | Очікуються; відомі лише факти нижче |
| SKU та pricing | Очікуються | Очікуються |
| Full browser configuration flow | Не готовий | Не готовий |

## Підтверджені runtime-факти Class

Надані факти збережено окремо у [Class collection runtime facts](./class-collection-runtime-facts.md). Вони включають:

- case-sensitive product type `Class-side-cabinet`;
- `Width`: `40`, `60`, `80`, `100`, `120` см;
- `Height`: `40`, `52` см;
- єдиний `Depth`: `52` см;
- `InnerDrawer`: `"Disable"` або `"Enable"`, з видимим ефектом лише для `Height: 40`;
- поля `CabinetColor`, `CabinetSideColor`, `FrameColor` без затверджених value catalogs;
- обов'язкове збереження `cabinetId`, поверненого `addProduct`, для наступних `setConfig`, `getConfig` і видалення.

Це вхідні дані для ProductProfile та runtime bindings, а не production wiring.

## Дані та робота, яких ще бракує

| Власник | Потрібно надати або реалізувати |
|---|---|
| Product/data owners | Затверджені defaults; preset BOMs та images; повні обов'язкові атрибути й option catalogs; collection-specific SKU/pricing inputs; підтвердження, як shared таблиці `438/439` відділяють дані кожної колекції. Для Urban Low Height окремо вирішити конфлікт `ProductID=USTD` проти назви продукту та надати PlayCanvas product types. Для Class надати значення трьох color fields і повні target/reset rules. |
| Developer B | Розширити `ui.json` після появи затверджених полів і flow; завершити переведення сторінок на `data.catalog.*`; прибрати власні remote queries і USH constants там, де вони ще залишилися; провести browser acceptance повних flow. |
| Developer C | Створити окремі ProductProfile для обох колекцій: defaults, attributes, capabilities, aliases та ruleData; додати evaluator semantics для нових Class/Urban Low Height правил; перевірити Save/restore й очищення state. |
| Developer I | Погодити runtime product types, targets, value mappings, order/reset behavior; створити й перевірити `runtime-bindings.json` для кожної колекції через runtimePort. Для Class використати зафіксований `cabinetId` lifecycle. |
| Developer D | Додати collection-specific cabinet/countertop SKU mappings, quantities, pricing sources, summary та quote identity; перевірити ціну незалежно від scene mutation. |
| Developer A | Після надходження затверджених файлів додати manifest references, deterministic normalization і cross-contract validation. Не копіювати USH data як fallback. |

Поточний cabinet parser без ProductProfile має legacy USH fallback для колонок handle matrix. Через це shared DataTable `439` ще не є доказом коректних business rules нових колекцій. Повний custom flow не можна відкривати як production-ready, доки C не надасть окремий profile або data owners не підтвердять сумісність схеми.

## Як додавати наступні дані

Розширення має бути additive і пройти той самий loader:

1. Product/data owners затверджують source document і collection identity.
2. Власник контракту створює collection-specific JSON: ProductProfile — C, UI — B, runtime bindings — I, pricing/SKU — D.
3. Developer A додає лише відповідне поле `local` у manifest.
4. Loader валідовує файл, identity та cross-contract зв'язки до стану `ready`.
5. Тести доводять відсутність USH leakage, після чого браузерний сценарій перевіряє UI → command → runtime → state → Save/price.

## Перевірка

Стан на 2026-09-16, Node `22.18.0`:

| Перевірка | Результат |
|---|---|
| Повний Vitest suite | 80 files, 836 tests passed |
| TypeScript project build | Passed |
| Vite production build | Passed; інформаційні Rollup/Zod та chunk-size warnings залишилися |
| Lint змінених TypeScript/TSX файлів | Passed |
| Repository-wide `eslint . --quiet` | 102 existing errors, 0 warnings; жодна помилка не належить зміненим у цьому пакеті файлам |
| Browser smoke | Обидві URL відрендерили collection label, collection-specific empty state і збережений query parameter |

Деталі браузерної перевірки: [Urban Low Height and Class browser smoke](./urban-low-height-class-browser-smoke.md).
