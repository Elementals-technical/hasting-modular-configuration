# Collection data migration status v2

Цей документ продовжує [Collection data migration status v1](./collection-data-migration-status-v1.md) після merge робіт Developers B, C та I і завершення інтеграційного пакета Developer A. V1 залишається історичним baseline; актуальні контракти й статуси наведено тут.

Перевірено на гілці `feat/developer-a-active-collection-integration` після комміту `948bd2fd` і перед цим документом.

## Що завершив Developer A

A07 завершено на рівні active-collection contract:

- production manifest USH оголошує `ui.json`, `product-profile.json` і `runtime-bindings.json`;
- collection loader завантажує та перевіряє всі три документи;
- `ui.json` є основним джерелом flows, steps, sections і navigation;
- legacy navigation формується з UI-схеми та перевіряється проти `navigation.json`, поки старі споживачі ще існують;
- ProductProfile, UI та runtime bindings перевіряються на відповідність manifest collection ID;
- runtime bindings перевіряються проти ProductProfile attributes, UI fields, реєстру ownership C та dimensions;
- blocking diagnostics зупиняють перехід у `ready`; безпечний `orphan-binding` повертається як warning;
- `CollectionStateBridge` очищує попередній profile, defaults/options і cabinet catalog під час `resolving`, `loading` та `error`, а для нового `ready` атомарно замінює collection-derived product data.

А-частина A08 також завершена:

- `fixture-ui` має власні manifest, ProductProfile, UI і runtime bindings; `TestGrooveFinish=test-finish` перетворюється на scene patch `HandleGrooveColor=test-finish`;
- `fixture-rules` має власні ProductProfile, UI, runtime bindings і injected matrices; drawer `1` блокується реальною `applyConfiguratorRules`, drawer `2` дозволений і перетворюється на runtime value `2D`;
- обидва fixtures відсутні у production registry та не запускають remote requests за USH IDs;
- інтеграційний тест перемикає завантажений USH на `fixture-ui` через provider і Redux bridge та перевіряє відсутність USH state/catalog leakage.

A09 має статус **частково виконано**. A зафіксував поточних споживачів і автоматизовані докази. Повне закриття A09 очікує B10, C12, I06 і D03, включно з browser evidence.

## Актуальний публічний контракт

`useActiveCollection()` зберігає стани `resolving`, `loading`, `ready` та `error`. Дані можна читати лише зі стану `ready`. Невідома колекція, помилка джерела або blocking contract diagnostic не підставляють USH чи попередню успішно завантажену колекцію.

Готовий результат містить:

```ts
type LoadedCollectionData = {
  id: string;
  manifest: CollectionManifest;
  diagnostics: CollectionDiagnostic[];
  sources: {
    local: {
      navigation?;
      presets?;
      staticOptions?;
      cabinetSkuMappings?;
      productProfile?;
      ui?;
      runtimeBindings?;
    };
    remote: { configurator?; countertopTable?; cabinetTable? };
  };
  catalog: {
    navigation?;
    presets?;
    staticOptions?;
    cabinetSkuMappings?;
    productProfile?;
    customization?;
    runtimeBindings?;
    configurator?;
    cabinets?;
    countertops?;
  };
};
```

Власники даних:

| Дані | Основне джерело | Власник контракту |
| --- | --- | --- |
| Source paths, remote IDs, collection identity | Manifest | A |
| Flows, steps, sections, fields, navigation | UI schema | B |
| Product options, capabilities, defaults, rule inputs | ProductProfile | C |
| Semantic value → scene target/patch | Runtime bindings | I |
| SKU та price mappings | Pricing profile / collection pricing sources | D |

Manifest оголошує місце джерела, але не дублює його зміст. Компоненти не повинні імпортувати collection JSON напряму.

## Статус foundations B, C та I

