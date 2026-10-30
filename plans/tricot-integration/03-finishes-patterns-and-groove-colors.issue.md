# Cabinet finishes, patterns and groove colors

Type: AFK. User stories: 17–24, 38, 49–50, 53, 58.

## What to build

Carry cabinet finish, material-dependent pattern and groove color from the shared field UI through validation, scoped state, runtime translation and cabinet pricing. Extend reusable profile rules and external option filtering instead of introducing Tricot-only page branches.

## Acceptance criteria

- [x] Offer exactly 23 cabinet colors and 20 matte lacquer groove colors with preserved material/SKU/swatch metadata.
- [x] Loden is eligible only for LACM; Cannette, Twill, Gessato and Satin only for WDV.
- [x] Explicitly normalize Cannette/Cannete and preserve source identities.
- [x] Preserve an already compatible pattern after a color change; deterministically replace or clear an incompatible selection according to the profile contract.
- [x] Unavailable selections are explained and rejected through commands, not merely hidden in the UI.
- [x] Product-invalid material/pattern combinations never reach price resolution even if an API response would be non-null.
- [x] Pattern and groove values reach a declared runtime test port and remain restorable; real visual bindings remain an issue 7 dependency.
- [x] Shared catalog allowlists preserve metadata and do not expose unrelated variants.
- [x] Unit and integration coverage includes all five patterns against both material families and legacy collection regressions.

## Blocked by

- Blocked by #plans/tricot-integration/02-custom-cabinets-and-pricing.issue.md

## Execution record — 2026-10-06

Status: Complete for the declared staged contracts.

Implemented material-dependent pattern eligibility, canonical Cannette/Cannete handling, compatible-selection preservation, deterministic invalid-pattern replacement, palette allowlists and metadata preservation. Both flows are exercised through commands and the real adapter using explicitly fake scene bindings. Invalid material/pattern choices are rejected before pricing. Runtime scopes and real visual behavior still require approval.
