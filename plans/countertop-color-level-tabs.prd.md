# Countertop color level tabs

## Problem Statement

The countertop color step already lets a shopper switch between the upper countertop color controls and the lower cover-countertop color controls, but the current selector does not match the approved Hastings design. It is presented as a basic pair of radio labels with a visible legend, rectangular borders, spacing between the options, a dark selected state, and no visual diagrams. This differs materially from the compact pill-shaped Upper/Lower control in the Figma design.

The current control also implements tab-like behavior without tab semantics. It swaps two related panels, yet exposes the choices as a radio group and manually manages the selected panel. Keyboard interaction, panel relationships, focus behavior, and future animation would therefore need to be maintained locally.

The updated selector must reproduce the approved design while preserving the existing countertop behavior, lower-color integration, processing behavior, errors, and accessibility. Switching between panels must not reset the filters a shopper has already selected in either color panel.

## Solution

Replace the custom radio selector with Base UI Tabs configured as a controlled two-tab interface. Render Upper and Lower as equal-width tabs within a responsive, 40-pixel-high pill. Use a Base UI tab indicator as the selected background and animate it horizontally between the two tabs. Keep both panels mounted so their independent filter state survives tab switches, while only the active panel is exposed to the user.

Use the exact Upper and Lower diagram SVGs exported from the approved Figma component. Store those assets in the project and import them as React components through the existing SVGR pipeline. The diagrams are decorative; the visible tab labels and Base UI semantics provide the accessible names.

The selector appears only when the lower countertop color field is available. Upper is selected initially and becomes selected again whenever Lower becomes unavailable. Existing color selection, swatch ordering, error reporting, and processing behavior remain unchanged.

## User Stories

1. As a countertop shopper, I want the Upper/Lower selector to match the approved Hastings design, so that the configurator feels visually consistent.
2. As a countertop shopper, I want to understand visually which countertop level I am editing, so that I do not apply a finish to the wrong surface.
3. As a countertop shopper, I want an Upper diagram next to the Upper label, so that the option is recognizable beyond its text.
4. As a countertop shopper, I want a Lower diagram next to the Lower label, so that the option is recognizable beyond its text.
5. As a countertop shopper, I want the active level to have a clear filled background, so that the current context is immediately apparent.
6. As a countertop shopper, I want the active background to move smoothly between levels, so that the relationship between the control and the newly shown panel is clear.
7. As a motion-sensitive shopper, I want nonessential motion removed when reduced motion is requested, so that the selector remains comfortable to use.
8. As a shopper, I want the color panel itself to change immediately, so that a large swatch grid does not slide or fade unnecessarily.
9. As a shopper, I want my Upper filters to remain selected after I visit Lower and return, so that I do not have to rebuild my filtered view.
10. As a shopper, I want my Lower filters to remain selected after I visit Upper and return, so that each countertop level preserves its working context.
11. As a shopper, I want Upper to be selected when the countertop step first opens, so that the primary countertop controls remain the default.
12. As a shopper, I want the interface to return to Upper when Lower becomes unavailable, so that I am never left on a panel that no longer exists.
13. As a shopper, I want Upper to remain selected if Lower later becomes available again, so that configuration changes do not unexpectedly restore a stale context.
14. As a shopper whose configuration has no lower countertop field, I want to see the existing Upper controls without an irrelevant selector, so that the interface stays concise.
15. As a mouse user, I want a subtle hover response on an inactive tab, so that I can tell it is interactive.
16. As a keyboard user, I want the project-standard focus indicator, so that I can locate the focused tab consistently with the rest of the configurator.
17. As a keyboard user, I want Left and Right Arrow to move to and activate the adjacent countertop level, so that the two-option selector is fast to operate.
18. As a keyboard user, I want focus to wrap between the two tabs, so that either direction remains useful at the ends of the list.
19. As a screen-reader user, I want the control announced as a labeled tab list with related tab panels, so that its structure and current selection are clear.
20. As a screen-reader user, I want each diagram hidden from accessibility APIs, so that Upper and Lower are not announced twice or with meaningless graphic descriptions.
21. As a shopper on a narrow screen, I want the selector to fit the available sidebar width, so that neither label nor diagram is clipped by a desktop-only width.
22. As a shopper on a wide screen, I want both choices to remain equal in width, so that the segmented control stays visually balanced.
23. As a shopper, I want lower-color changes to continue using the existing change handler, so that the visual redesign does not alter the product configuration.
24. As a shopper, I want the existing swatch-order action to work from either level, so that this redesign does not interrupt the ordering workflow.
25. As a shopper, I want lower-color errors to remain associated with the Lower experience, so that failures are presented in the relevant context.
26. As a shopper, I want the existing processing behavior to remain intact, so that asynchronous configuration changes behave as they did before the redesign.
27. As a developer, I want the interaction primitives supplied by the installed Base UI package, so that focus, keyboard, and tab-panel relationships do not depend on bespoke code.
28. As a developer, I want exact project-owned SVG exports rather than temporary Figma URLs or approximate icon-library substitutions, so that the design remains stable after implementation.
29. As a developer, I want the existing SVGR pipeline to compile the diagrams into React components, so that no new asset dependency or inline SVG wrapper is needed.
30. As a maintainer, I want the implementation kept local to the countertop level picker, so that a one-off visual pattern does not create an unproven shared abstraction.
31. As a maintainer, I want tests to assert user-observable tab behavior rather than Base UI internals, so that dependency implementation details can change without breaking valid tests.
32. As a reviewer, I want automated coverage for mouse, keyboard, availability, retained state, and routing to the correct color handler, so that the redesign cannot silently change behavior.
33. As a reviewer, I want the final rendered control checked against the approved Figma nodes, so that numerical CSS compliance is backed by visual comparison.

