# Collection test fixtures

`remote/configurator-4.json`, `remote/datatable-438.json`, and `remote/datatable-439.json` are sanitized,
frozen samples captured from the public Render Admin API on 2026-09-10. The configurator sample retains every
real option-group name with a reduced set of options and variants. The two small DataTable responses are frozen
in full so the existing cabinet and countertop parsers are exercised against their real row shapes.

`collections/fixture-ui` and `collections/fixture-rules` are synthetic test packages. They are injected through
the collection runtime dependencies and never appear under `public/collections`.
