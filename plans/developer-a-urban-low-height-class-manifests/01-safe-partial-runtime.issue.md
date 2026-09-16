## What to build

Allow a registered collection that intentionally omits runtime bindings to load and render without an independent request for `<collectionId>/runtime-bindings.json`. The runtime integration must obtain bindings only from the active collection contract and report not-ready when they are absent, while Urban Standard Height continues to use its declared bindings.

## Acceptance criteria

- [ ] The runtime bridge does not construct or fetch a bindings URL independently of the active collection manifest.
- [ ] A ready collection without runtime bindings causes no failed bindings request and exposes no bindings to the runtime port.
- [ ] Urban Standard Height still publishes its validated runtime bindings to the production runtime port path.
- [ ] Switching from a collection with bindings to one without bindings clears the previously loaded table.
- [ ] Relevant tests, TypeScript validation, and changed-file lint pass.

## Blocked by

None - can start immediately.

