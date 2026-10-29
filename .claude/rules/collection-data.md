---
paths:
  - "public/collections/**"
  - "src/entities/collection/**"
---

# Collection data rules

## Package

- A collection has one kebab-case id: its folder name, its `registry.json` entry, the manifest `id` and every document's `collectionId` are that exact string.
- `manifest.local` names each package JSON by a bare kebab-case file name in the package root, under camelCase keys (`productProfile`, `runtimeBindings`, `skuProfile`). CSV and TSV source material stays in the package, unreferenced by the manifest and never read at runtime.
- A playable collection ships `presets.json`, `ui.json`, `product-profile.json`, `runtime-bindings.json` and a remote configurator, plus `sku-profile.json` unless it is priced as USH. The profile, the bindings and the SKU profile open with `schemaVersion` and `collectionId`.
- Attribute ids are PascalCase, `sinkType` being the one exception; option values are strings.
- Images are package-relative `images/…` paths; an absolute image URL must be HTTPS.
- RenderAdmin configurator and DataTable ids live in `manifest.remote`, the only place the loader reads them; copies in a profile's `sourceRefs` are checked only when the manifest sets `requireSourceAgreement`.
- Never fill a gap with another collection's data: record a pricing gap, an `unbound` binding with a `reason`, or a `state-only` value.

## Loader

- Load only through the provider and `loadResolvedCollection`, failing closed: a declared source that fails rejects the whole collection with a `CollectionDataError`, never a USH or default substitute.
- A flat document gets a zod `.strict()` schema named `<thing>Schema` in `model/schemas.ts`, its type `z.infer`-ed, checked with `.safeParse`. A remote RenderAdmin envelope uses `.passthrough()`, typed `z.ZodType<T>` against its hand-written API type. zod stays inside `entities/collection`.
- A document whose errors must name a data path is hand-parsed by `parseX(input: unknown)` returning `{ ok: true, … } | { ok: false, diagnostics }`. Why: a second schema would duplicate the parser's diagnostics and drift from them.
- Cross-document checks go in `validateLocalContracts` (`lib/loadCollection.ts`): an error throws, a warning stays in `data.diagnostics`.
- The loader takes its collaborators as `CollectionRuntimeDependencies`: production passes nothing, tests inject.

## Adding a collection

- Add the registry entry and the package. For pricing add `sku-profile.json`, or a `SKU_SERIES_BY_COLLECTION` row (`src/shared/lib/sku/skuSeries.ts`) with `cabinet-sku-mappings.json`.
- Extend the pinned lists in `collectionContracts.test.ts` and `reasonCodesHaveMessages.test.ts`, and give the profile a text for every `change.*` reason code.
- Every product type in `runtime-bindings.json` exists in the PlayCanvas export or is declared in `unplacedProductTypes`.
- Synthetic test collections stay in `src/entities/collection/__tests__/fixtures/collections/`, never in `public/collections`.
