# Urban Standard Height (USH)

## Ідентичність

- `collectionId`: `urban-standard-height`
- Package: `public/collections/urban-standard-height/`
- Registry default і legacy fallback для saved configurations без `collectionId`.
- Remote: configurator 4, countertop table 438, cabinet table 439.

USH — найповніший і найстаріший package. Він використовує collection pipeline, але частина його
даних лишається legacy: `navigation.json`, `static-options.json`, `cabinet-sku-mappings.json` та SKU
series у `src/shared/lib/sku/skuSeries.ts`.

## UI, profile і runtime

Prebuilt/custom flows мають по шість кроків: model/builder, color, countertop, accessories,
faucet details, summary. 54 presets мають композиції.

Profile містить найбільший rule set: fluting, grain direction, book matching, drawer mixing, side
panels, dividers, Syntesi, countertop fallbacks і vessel compatibility. Саме тому USH не можна
використовувати як неявний default ruleset для інших колекцій.

Runtime має 16 bound attributes, включно з handles, dimensions, cabinet/countertop colors, basin,
vessel, towel bar і countertop style. Cabinet types `Side-Cabinet` і `Sink-Cabinet` можуть обидва
потрапляти в scene product `Sink-Cabinet`; це свідомий runtime mapping.

## Pricing

USH не має collection `sku-profile.json`. Його pricing працює через legacy
`cabinet-sku-mappings.json` і `SKU_SERIES_BY_COLLECTION["urban-standard-height"]`. Не переносити
цей fallback на нові products.

## Ризики зміни

- Зміна registry default впливає на URL без `collectionId` і legacy restores.
- Видалення legacy local files потребує перевірки всіх consumers, а не лише loader.
- Спільні configurator/table ids із ULH не роблять їхні profiles взаємозамінними.
- USH має найбільше end-to-end залежностей: accessories, side panels, dividers, SKU і save/restore.

## Мінімальна перевірка

Collection contracts, product profile, runtime bindings, pricing/SKU, save/restore та повний build.
Для UI/runtime змін перевірити обидва flows і backward compatibility saved configurations.
