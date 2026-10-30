# Collection data migration status v4

Цей документ продовжує [Collection data migration status v3](./collection-data-migration-status-v3.md), [v2](./collection-data-migration-status-v2.md) і [v1](./collection-data-migration-status-v1.md). V3 залишається актуальним описом readiness gate, ready-only hook та незмінної identity сесії. V4 фіксує завершення міграції production consumers із hardcoded Configurator/DataTable requests на active-collection catalogs.

## Завершений consumer contract

Collection loader є єдиним production-місцем, яке завантажує remote collection sources за посиланнями з manifest. Після проходження readiness gate компоненти читають уже завантажені й перевірені дані:

```ts
const configuratorGroups = useActiveCollection(
  (collection) => collection.catalog.configurator.groups,
);

const countertopRules = useCountertopRules();
```

`catalog.configurator` гарантований shell readiness contract. `catalog.countertops` залишається optional у загальній collection model; `useCountertopRules()` повертає стабільний порожній список, якщо manifest не оголосив цю можливість. Якщо source оголошено, але його не вдалося завантажити чи перевірити, shell не відкривається і показує collection error.

Компоненти не використовують `sources.remote` напряму, коли є нормалізований catalog. Raw Configurator response і DataTable envelopes належать loader/API infrastructure.

## Що мігровано

Прибрано всі 15 production-викликів `useGetConfiguratorQuery({ id: 4, ... })`:

- Prebuilt Model, Cabinet, Countertop, Accessories, Faucet і Summary;
- Custom Cabinet Colors, Countertop, Accessories, Faucet Holes і Summary;
- `RightCabinetStyleSidebar`;
- `SwatchOrder`;
- `PlayCanvasIntegration`;
- `usePriceCalculation`.

Прибрано всі чотири production-виклики countertop DataTable `438` із Prebuilt Countertop, Custom Countertop, Custom Faucet Holes і Custom Summary. Ці consumers використовують один раз нормалізований `catalog.countertops`.

Спільні `adaptThreekitConfig` і `findCountertopSkuByColorName` тепер приймають normalized configurator groups, а не raw API envelope. Це прибирає залежність summary, swatches і model restore/SKU logic від форми endpoint response.

Legacy cabinet adapter більше не містить literal DataTable `439`. Йому потрібні лише column mappings; remote cabinet source identity надходить із manifest, а collection-specific adapter identity — із ProductProfile.

Локальні loading-стани повторних configurator requests прибрано. Обов'язкові configurator data завантажуються до mount сторінок, тому loading/error policy залишається у readiness gate.

## Автоматичний архітектурний guard

Тест `collectionConsumerBoundary.test.ts` сканує production TypeScript і падає, якщо поза тестами з'являється:

- виклик `useGetConfiguratorQuery()`;
- виклик `useGetCountertopDatatableQuery()`;
- виклик `useGetProductDatatableQuery()`;
- source-shaped hardcode `configuratorId: 4`, countertop table `438` або cabinet table `439`.

Звичайні UI option IDs із таким самим числом не вважаються remote source IDs. Generic RTK Query endpoints і manifest-driven loader залишаються доступними як infrastructure.

## Browser і network evidence

Headless Chrome smoke виконано проти production preview на Node `22.18.0`:

| Сценарій | Результат |
| --- | --- |
| Implicit default USH | Urban Standard presets відкрилися |
| Explicit `urban-standard-height` | Urban Standard presets відкрилися |
| `urban-low-height` | Urban Low Height UI відкрився; показано відсутність presets |
| `class` | Class UI відкрився; показано відсутність presets |
| Unknown identity | `Collection unavailable`, `Retry` і `Open default collection` показані |
| Retry | Повторено pipeline для тієї самої unknown identity |
| Default recovery | Прибрано лише `collectionId`; route, `campaign=v4` і hash збережено |
| Client-side identity change | Shell заблоковано `Restart required` |

В одній explicit USH session виконано client-side переходи через усі мігровані Prebuilt і Custom routes. Performance resource entries залишилися незмінними на кожному переході:

| Remote source | Requests після startup | Requests після всіх route transitions |
| --- | ---: | ---: |
| Configurator `4` | 1 | 1 |
| Countertop DataTable `438` | 1 | 1 |
| Cabinet DataTable `439` | 1 | 1 |

Отже, кожне remote джерело завантажує manifest-driven collection loader; сторінки не створюють повторних hardcoded requests.

## Перевірка

Стан на 16.09.2026:

| Перевірка | Результат |
| --- | --- |
| Vitest | 85/85 files, 855/855 tests passed |
| Consumer-boundary guard | 2/2 tests passed |
| TypeScript (`npm run tsc`) | Passed |
| Production build (`npm run build`) | Passed; інформаційні Rollup/Zod і chunk-size warnings залишилися |
| Production source search | 0 direct configurator/countertop/cabinet collection query-hook calls |
| Repository-wide lint | Baseline не зелений: 100 errors і 5 warnings |

Міграція не додала нових lint diagnostics. Частина змінених великих legacy-файлів уже мала помилки або warnings поза зміненими рядками, зокрема `PlayCanvasIntegration`, Custom Cabinet Colors і Accessories. Системний Node 18 у цьому checkout не запускає jsdom workers через ESM dependency; перевірки виконано на Node 22.18.

## Що залишається відкритим

Ця робота завершила ownership remote collection data у production consumers, але не завершила всі collection capabilities:

- `urban-low-height` і `class` досі не мають presets, ProductProfile, runtime bindings, cabinet SKU mappings та collection-specific pricing data;
- `usePriceCalculation` бере configurator option metadata з active collection, але загальний pricing contract, SKU mappings і price-service inputs ще потребують D-міграції;
- production runtimePort wiring, command/readback і real-scene acceptance залишаються роботою C/I вертикалей;
- UI constants, static options і defaults, які не входили до Configurator/DataTable query migration, потребують окремого ownership review;
- browser smoke підтверджує data flow і відсутність duplicate requests, але не замінює повний product acceptance кожної опції в реальній PlayCanvas scene.

Актуальні межі partial collections залишаються у [Urban Low Height and Class readiness](./urban-low-height-class-readiness.md).

## Правило для наступних розробників

Новий configurator consumer має використовувати `useActiveCollection()` або selector form. Countertop rules слід читати через `useCountertopRules()`. Додавати прямий RTK Query hook із Configurator/DataTable ID у сторінку, widget, feature чи shared hook не потрібно: manifest уже оголошує source, loader завантажує його один раз, а readiness gate гарантує готовність обов'язкового catalog до mount UI.
