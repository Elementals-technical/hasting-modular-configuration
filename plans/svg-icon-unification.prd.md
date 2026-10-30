# Lucide icon unification

## Status

Closed by user acceptance on 2026-10-12. The user approved the current `AppIcon` / `lucide-react` implementation and considers the task ready to close. This decision supersedes the proposed local SVG architecture and the original exhaustive completion criterion below.

The accepted implementation includes the icon inventory, shared stroke policy, migrated React icons, and the scene DOM adapter. Validation completed during implementation: TypeScript, production build, 2284 passing tests, and 53 browser rendering cases at each of 1440px, 900px, and 390px. Lint comparison found no new source issues; 91 errors and 3 warnings already existed.

Recorded artifacts: [icon inventory](../reports/icon-audit.csv) and [visual preview](../reports/icon-preview.html). Further portal-menu coverage, dedicated DOM-adapter regression tests, breakpoint-boundary checks, loader exception review, and comparison with the deployed application were not completed or claimed as verified. They are optional follow-up work rather than conditions for this accepted closure.

## Problem Statement

The configurator's interface icons have inconsistent visual weight and sizing. Some symbols use copied Lucide paths, others use custom stroked or filled SVGs, CSS shapes, or text glyphs. Different view boxes, hardcoded colors, fractional dimensions, and responsive CSS overrides make similar controls look different across desktop and mobile. Changing an SVG's displayed size can also change its visible stroke thickness.

The existing SVG-to-React tooling is already configured, but most interface icons still live in individual TSX components. There is no shared contract for the actual displayed stroke thickness. Users need consistent, recognizable controls that retain the Hastings appearance, and developers need one source of icon geometry that works in both React and imperative scene controls.

## Solution

Use named icons from `lucide-react` through the shared `AppIcon` component. The component applies the size-based stroke policy and `nonScalingStroke`; responsive hosts override the stroke through CSS variables where needed. Use `createSceneIcon` for imperative scene controls. The approved approach does not require a migration to locally stored SVG files.

Use these stroke widths in rendered CSS pixels:

| Context                                                 | Displayed icon size                  | Stroke width |
| ------------------------------------------------------- | ------------------------------------ | ------------ |
| Standard interface                                      | 20px and larger                      | 1.5px        |
| Standard interface                                      | Smaller than 20px, including 17–19px | 1.25px       |
| All Player controls in its existing mobile/compact mode | Any size                             | 1px          |

The Player exception includes toolbar actions, fullscreen, Help, Share, Generate Quote, object controls, and scene menus. The configurator navigation header follows the standard rule, including when its mobile layout places it inside the Player shell. Use the existing Player compact breakpoint of 1024px and below; narrower phone layouts retain their existing icon dimensions.

Preserve the meaning of each action, the Hastings colors, button dimensions, hit areas, and interaction states. Normalize icon geometry and remove accidental distortions without making every icon the same size. Use a small DOM adapter to render Lucide geometry in controls that the scene creates outside React.

## User Stories

