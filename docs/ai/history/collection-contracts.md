---
trigger: Editing src/entities/collection/** or public/collections/**, reading collection data in a component, adding a reason code, adding a collection.
reader: An agent or developer producing or consuming collection data.
authoritative:
  - src/entities/collection/model/schemas.ts
  - src/entities/collection/lib/parseProductProfile.ts
  - src/entities/collection/lib/runtimeBindings/parseRuntimeBindings.ts
  - src/entities/collection/lib/customization/validateCustomizationSchema.ts
  - src/entities/collection/lib/loadCollection.ts
  - src/entities/collection/ui/activeCollectionContext.ts
  - src/entities/collection/ui/CollectionReadinessGate.tsx
  - src/entities/collection/__tests__/collectionConsumerBoundary.test.ts
  - src/entities/collection/__tests__/reasonCodesHaveMessages.test.ts
---

# Collection contracts

A collection is a folder `public/collections/<id>/` — manifest, product-profile, ui, runtime-bindings, sku-profile, presets and so on. It is listed in `public/collections/registry.json`.

## Loading and reading

- The loader (`src/entities/collection/lib/loadCollection.ts`) loads and validates a collection once.
- `CollectionReadinessGate` (`src/entities/collection/ui/CollectionReadinessGate.tsx`) opens the app only for a ready collection.
- Components read the data in one of two ways:
  - through `useActiveCollection(selector)` (`src/entities/collection/ui/activeCollectionContext.ts:28-39`);
  - through a derived hook such as `useCountertopRules()`.
- Outside the loader:
  - don't call `useGetConfiguratorQuery`, `useGetCountertopDatatableQuery` or `useGetProductDatatableQuery`;
  - don't hardcode source ids (configurator `4`, tables `438`/`439`).

  Enforced by `src/entities/collection/__tests__/collectionConsumerBoundary.test.ts`.

## Validation

- Each file has exactly one validator. Don't add a second one. Rationale: `src/entities/collection/model/schemas.ts:57-62`.

  | File               | Validator                                                 |
  | ------------------ | --------------------------------------------------------- |
  | registry, manifest | zod schemas in `src/entities/collection/model/schemas.ts` |
  | product profile    | `parseProductProfile`                                     |
  | runtime bindings   | `parseRuntimeBindings`                                    |
  | ui                 | `validateCustomizationSchema`                             |

- Untyped JSON enters as `unknown` and is narrowed only by its validator. Inside those guards, `Record<string, unknown>` is the plain-object type.
- A document's types live next to its validator, in `src/entities/collection/model/`.

## Reason codes

- Rules, commands and pages return reason codes of the form `"namespace.camelCase"`. Pages keep theirs as `REASON_*` constants.
- The text for a code comes from the profile's `messages`, not from code, and every code needs one. Enforced by `src/entities/collection/__tests__/reasonCodesHaveMessages.test.ts`.

## Examples

- `src/features/configurator-rule-core/countertop/hooks/useCountertopRules.ts`
- `src/entities/collection/model/schemas.ts`
- `src/entities/collection/lib/runtimeBindings/parseRuntimeBindings.ts`

## Background

- `docs/collection-data-migration-status-v4.md`
- `docs/product-profile-migration.md`