## Implementation Decisions

- Build the selector directly from Base UI Tabs Root, List, Tab, Indicator, and Panel primitives from the already installed package version. Do not introduce another component library or upgrade Base UI as part of this work.
- Keep the tab value controlled by the countertop level picker. The allowed values remain Upper and Lower, with Upper as the initial value.
- Enable activation on focus for the tab list. Left and Right Arrow therefore both move focus and activate the next tab. Retain Base UI's wrapping keyboard navigation.
- Keep both panels mounted while the tab interface is present. This preserves the independent local filter state owned by each color field. Hidden panels must remain noninteractive and hidden according to Base UI tab-panel semantics.
- Render the selector only when a lower countertop color field is available. Without that field, render the existing Upper content directly and do not expose an empty tab interface.
- Reset the controlled value to Upper whenever the lower field becomes unavailable. If the lower field becomes available again, do not restore a previously active Lower value.
- Preserve the current processing contract. Do not add a new loading appearance, new processing behavior, or new Threekit operation. Existing protection applied to the selector and lower controls remains behaviorally unchanged.
- Preserve the existing lower-color change callback, swatch-order callback, error value, and child-content interface. This is a presentation and interaction-primitive change, not a domain API redesign.
- Make the selector fill its available container width rather than assigning the 520-pixel Figma width directly. The two tabs each occupy half of the available width.
- Keep the control height at 40 pixels. Use a white base, a one-pixel `#E5E6EA` border, clipped pill geometry, and a fully rounded outer radius.
- Render the active background as a Base UI tab indicator using `#F1EBE6`. Position it behind the tab contents and size it to the active half of the control.
- Animate only the indicator's horizontal position and size-related properties. Use a short 180-millisecond ease-out transition. Disable the transition under `prefers-reduced-motion: reduce`.
- Do not animate, slide, or fade the color panels. Panel content changes immediately when a tab is activated.
- Apply a subtle neutral hover background only to the inactive tab. The active indicator remains the dominant selected treatment.
- Use the project's existing focus-ring variables and conventions for `focus-visible`. Do not invent a countertop-specific focus color or suppress the native accessible focus path.
- Use Poppins at 14 pixels with a 20-pixel line height and the base text color `#282828`. Use regular weight for inactive labels and medium weight for the active label.
- Center each label and diagram as a single row with a 12-pixel gap. Use the Figma dimensions of 48 by 24 pixels for each diagram and retain the designed internal geometry.
- Export the exact Upper and Lower diagram assets from the approved Figma component. Store them as local SVG files owned by the countertop widget and import them with the existing `?react` SVGR convention.
- Do not use remote Figma asset URLs at runtime. Do not replace these product-specific diagrams with Lucide icons or recreate them with CSS.
- Mark both diagram components as decorative and non-focusable. The text labels remain the accessible tab names.
- Label the tab list as “Countertop level” without adding the visible legend that is absent from the approved design.
- Style active and inactive state from Base UI state attributes. Keep tab buttons above the indicator so labels and diagrams remain visible during movement.
- Keep the implementation local to the countertop picker and its stylesheet. Do not extract a generic segmented-tabs component until another consumer demonstrates the same API and visual contract.
- Update the existing countertop level picker tests to use tab semantics instead of querying radio inputs. Avoid assertions against Base UI's private DOM structure or CSS-generated positioning.

