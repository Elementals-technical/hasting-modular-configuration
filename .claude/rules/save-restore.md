---
paths:
  - "src/features/saveConfiguration/**"
  - "src/features/configurationRestore/**"
  - "src/pages/restore/**"
  - "src/shared/lib/analytics/**"
  - "src/entities/configuration/api/**"
  - "src/entities/history/**"
---

# Save, restore and host rules

## Save

- Build a save payload only with `useBuildConfigurationRequest`, or save through `useSaveCurrentConfiguration`; never assemble `{ configuration, metadata }` by hand. Enforced by: `saveEntryPoints.test.tsx` and the save-restore round-trip tests.
- `hostUrl` never enters the payload, and the dedupe hash ignores `savedAt`.

## Restore

- Validate the whole saved payload before touching the scene: a payload that fails leaves the composition as it is.
- Restore status lives in the store, not a ref, so a StrictMode remount doesn't restore twice.
- A saved configuration with no collection field is legacy USH; a present but empty one is a blocking error, never a silent USH. A restore that changes the collection reloads the app.
- `pushSnapshot` is ignored while a restore runs, and a restore ends with `clearHistory()` and one `pushSnapshot`.

## Host page

- Everything bound for the parent page goes through `trackModularKeyEvent` in `src/shared/lib/analytics/modularKeyEvents.ts`, which posts only when framed; a new event goes into `MODULAR_KEY_EVENT_NAMES`.
- Google Analytics starts only through `initGoogleAnalytics`, gated by `VITE_ANALYTICS_ENABLED === "true"`; forwarding to the parent is not gated.
- `collectionId` is read once, when the provider mounts. URL parameter names come from the constants in `src/features/saveConfiguration/lib/configurationUrlParams.ts`.
