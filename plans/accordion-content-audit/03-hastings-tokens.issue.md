## What to build

AFK. Resolve audit finding 4: replace undefined Radix demo colors in the Base UI accordion with defined Hastings tokens. Keep typography, compact sizes and opening animation. Keyboard focus stays visible, while unavailable or hovered controls receive intentional states.

## Acceptance criteria

- [x] Accordion styles have no undefined mauve, violet or black-alpha variables.
- [x] Default, hover and keyboard focus colors resolve to Hastings tokens.
- [x] Trigger keyboard interaction, expanded state and reduced-motion behavior remain intact.

## Blocked by

None - can start immediately.

## Validation

Chrome: keyboard focus, Hastings text color, original 500 font weight and reduced motion. Existing seven Base UI accordion tests pass.
