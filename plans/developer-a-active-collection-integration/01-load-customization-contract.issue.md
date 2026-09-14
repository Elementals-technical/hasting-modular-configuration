## What to build

Load each collection's customization schema through its manifest and expose it from the active-collection contract. The validated schema becomes the authoritative definition of flows and navigation; existing navigation consumers continue to receive a compatibility catalog generated from the same schema. Invalid structure, collection identity mismatch, or an independently supplied legacy navigation file that disagrees with the customization schema must stop the collection before it becomes ready.

## Acceptance criteria

- [x] The manifest contract supports an optional local customization-schema reference, and the USH manifest declares its existing UI dataset.
- [x] Customization parsing and validation are callable by the collection loader without an entity-to-feature dependency, while Developer B's existing public imports remain compatible.
- [x] Loaded source data and assembled catalog data expose the validated customization schema.
- [x] Compatibility navigation is derived deterministically from the customization flows and step definitions.
- [x] A mismatched collection ID, invalid customization schema, or divergent legacy navigation produces an actionable collection validation error.
- [x] USH loads its two flows through the manifest while preserving established route order and labels.
- [x] Relevant tests, TypeScript validation, and changed-file linting pass.

## Blocked by

None - can start immediately