| Блок | Зроблено | Залишилося |
| --- | --- | --- |
| B: UI schema | Типи schema, USH `ui.json`, structural validator і pure navigation calculation реалізовані. A завантажує schema через manifest. | B05–B10: production сторінки, секції, поля, SideNavigation, top/bottom navigation, preset flows та browser acceptance ще використовують legacy компоненти й константи. |
| C: ProductProfile і state | ProductProfile завантажується active collection; handle catalog і 439 adapter переведені на profile; cabinet builder і countertop rule hook читають active collection; bridge ізоляції виправлено. | C06: production UI не викликає generic `changeAttribute`; частина сторінок усе ще збирає state/runtime changes вручну. C12 browser acceptance не виконано. |
| C: Save | Єдиний `useBuildConfigurationRequest()` / `useSaveCurrentConfiguration()` використовується Player, обома Summary, bottom canvas actions і current-link flow. | C09: повний new/legacy restore через active collection, runtime replay та state reconciliation потребує спільної перевірки. |
| I: runtime bindings | USH bindings, parser, validator, runtimePort, PlayCanvas adapter, execution statuses і unit/integration tests реалізовані. A завантажує bindings через active collection. | I04–I06: production runtime port не створюється; production сторінки й bridge все ще викликають wrappers напряму; real-scene readback/replay та browser acceptance не виконані. |
| D: pricing | Чинний USH pricing flow збережений. | D01–D03 не мають доказу завершеної collection-driven міграції; configurator ID, defaults і SKU mappings ще читаються з USH-specific sources. |

## Production consumers, які ще треба мігрувати

### Configurator 4 та DataTable 438

DataTable 439 уже прибрано з production cabinet-builder query path: normalized cabinet catalog надходить через active collection. Наступні споживачі досі запускають власні запити:

| Consumer | Поточне джерело | Target | Власник | Статус |
| --- | --- | --- | --- | --- |
| `pages/prebuilt/model/ModelPage.tsx` | Configurator `4` | `data.catalog.configurator` | B | Pending |
| `pages/prebuilt/cabinet/CabinetPage.tsx` | Configurator `4` | `data.catalog.configurator` | B | Pending |
| `pages/prebuilt/countertop/CountertopPage.tsx` | Configurator `4`, DataTable `438` | `data.catalog.configurator`, `data.catalog.countertops` | B | Pending |
| `pages/prebuilt/accessories/AccessoriesPage.tsx` | Configurator `4` | `data.catalog.configurator` | B | Pending |
| `pages/prebuilt/faucet/index.tsx` | Configurator `4` | `data.catalog.configurator` | B | Pending |
| `pages/custom/cabinetColors/index.tsx` | Configurator `4` | `data.catalog.configurator` | B | Pending |
| `pages/custom/countertop/index.tsx` | Configurator `4`, DataTable `438` | `data.catalog.configurator`, `data.catalog.countertops` | B | Pending |
| `pages/custom/accessories/index.tsx` | Configurator `4` | `data.catalog.configurator` | B | Pending |
| `pages/custom/faucetHoles/index.tsx` | Configurator `4`, DataTable `438` | `data.catalog.configurator`, `data.catalog.countertops` | B | Pending |
| `features/sidebar/ui/RightCabinetStyleSidebar/RightCabinetStyleSidebar.tsx` | Configurator `4` | `data.catalog.configurator` | B/C | Pending |
| `features/swatchOrder/ui/SwatchOrder.tsx` | Configurator `4` | `data.catalog.configurator` | B | Pending |
| `widgets/Player/components/PlayCanvasIntegration/PlayCanvasIntegration.tsx` | Configurator `4` | `data.catalog.configurator` | I | Pending |
| `pages/prebuilt/summary/SummaryPage.tsx` | Configurator `4` | active configurator/profile data | B/D | Pending |
| `pages/custom/summary/index.tsx` | Configurator `4`, DataTable `438` | active configurator/countertop data | B/D | Pending |
| `shared/hooks/usePriceCalculation.ts` | Configurator `4` | collection pricing input | D | Pending |

### Presets, navigation і static UI data

