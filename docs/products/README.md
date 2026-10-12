# Product integration map

Актуально для `phase-2/staging` станом на 2026-09-28. Це операційний опис того, як у застосунок
підключені Urban Standard Height (USH), Urban Low Height (ULH), Class і Mako. Документи
`docs/*-profile.md` залишаються корисними як provenance та історія рішень, але при розбіжності з ними
джерелом істини є поточні `public/collections/**` і код завантажувача.

## Коротка відповідь

Продукти не підключені чотирма окремими React-гілками. Вони є чотирма **collection packages**,
обраними через `?collectionId=`. Спільний shell завантажує пакет, нормалізує його локальні та
віддалені дані й уже з них будує навігацію, каталоги, правила, PlayCanvas-команди, SKU та ціну.

```text
URL ?collectionId
        |
        v
public/collections/registry.json
        |
        v
<collection>/manifest.json
   | local JSON                         | remote RenderAdmin
   | presets, ui, product profile,      | configurator, countertop table,
   | runtime bindings, SKU profile      | cabinet table
   +-------------------+----------------+
                       v
              loadResolvedCollection
                       |
        +--------------+----------------+
        |              |                |
        v              v                v
 dynamic routes    Redux/rules    PlayCanvas adapter + pricing
```

## Runtime pipeline

1. `ActiveCollectionProvider` один раз фіксує початковий `collectionId`. Відсутній параметр означає
   default із registry — `urban-standard-height`. Невідомий або порожній id дає контрольовану помилку.
2. `resolveCollection` знаходить manifest. Для legacy saved configuration без `collectionId` використовується
   `urban-standard-height`; явний невідомий id ніколи тихо не підмінюється USH.
3. `loadResolvedCollection` паралельно завантажує локальні файли пакета і remote sources з
   `https://renderadmin.vivid3d.tech`: `GET /configurators/:id`, `GET /datatables/:id`.
4. Loader перевіряє збіг `collectionId` між manifest, `ui.json`, `product-profile.json` і
   `runtime-bindings.json`, а також semantic coverage runtime bindings.
5. Cabinet DataTable нормалізується через `product-profile.ruleData.cabinetMatrixLegacyAdapter`;
   типи з `runtime-bindings.unplacedProductTypes` вилучаються з builder catalog.
6. `CollectionReadinessGate` не монтує configurator без remote configurator catalog. Зміна
   `collectionId` у вже відкритій SPA-сесії вимагає full-page restart.
7. `CollectionStateBridge` копіює активні profile, cabinet catalog, collection id та runtime bindings у
   Redux, де їх використовують reducers і command layer.
8. `ui.json` створює маршрути й поля. `product-profile.json` визначає допустимі значення, defaults і
   business rules. `runtime-bindings.json` перекладає semantic attributes у ключі/значення сцени.
9. Save записує `collectionId`; restore спочатку відкриває відповідну колекцію, а потім відновлює сцену.

Ключові файли коду: `src/entities/collection/lib/loadCollection.ts`,
`src/entities/collection/ui/ActiveCollectionProvider.tsx`, `src/app/router/CollectionStepRoutes.tsx`,
`src/entities/configuration/ui/CollectionStateBridge.tsx`,
`src/features/playCanvasAdapter/lib/createPlayCanvasRuntimePort.ts`.

## Матриця підключення

| Product | `collectionId` | Configurator | Countertop DT | Cabinet DT | Presets | Presets with composition | SKU source |
|---|---|---:|---:|---:|---:|---:|---|
| USH | `urban-standard-height` | 4 | 438 | 439 | 54 | 54 | legacy mappings + code series |
| ULH | `urban-low-height` | 4 | 589 | 580 | 59 | 53 | `sku-profile.json`, partial |
| Class | `class` | 9 | 578 | 579 | 44 | 0 | `sku-profile.json`, partial |
| Mako | `mako` | 9 | 577 | 581 | 42 | 42 | `sku-profile.json`, partial |
| Urban Freestanding | `urban-freestanding` | 11 | 591 | 590 | 54 | 54 | `sku-profile.json`, partial |
| Tricot | `tricot` | 12 | 593 | 592 | 41 | 41 | `sku-profile.json`, partial |
| Urban Duplex | `urban-duplex` | 13 | 595 | 594 | 71 | 66 | `sku-profile.json`, partial |
| Lame | `lame` | 14 | 597 | 596 | 43 | 43 | `sku-profile.json`, partial |

USH і ULH ділять один configurator, але не countertop table, cabinet table, product profile, UI чи
runtime bindings. Class і Mako ділять configurator 9, проте мають окремі cabinet/countertop
tables та різну семантику сцени. Спільний remote id не означає успадкування правил.

Urban Freestanding, Tricot, Urban Duplex і Lame мають власні material configurators 11–14
(`modular-config-phase-2-materials-(…)`), лише з кольорами своєї колекції. Групи там звуться
`Select … Color`, а не як у configurator 4 (`Cabinet Color`, `Vessels`); код, якому потрібен вид групи
(столешниця, towel bar, swatch order, Summary), визначає його через
`src/entities/configurator/lib/configuratorGroupKind.ts`, а не за іменем.

## Ролі файлів collection package

| Файл | Відповідальність |
|---|---|
| `manifest.json` | Composition root: label, defaults, локальні файли та remote ids. |
| `presets.json` | Model cards і `presetProducts`, які реально створюють композицію. |
| `ui.json` | Prebuilt/custom flows, routes, sections, controls, image references. |
| `product-profile.json` | Attribute catalog, aliases, defaults, capabilities, rule data, reason messages. |
| `runtime-bindings.json` | Product type mapping і переклад attribute values у scene patches; `state-only` та `unbound` межі. |
| `sku-profile.json` | Data-driven SKU grammar для ULH/Class/Mako; `status: partial` і pricing gaps. |
| `cabinet-sku-mappings.json` | Legacy USH SKU mappings. |
| `static-options.json` / `navigation.json` | Legacy USH data; для нових колекцій відповідні дані вже походять з profile/UI. |

## Необхідні перевірки при зміні продукту

- Manifest id та всі локальні `collectionId` збігаються.
- Поле з `ui.json` існує в profile або має свідомий runtime/status contract.
- Кожен core/UI attribute покритий binding зі статусом `bound`, `state-only` або `unbound`.
- Cabinet table читається через mapping саме цього profile; не додавати USH fallback.
- Product type існує в `productTypes` або свідомо прихований у `unplacedProductTypes`.
- `optionsSource: configurator:<group>` точно збігається з `proxyName` remote configurator group;
  `configurator:<group>/<option>` бере лише одну option цієї групи (Urban Duplex:
  `Select Cabinet Colors/Base Panel` і `…/Lateral Panel`). Якщо attribute має ще й власні `options`
  (Tricot), вони лишаються allowlist: configurator додає до них hex, SKU і картинки, але не нові кольори.
- Новий preset має валідний image path і, якщо він повинен будувати сцену, непорожній `presetProducts`.
- Pricing не позичає SKU series іншого продукту.
- `collectionId` зберігається у всіх route links, save metadata та restore URL.

## Продуктові документи

- [Urban Low Height](urban-low-height.md) — головний робочий контекст.
- [Urban Standard Height](urban-standard-height.md).
- [Class](class.md).
- [Mako](mako.md).