## Testing Decisions

- Tests must assert externally observable behavior: accessible roles and names, visible panel content, preserved user state, callback routing, keyboard behavior, availability changes, errors, and disabled behavior. They must not assert Base UI hook calls, internal IDs, private context, exact element nesting, or implementation-specific transform values.
- Extend the existing countertop level picker test suite rather than creating a parallel suite for the same component. Its existing Upper/Lower handler-routing and lower-field-availability scenarios are the primary prior art.
- Verify that Upper is the active tab initially and that the Upper panel is exposed while the Lower panel is hidden.
- Verify that clicking Lower exposes the Lower color controls and sends lower swatch selections only to the lower-color callback.
- Verify that returning to Upper exposes the original child controls and sends Upper swatch selections only through their existing handler.
- Verify that both panels remain mounted across Upper/Lower switches and that representative local filter state in each panel survives a round trip. Assert the retained user-facing selection, not the presence of a `keepMounted` prop.
- Verify that Right Arrow and Left Arrow move focus and immediately activate the corresponding tab. Include wrapping between the first and last tab.
- Verify accessible tab-list, tab, and tab-panel roles and their names. Confirm decorative diagrams do not alter the accessible tab names.
- Verify that the selector is absent when the lower field is unavailable and that the Upper controls remain available.
- Verify that making the lower field unavailable while Lower is selected immediately exposes Upper. When the lower field becomes available again, verify Upper is still selected.
- Verify that the existing processing input preserves its current observable behavior. Do not add assertions for a new opacity, spinner, or loading label.
- Verify that a lower-color error is presented as an alert in the relevant Lower context and does not replace the Upper content.
- Verify that swatch-order behavior remains connected for the Lower color field. Existing broader color-field tests continue to own the swatch-order interface itself.
- Do not unit-test transition timing or pixel geometry in the DOM test environment. Review the indicator movement, hover, focus, reduced-motion behavior, responsive width, icon rendering, and alignment in a browser.
- Compare the desktop rendering against the approved full-screen Figma node and the isolated selector node. Check the 40-pixel height, equal halves, pill clipping, border, active fill, typography, 12-pixel content gap, and 48-by-24 diagrams.
- Check at least one narrow sidebar/mobile width to verify the selector remains fluid without overflow or clipping.
- During implementation, run the focused countertop picker tests, TypeScript validation, linting for the changed code, and the production build. Report unrelated existing failures separately and do not introduce new changed-file failures.

## Out of Scope

- Redesigning the countertop color cards, filters, full-mode panel, swatch-order interface, accordion sections, sidebar, Player, header, or bottom navigation.
- Changing available countertop colors, material groups, filter algorithms, sorting, SKU resolution, pricing, configuration ownership, or compatibility rules.
- Changing the Threekit command pipeline, evaluation behavior, scene assets, or 3D countertop rendering.
- Creating a general-purpose segmented control or refactoring the existing application-wide mode switcher.
- Replacing other radio groups, tabs, toggles, or switchers with Base UI.
- Introducing panel slide or fade animations.
- Adding a new loading treatment or changing the established processing contract.
- Persisting the active level in Redux, URL state, saved configurations, browser storage, or analytics.
- Adding new mobile-specific content, labels, icon substitutions, or alternate layouts beyond fluid sizing.
- Upgrading Base UI, Vite, SVGR, React, Sass, or any other dependency.
- Publishing, deployment, or changes to the Figma source file.

## Further Notes

- The approved full-screen design reference is the “Module Configurator - Prebuild - Cofigurator - Countertop - Countertop Color” Figma node `3431:9848` in the Hastings Module Configurator file.
- The approved isolated selector and source diagrams are in Figma node `3431:9926` in the same file.
- The full-screen reference shows the selector inside a 520-pixel content area. The implementation treats that value as parent layout output and remains fluid within its actual container.
- The repository already contains Base UI, SVGR, React, TypeScript, CSS Modules with Sass, Poppins fonts, and shared focus and border tokens required for this work.
- Base UI Tabs is selected because Upper and Lower control two related content panels. Radio Group would model form input rather than panel navigation, while Toggle Group could allow a pressed-state interpretation that is weaker than the actual tab-panel relationship.
- The design review explicitly approved project-owned Figma SVG exports for these two product-specific diagrams even though many general interface actions elsewhere use Lucide icons.
