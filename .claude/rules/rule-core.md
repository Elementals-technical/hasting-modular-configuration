---
paths:
  - "src/features/configurator-rule-core/**"
  - "src/features/sidePanel/lib/**"
  - "src/shared/lib/bookMatching/**"
  - "src/entities/collection/lib/productProfileSelectors.ts"
---

# Rule engine rules

- A rule is a pure function of the selection or context, the catalog and the profile; it touches no React, Redux or scene. It takes `profile: ProductProfile | null` as an explicit parameter.
- Read option lists, defaults and messages from the profile through the `select*` helpers of `src/entities/collection/lib/productProfileSelectors.ts`, never from a local list. A section the collection doesn't declare means the feature isn't offered, never that USH's applies.
- `applyConfiguratorRules` takes `catalog` and `profile` as required arguments: a missing source must stay visible to the caller, never become a permissive empty default.
- A refusal returns a stable `namespace.camelCase` reason code, its text taken from `profile.messages` through `selectMessage` or `selectMessageOr(profile, code, fallback)`.