1. As a configurator visitor, I want interface icons to have consistent visual weight, so that the controls look like one design system.
2. As a desktop visitor, I want icons displayed at 20px or larger to have a 1.5px stroke, so that large controls share the same appearance.
3. As a desktop visitor, I want smaller icons to have a 1.25px stroke, so that compact controls remain visually balanced.
4. As a mobile visitor, I want standard interface icons to follow the same size-based rule as desktop, so that the application remains consistent across devices.
5. As a mobile Player user, I want all Player control icons to have a 1px stroke, so that scene controls retain their intended lighter appearance.
6. As a tablet Player user, I want controls in the existing compact layout to use the mobile Player rule, so that the layout and icon treatment change together.
7. As a mobile visitor, I want navigation header icons to retain the standard stroke rule, so that navigation remains consistent with the rest of the interface.
8. As a visitor resizing the browser, I want icon strokes to update correctly when dimensions or layout mode change, so that an icon does not retain the wrong weight.
9. As a Player user, I want ruler and image-download icons to match adjacent toolbar icons, so that these actions do not appear disproportionately heavy.
10. As a Player user, I want zoom, undo, redo, AR, and fullscreen icons to use the same visual contract, so that the toolbar is cohesive.
11. As a Player user, I want Help, Share, and Generate Quote icons to remain recognizable and functional, so that visual changes do not interrupt my workflow.
12. As a scene user, I want object menus and overlay controls to match the Player toolbar, so that controls over the scene belong to the same visual system.
13. As a scene user, I want icons to render correctly in controls created outside React, so that imperative controls do not retain a different appearance.
14. As a configurator visitor, I want accordion, filter, and navigation icons to share the same Lucide style, so that controls remain familiar throughout configuration.
15. As a product shopper, I want preview and expand icons on product cards to remain proportionate, so that the card layout is clear without distorted symbols.
16. As a modal user, I want close controls to have consistent cross geometry, so that closing a dialog is immediately recognizable.
17. As a modal user, I want the close control's hover circle to remain a button state, so that the SVG symbol can stay reusable.
18. As a summary user, I want edit, information, copy, and external-link icons to match other interface icons, so that the final configuration screen is visually consistent.
19. As a quote user, I want interface symbols in quote and print views to use the shared catalog, so that exporting a configuration does not introduce unrelated icon styles.
20. As a keyboard user, I want focus indicators and keyboard activation to remain intact, so that the icon migration does not make controls harder to use.
21. As a screen-reader user, I want icon-only controls to retain descriptive accessible names, so that their actions are understandable without seeing the symbols.
22. As a screen-reader user, I want decorative icons next to button text to remain hidden from announcements, so that each action is announced once.
23. As a touch user, I want existing control hit areas to remain intact even when the visible symbol is small, so that controls remain easy to activate.
24. As a visitor, I want hover, pressed, disabled, and loading states to keep their existing behavior, so that the interface continues to communicate action state.
25. As a frontend developer, I want to use named Lucide icons through `AppIcon`, so that shared appearance rules are applied consistently.
26. As a frontend developer, I want shared styling rules for icon size, color, and weight, so that I do not recreate stroke calculations in each consumer.
27. As a frontend developer, I want icon strokes to stay constant when CSS resizes an SVG, so that responsive dimensions do not silently alter the intended weight.
28. As a scene developer, I want React and DOM controls to use official Lucide geometry and the shared stroke policy, so that both rendering paths look consistent.
29. As a scene developer, I want the DOM adapter to respect the control's owner document and window, so that controls also work in a separate document context.
30. As a maintainer, I want an inventory of migrated symbols and explicit graphic exceptions, so that unused assets and inconsistent legacy implementations can be identified.
31. As a maintainer, I want production SVG optimization to preserve the appearance contract, so that development and built output look the same.
32. As a reviewer, I want repeatable browser checks of actual dimensions and strokes, so that the visual requirements are verified beyond source attributes.
33. As a reviewer, I want the migration to preserve action handlers and control semantics, so that a visual cleanup cannot silently change configurator behavior.

## Implementation Decisions

- The implementation has three shared parts: `AppIcon` backed by named `lucide-react` imports, CSS variables for the appearance contract, and `createSceneIcon` for imperative scene controls.
- React consumers use `AppIcon` and the installed `lucide-react` dependency. This is the architecture approved by the user at closure.
- Retain the implemented architecture; replacing it with local SVG assets is not required for this task.
- Existing SVGR tooling remains available for other project assets; no additional SVG transformation pipeline is needed for the accepted icon approach.
- Select official Lucide equivalents by the action's meaning. Inventory every active interface symbol, including inline SVGs, filled custom icons, CSS symbols, text glyphs, and imperative DOM controls. Record the chosen mapping and exclusions before removing legacy assets.
- React symbol geometry comes from `lucide-react`; the DOM adapter contains the Lucide check and plus paths required by imperative controls. Standard Lucide icons retain their square 24-unit view box, round stroke caps and joins, and intended proportions. Consumers supply control colors.
- Treat stroke values as rendered CSS pixels. Apply non-scaling stroke behavior to the stroked graphic elements, not merely to the outer SVG. Preserve this behavior through SVGO and the DOM rendering path.
- Normalize asset attributes so that shared root styling can control stroke width; individual paths must not retain conflicting fixed widths. Do not bake compensation for one displayed size into a reusable SVG.
- CSS tokens express the standard small, standard large, and mobile Player stroke widths. Consumers declare their intended size through shared classes or tokens; responsive rules update the size category whenever displayed dimensions cross 20px. CSS does not infer numeric dimensions from arbitrary SVGs.
- Resolve the previously unspecified 17–19px range using the small-icon width of 1.25px. The Player mobile override takes precedence over size-based defaults.
- Apply the Player override through an explicit control context. Portaled Player menus carry this context, while configurator navigation controls retain the standard policy even if they share a shell or ancestor.
- Use the existing Player compact breakpoint of 1024px and below for the 1px exception. Preserve the existing narrower phone layout and legitimate context-specific dimensions.
- Preserve button bounds, spacing, alignment, hit areas, colors, focus, hover, pressed, disabled, and loading behavior. Correct accidental fractional dimensions or unequal scaling where they distort a symbol; icon normalization does not require a general button redesign.
- Keep hover backgrounds and close-button circles in the control's styles rather than inside reusable symbol geometry.
- The DOM adapter creates Lucide SVG nodes in the target owner document and applies dimensions, inherited color, accessibility attributes, and the shared stroke policy. Its owner-document stylesheet applies the compact Player stroke override.
- Imperative controls use their owner window's responsive state and update correctly when that state changes. Dispose listeners and generated nodes with the existing control lifecycle; avoid mounting a separate React root for each scene icon.
- Preserve existing event handlers and prevent duplicate activation when replacing icon nodes. The adapter owns rendering and appearance rather than configurator actions or scene geometry.
- Migrate navigation, accordion and filter controls, Player controls, scene overlays and menus, product cards, dialogs, summaries, support interface symbols, and quote/print interface symbols. Preserve dedicated brand and illustration assets as explicit exceptions.
- Decorative SVGs are non-focusable and hidden from assistive technology. Icon-only controls retain an accessible name on the interactive element. Standalone meaningful graphics retain appropriate image semantics.
- Remove obsolete icon implementations after checking ordinary imports, component-valued props, callbacks, and DOM construction. Temporary compatibility exports may support migration but must not preserve duplicate geometry in the completed result.
- Prefer Lucide symbols without IDs or definitions. If an asset needs IDs, ensure multiple rendered instances work correctly rather than assuming filename-based ID prefixing prevents all instance collisions.
- Keep the final production bundle limited to assets that consumers import. Do not add a runtime catalog lookup that includes every Lucide icon.

