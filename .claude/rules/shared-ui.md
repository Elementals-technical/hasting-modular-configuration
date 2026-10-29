---
paths:
  - "src/shared/ui/**"
  - "src/shared/assets/**"
---

# Shared UI rules

- A kit component gets its own folder, `shared/ui/<Name>/<Name>.tsx` with `<Name>.module.scss`; a part of an existing family (`Popups`, `Accordion`, `Filter`) goes into that family's folder.
- Kit components are driven by props: no Redux, no collection hooks. The one context they may read is `useReasonText()`.
- A third-party UI primitive is wrapped once, in the kit (`Accordion` over Radix, the `Popups` family over `react-transition-group`), and consumers use the wrapper.
- Build a modal on the `Popups` family, `PopupOverlay` with `PopupCenterContent` or `PopupRightContent`, and keep the family's prop names `isOpening` and `onClose`.
- An icon is a React component, `shared/assets/images/svg/<Name>Icon.tsx`, imported as `@/shared/assets/images/svg/<Name>Icon` without an extension.
- A bundled raster image lives under `shared/assets/images/` (`png/`, `jpeg/`, `materials/`), is ES-imported through `@/shared/assets/…` and rendered with `<img>`. Collection images are package data under `public/collections/<id>/images/`, never bundled.
