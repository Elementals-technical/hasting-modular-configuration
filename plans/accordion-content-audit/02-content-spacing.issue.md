## What to build

AFK. Resolve audit finding 3: Accordion.Content owns panel padding, while each field or section owns spacing between its content blocks. Filter rows and multi-field sections retain Hastings spacing regardless of fragments, wrapper elements or hidden fields. Mobile filter rows align with the accordion edges.

## Acceptance criteria

- [x] ContentText no longer targets the second direct div for margins.
- [x] Cabinet colors, countertop, accessories and generic fields declare their own spacing.
- [x] Single and multiple fields render consistently, including conditional fields.
- [x] Desktop and mobile filters align with panel edges without accidental clipping.

## Blocked by

- Blocked by #plans/accordion-content-audit/01-single-scroll.issue.md

## Validation

Chrome: filter edges align at all six viewports. Existing cabinet, countertop, accessory and generic-field integration tests pass.
