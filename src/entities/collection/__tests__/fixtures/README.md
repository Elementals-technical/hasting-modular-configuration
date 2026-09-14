# Collection test fixtures

`remote/configurator-4.json`, `remote/datatable-438.json`, and `remote/datatable-439.json` are sanitized,
frozen samples captured from the public Render Admin API on 2026-09-10. The configurator sample retains every
real option-group name with a reduced set of options and variants. The two small DataTable responses are frozen
in full so the existing cabinet and countertop parsers are exercised against their real row shapes.

`collections/fixture-ui` and `collections/fixture-rules` are synthetic test packages. They are injected through
the collection runtime dependencies and never appear under `public/collections`.

The `9901`–`9903` source references inside `fixture-ui/product-profile.json` are test-only sentinels required by
the current ProductProfile contract. Its manifest declares no remote source, the loader never requests those
sentinels, and the integration test verifies that only the initial USH load reaches the remote adapter.
