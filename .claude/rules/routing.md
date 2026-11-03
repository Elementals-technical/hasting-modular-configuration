---
paths:
  - "src/app/router/**"
  - "src/pages/index.ts"
  - "src/features/collectionCustomization/lib/buildStepRoutes.ts"
---

# Routing rules

- Configurator steps are built at runtime from the collection's `ui.json` by `buildStepRoutes`; a new screen kind is mapped in `app/router/stepScreens.tsx`, whose record must cover every kind and screen id. Enforced by: `tsc`.
- Only the Prebuilt and Custom flows sit under `CollectionRouterRoot`, the collection gate; Restore and AR stay outside it. Enforced by: `routerCollectionScope.test.tsx`.
- `app/router` imports pages only through the `@/pages` barrel, the path the router tests mock.
- A flow entry redirect keeps the query string, `collectionId` included.
