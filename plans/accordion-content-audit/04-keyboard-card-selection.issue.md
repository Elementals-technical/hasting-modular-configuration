## What to build

AFK. Resolve audit finding 5: users can select product options and cabinet styles with native keyboard interaction and see selected and unavailable states. Selection, material preview, disabled-option recovery and Product Details are independent actions without nested interactive controls. Preserve Hastings card layout and hover behavior.

## Acceptance criteria

- [x] Available option and style selection works with mouse, Enter and Space.
- [x] Selected cards expose their state and keyboard focus is visible.
- [x] Unavailable cards cannot select; mixing-restricted styles keep their confirmation flow.
- [x] Preview and recovery buttons have accessible names and do not select the card.
- [x] Product Details remains a real independent link; selection buttons contain no buttons or links.
- [x] Meaningful interaction tests cover selection and independent actions.

## Blocked by

- Blocked by #plans/accordion-content-audit/03-hastings-tokens.issue.md

## Validation

Chrome: native Enter/Space selection, keyboard preview, unavailable guards and mixing-restricted confirmation. Eight interaction tests cover independent actions, selected state and loading.