| Consumers | Поточне джерело | Target | Власник | Статус |
| --- | --- | --- | --- | --- |
| `ProductModelsGrid`, `ModelPage`, `ModelDetailsPage`, `CabinetBuilderPage` | `productMockData` або local preset assumptions | `data.catalog.presets`, `data.manifest.defaultPresetId` | B | Pending |
| `SideNavigation`, `ConfiguratorSidebar`, `StepNavigationBar`, `BottomStickyBar`, `resolveBacktrack` | `PREBUILT_STEPS` / `CUSTOM_STEPS` | `data.catalog.customization` або derived `data.catalog.navigation` | B | Pending |
| Prebuilt/Custom cabinet, countertop, accessories і faucet constants | TypeScript option arrays | ProductProfile, configurator catalog та `data.catalog.staticOptions` | B/C | Pending by family |
| Product selectors that detect changed USH defaults | Literal USH values | active collection defaults/profile | C | Pending |
| Cabinet/countertop SKU maps і summary formatters | Global USH maps | collection pricing/SKU contract | D | Pending |

### Commands і PlayCanvas

Production source files still contain 116 direct `setConfig` / `setConfigBatch` calls. `createPlayCanvasRuntimePort` is exported and tested but has no production constructor call. `changeAttribute` and `confirmAttributeChange` are tested, including the real adapter boundary, but have no production call site.

Цільовий шлях для кожної мігрованої field family:

```text
data.catalog.customization field
→ C changeAttribute / confirmAttributeChange
→ I runtimePort з data.catalog.runtimeBindings
→ PlayCanvas adapter
→ фактичний result/readback
→ C configuration state
→ спільний Save payload
```

Власник UI event wiring — B, command/state — C, runtime execution — I. Старий прямий wrapper call видаляється після проходження цього шляху для відповідної family.

## Наступний вертикальний browser scenario

Першим брати Handle/Drawers/Height/Groove у Custom Cabinet Builder:

1. B читає поля та options із `data.catalog.customization` і ProductProfile.
2. Вибір Handle викликає C `changeAttribute`.
3. Якщо потрібне підтвердження, UI показує preview та викликає confirm/cancel без попередньої зміни сцени.
4. C передає погоджений change set до production instance runtimePort I.
5. RuntimePort бере mappings з `data.catalog.runtimeBindings`, виконує порядок Drawers → Handle → Height → Groove і повертає `applied`, `partial`, `not-ready`, `unsupported` або `failed`.
6. C оновлює state лише за фактичним результатом.
7. `useBuildConfigurationRequest()` включає active collection ID і фактичні semantic values.
8. Повторити сценарій для USH, потім test provider із `fixture-ui`; перевірити unknown collection і відсутність USH leakage.

Після цього B10, C12 та I06 мають окремо додати browser trace: user action, runtime calls, returned status, state snapshot і Save payload. D03 перевіряє SKU/quantity/price окремо та не блокує саму зміну або Save.

## Автоматизована перевірка

Стан на 14.09.2026:

| Перевірка | Результат |
| --- | --- |
| Vitest на Node 22.18 | 52/52 files, 519/519 tests passed |
| TypeScript project build | Passed |
| Vite production build | Passed; лишилися інформаційні warnings Zod/Rollup і chunk size |
| Lint усіх змінених файлів | Passed після кожного issue |
| Repository-wide `eslint . --quiet` | 103 existing errors, 0 warnings; gate ще не зелений |
| Browser / real PlayCanvas scene | Не перевірено: production command → runtimePort wiring ще відсутній |

У цьому checkout системний Node 18 не може запустити jsdom workers через ESM dependency. Повний suite потрібно запускати Node 22.18; прямий запуск Node 22 пройшов повністю. Це environment constraint, а не пропущені test failures.

## Що означає готовність зараз

Developer A надав одну точку завантаження UI, ProductProfile, runtime bindings, normalized catalogs і diagnostics та довів незалежність двома test-only collection packages. Цього достатньо, щоб B/C/I брали наступний вертикальний scenario без нових collection-specific imports.

Продукт ще не є наскрізно collection-driven у браузері. A09 закривається лише після доказів B10, C12, I06 і D03. Mako/Class production registration залишається заблокованою відсутніми production IDs/defaults/presets/runtime/pricing inputs і не входить у цей статус.