## Testing Decisions

The following matrix records the original proposed coverage. The Status section distinguishes completed validation from optional follow-up checks; this matrix is not an open completion gate after user acceptance.

- The proposed default is unit coverage of the DOM adapter plus repeatable browser checks of interface and scene rendering. This is the recommended option presented during planning; if the user selects manual browser validation, retain the same acceptance matrix as a documented manual check.
- Tests assert observable rendering and behavior rather than copied CSS declarations, exact source formatting, private helpers, or asset directory structure.
- DOM adapter tests cover creation in the correct owner document, expected symbol geometry, dimensions, inherited color, non-scaling strokes, standard and Player contexts, breakpoint updates, multiple instances, and cleanup. Verify that an existing action still activates exactly once.
- Extend existing scene-widget and React interaction tests where replacing a symbol could affect event propagation, accessible names, or keyboard behavior. Existing drawer-widget tests, accordion SVG integration tests, product-card interaction tests, and countertop-overlay tests provide useful prior art.
- Browser checks inspect rendered bounds and computed stroke behavior for 16px, 17–19px, 20px, and 24px icons. Include a CSS-driven size change so tests catch compensation that only works for a fixed SVG attribute.
- Exercise desktop, the compact boundary immediately above and at 1024px, and phone layouts around the existing narrower breakpoint. Resize in both directions and verify the standard header exception alongside 1px Player controls.
- Cover React-rendered icons, imperative scene controls, portaled menus, and a separate owner-document fixture where applicable. Validate each rendering path rather than assuming outer application CSS reaches every document.
- Check representative navigation, accordion/filter, product-card, modal-close, summary, toolbar, scene-menu, Help, Share, Generate Quote, and quote/print consumers. Exercise hover, pressed, focus, disabled, and loading states where they exist.
- Check that repeated SVG instances do not break, symbols stay square and unclipped, existing hit areas remain intact, and decorative icons do not create duplicate accessible announcements.
- Verify both development rendering and built output so optimization cannot remove the view box, non-scaling attributes, or color inheritance required by the contract.
- During implementation, run TypeScript, the relevant unit tests, lint for changed code, and the production build. Report existing unrelated lint failures separately. Review representative screenshots for optical alignment as well as inspecting computed values.
- Closure is based on the user's acceptance of the implemented icon migration and recorded validation. The broader proposed coverage is available for future work if requested.

## Out of Scope

- Hastings logos, brand artwork, decorative illustrations, and composite graphics such as the existing rotation illustration with embedded text. These are recorded as exceptions rather than forced into the Lucide stroke contract.
- Further changes to custom loading animations and spinners. The accepted migration already uses Lucide `LoaderCircle` with the existing loading animation.
- Scene geometry, selection outlines, dimension lines, drag polygons, and other graphics that are not interface control icons.
- Rebuilding the Button API, migrating the rest of the design system, changing focus policy, or redesigning layouts.
- Configuration data, backend behavior, scene commands, new actions, deployment, and publishing changes to production.

## Further Notes

- This PRD targets the current `fix/ui-bugs` workstream. The adjacent Base UI design-system branch supplies an existing SVGR precedent, not a requirement to transplant its Button implementation.
- The audit covers repository implementations. Comparison with the deployed application was not performed; the accepted closure is based on local implementation and validation.
- Lucide documents that SVG strokes normally scale with displayed size and provides non-scaling strokes to keep their visible width constant. The same requirement must be preserved in local SVG assets and responsive CSS. See [Lucide stroke-width documentation](https://lucide.dev/guide/react/basics/stroke-width).
- SVGR forwards component props to the root SVG, allowing direct imports to receive classes, dimensions, and accessibility attributes. Its optimization and view-box behavior still need to preserve the shared appearance contract. See [SVGR options](https://react-svgr.com/docs/options/).
- Preserve the applicable Lucide license attribution when vendoring SVG assets.
