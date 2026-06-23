# Parent configurator integration

Документація описує контракт між parent/client configurator page і Hastings modular configurator iframe.

## Учасники

| Частина                            | URL або шлях                                                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Parent/client configurator project | `/Users/personal/Desktop/elementals/hasting/viewer-3kit-hastings`                                             |
| Modular configurator project       | `/Users/personal/Desktop/elementals/Hasting-modular-config/hasting-modular-configuration`                     |
| Modular public origin              | `https://hastings-modular.vivid3d.tech`                                                                       |
| Parent public product page         | `https://www-hastingsbathcollection-com.sandbox.hs-sites.com/products/vanities-urban-standard-height-modular` |

## Query params

| Param      | Де використовується                    | Призначення                                                      |
| ---------- | -------------------------------------- | ---------------------------------------------------------------- |
| `configId` | Parent public URL і modular iframe URL | ID збереженої modular configuration                              |
| `hostUrl`  | Тільки modular iframe URL              | Parent page URL, від якого modular має будувати public share URL |
| `tkcsid`   | Не використовується modular flow       | Зарезервовано для основного product configurator restore         |

`hostUrl` завжди має бути URL parent сторінки, де відкритий configurator. Він не має містити `/restore`, не має бути modular domain і не має містити поточний `configId`.

Правильно:

```text
hostUrl=https://www-hastingsbathcollection-com.sandbox.hs-sites.com/products/vanities-urban-standard-height-modular
```

Неправильно:

```text
hostUrl=https://www-hastingsbathcollection-com.sandbox.hs-sites.com/products/vanities-urban-standard-height-modular/restore?configId=8088
hostUrl=https://hastings-modular.vivid3d.tech/prebuilt/model
```

## URL contract

### Public share URL

Це URL, який отримує користувач після Share/Save:

```text
https://www-hastingsbathcollection-com.sandbox.hs-sites.com/products/vanities-urban-standard-height-modular?configId=8088
```

Public URL завжди веде на parent/client site. Він не містить `/restore`.

### New configuration iframe URL

Parent відкриває modular iframe і передає `hostUrl`:

```text
https://hastings-modular.vivid3d.tech/prebuilt/model?hostUrl=https%3A%2F%2Fwww-hastingsbathcollection-com.sandbox.hs-sites.com%2Fproducts%2Fvanities-urban-standard-height-modular
```

### Restore iframe URL

Якщо parent page має `?configId=8088`, parent відкриває iframe на internal modular route:

```text
https://hastings-modular.vivid3d.tech/restore?configId=8088&hostUrl=https%3A%2F%2Fwww-hastingsbathcollection-com.sandbox.hs-sites.com%2Fproducts%2Fvanities-urban-standard-height-modular
```

`/restore` існує тільки в modular app. Parent site не повинен мати `/restore` route.

## Iframe integration quickstart

Parent page керує тільки двома речами:

1. Відкриває iframe з правильним modular URL.
2. Передає в modular iframe `hostUrl`, тобто URL parent сторінки, який треба використовувати для майбутнього share link.

Parent page не має читати modular state, не має визначати custom/prebuilt для saved configuration і не має відкривати `/custom` або `/prebuilt` при restore. Для restore parent завжди відкриває modular `/restore`.

### Minimal iframe helper

```js
const MODULAR_ORIGIN = "https://hastings-modular.vivid3d.tech";
const CONFIG_ID_PARAM = "configId";
const HOST_URL_PARAM = "hostUrl";

function buildHostUrl(sourceUrl = window.location.href) {
  const hostUrl = new URL(sourceUrl);
  hostUrl.searchParams.delete(CONFIG_ID_PARAM);
  return hostUrl.toString();
}

function buildModularIframeUrl({ path, configId, hostUrl = buildHostUrl() }) {
  const iframeUrl = new URL(path, MODULAR_ORIGIN);

  if (configId) {
    iframeUrl.searchParams.set(CONFIG_ID_PARAM, configId);
  }

  iframeUrl.searchParams.set(HOST_URL_PARAM, hostUrl);
  return iframeUrl.toString();
}
```

`buildHostUrl()` intentionally removes only `configId`. If the parent page needs other query params for routing, language, campaign, product context, or CMS state, keep them in `hostUrl`.

### Render iframe

```html
<iframe
  src="https://hastings-modular.vivid3d.tech/prebuilt/model?hostUrl=..."
  title="Hastings Modular Configurator"
  allow="clipboard-write; fullscreen"
></iframe>
```

The exact modal styling is parent-owned. The important integration point is the iframe `src`.

### Open new prebuilt flow

Use this when the user starts Quick Configure / prebuilt model selection:

```js
const iframeSrc = buildModularIframeUrl({
  path: "/prebuilt/model",
});
```

Result:

```text
https://hastings-modular.vivid3d.tech/prebuilt/model?hostUrl=<encoded parent URL>
```

### Open new custom flow directly

Use this when parent has a CTA that should start directly in the custom builder:

```js
const iframeSrc = buildModularIframeUrl({
  path: "/custom/cabinet-builder",
});
```

Result:

```text
https://hastings-modular.vivid3d.tech/custom/cabinet-builder?hostUrl=<encoded parent URL>
```

### Open custom/prebuilt URL returned by API

If parent receives a full modular URL from API, for example `customModeUrl`, do not rebuild its path manually. Append or replace only `hostUrl`:

```js
function appendHostUrlToModularUrl(sourceUrl, hostUrl = buildHostUrl()) {
  const iframeUrl = new URL(sourceUrl);
  iframeUrl.searchParams.set(HOST_URL_PARAM, hostUrl);
  return iframeUrl.toString();
}

const iframeSrc = appendHostUrlToModularUrl(customModeUrl);
```

This preserves existing modular query params such as preset/model context.

### Restore saved configuration

When the parent page URL contains `configId`, auto-open iframe on `/restore`.

Parent public URL:

```text
https://www-hastingsbathcollection-com.sandbox.hs-sites.com/products/vanities-urban-standard-height-modular?configId=8088
```

Parent iframe URL:

```js
const configId = new URLSearchParams(window.location.search).get(CONFIG_ID_PARAM);

if (configId) {
  const iframeSrc = buildModularIframeUrl({
    path: "/restore",
    configId,
  });
}
```

Result:

```text
https://hastings-modular.vivid3d.tech/restore?configId=8088&hostUrl=<encoded parent URL>
```

The modular app fetches saved configuration `8088`, reads `metadata.path`, and redirects inside the iframe to the correct page:

| Saved configuration type | Parent iframe starts at | Modular redirects inside iframe |
| ------------------------ | ----------------------- | ------------------------------- |
| Custom                   | `/restore?configId=...` | `/custom/cabinet-builder?...`   |
| Prebuilt                 | `/restore?configId=...` | `/prebuilt/model?...`           |

Do not route the parent site to `/restore`. Do not add `/restore` to `hostUrl`.

### Build public share URL from modular

Modular receives `hostUrl` from its own iframe URL:

```js
const hostUrl = new URLSearchParams(window.location.search).get("hostUrl");
```

After save returns `configId`, modular builds the public URL:

```js
const publicUrl = new URL(hostUrl);
publicUrl.searchParams.set("configId", configId);
```

Expected public URL:

```text
https://www-hastingsbathcollection-com.sandbox.hs-sites.com/products/vanities-urban-standard-height-modular?configId=8088
```

## Flow

### Share/Save flow

```text
1. Parent opens modular iframe with hostUrl.
2. User configures product in modular iframe.
3. Modular saves configuration through the existing saveConfiguration API.
4. Saved record contains metadata.path.
5. Modular receives configId.
6. Modular builds public URL from hostUrl:
   hostUrl + ?configId=<configId>
7. Share popup shows the parent public URL.
```

### Restore flow

```text
1. User opens parent public URL with ?configId=8088.
2. Parent reads configId from the current page URL.
3. Parent opens iframe:
   https://hastings-modular.vivid3d.tech/restore?configId=8088&hostUrl=<encoded parent URL>
4. Modular /restore fetches saved configuration by configId.
5. Modular reads metadata.path.
6. If metadata.path starts with /custom, modular redirects inside iframe to:
   /custom/cabinet-builder?configId=8088&hostUrl=<encoded parent URL>
7. If metadata.path starts with /prebuilt, modular redirects inside iframe to:
   /prebuilt/model?configId=8088&hostUrl=<encoded parent URL>
8. Existing custom/prebuilt pages restore scene data by configId.
```

If an older saved configuration has no `metadata.path`, `/restore` falls back to prebuilt.

## Parent project integration points

Parent project:

```text
/Users/personal/Desktop/elementals/hasting/viewer-3kit-hastings
```

| File                                                                                        | Responsibility                                                                                   |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `src/utils/modularConfiguratorUrl.js`                                                       | Builds modular iframe URLs and always appends `hostUrl`. Uses `/restore` when `configId` exists. |
| `src/Components/QuickConfigureTabs/QuickConfigureTabs.jsx`                                  | Reads `configId` from parent page URL and auto-opens modular iframe modal.                       |
| `src/Components/ModularConfiguratorIframeModal/ModularConfiguratorIframeModal.jsx`          | Renders iframe modal.                                                                            |
| `src/Components/configuration-control/CombinedFiltering/PrebuiltPresetCustomizeControl.jsx` | Adds `hostUrl` to prebuilt custom mode URLs.                                                     |
| `src/constant.js`                                                                           | Contains `MODULAR_CONFIGURATOR_BASE_URL`.                                                        |

Parent should build iframe URLs with `URL` and `URLSearchParams`, not manual string concatenation:

```js
const hostUrl = new URL(window.location.href);
hostUrl.searchParams.delete("configId");

const iframeUrl = new URL("https://hastings-modular.vivid3d.tech/restore");
iframeUrl.searchParams.set("configId", configId);
iframeUrl.searchParams.set("hostUrl", hostUrl.toString());
```

`URLSearchParams.set()` handles encoding. Do not pre-encode `hostUrl` manually before passing it to `set()`.

## Modular project integration points

Modular project:

```text
/Users/personal/Desktop/elementals/Hasting-modular-config/hasting-modular-configuration
```

| File                                                               | Responsibility                                                                                                  |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `src/features/saveConfiguration/lib/configurationUrlParams.ts`     | Reads and persists `hostUrl`, reads `configId`, builds public parent share URL.                                 |
| `src/features/saveConfiguration/lib/buildConfigurationMetadata.ts` | Stores `metadata.path`, `uiState`, product order, and swatch order.                                             |
| `src/features/saveConfiguration/lib/buildConfigurationShareUrl.ts` | Returns `hostUrl?configId=<id>` when `hostUrl` is available. Fallback returns modular `/restore?configId=<id>`. |
| `src/pages/restore/RestoreConfigurationPage.tsx`                   | Resolves saved `metadata.path` and redirects to custom/prebuilt restore page.                                   |
| `src/pages/prebuilt/model/ModelPage.tsx`                           | Existing prebuilt restore by `configId`.                                                                        |
| `src/pages/custom/cabinetBuilder/CabinetBuilderPage.tsx`           | Existing custom restore by `configId`.                                                                          |
| `src/app/router/routerConfig.tsx`                                  | Registers `/restore`.                                                                                           |
| `src/shared/config/routes.ts`                                      | Defines `ROUTES.RESTORE`.                                                                                       |

## Save metadata contract

Every saved modular configuration must include:

```ts
{
  metadata: {
    path: string;
    savedAt: string;
    orderedProductIds: string[];
    uiState: Record<string, string>;
    swatchOrder: Record<string, unknown>;
  }
}
```

`metadata.path` is the source of truth for restore type:

| Saved path              | Restore target             |
| ----------------------- | -------------------------- |
| starts with `/custom`   | `/custom/cabinet-builder`  |
| starts with `/prebuilt` | `/prebuilt/model`          |
| missing or unknown      | `/prebuilt/model` fallback |

Do not add `mode=custom|prebuilt` to the public URL. It duplicates data and can drift from the saved configuration.

## Deployment requirements

Both projects must be deployed together:

1. Deploy parent bundle to HubSpot/client page.
2. Deploy modular app to `https://hastings-modular.vivid3d.tech`.

If only parent is deployed, iframe URLs may point to `/restore` but modular may not have that route.

If only modular is deployed, Share/Save may work internally but parent will not pass `hostUrl`, so public URLs can fall back to modular domain.

## Manual QA checklist

### New prebuilt configuration

1. Open parent product page without query params.
2. Open Quick Configure.
3. Save/share from modular iframe.
4. Expected share URL:

```text
https://www-hastingsbathcollection-com.sandbox.hs-sites.com/products/vanities-urban-standard-height-modular?configId=<id>
```

### New custom configuration

1. Open Create Your Own or Customize from prebuilt card.
2. Save/share from custom flow.
3. Expected share URL:

```text
https://www-hastingsbathcollection-com.sandbox.hs-sites.com/products/vanities-urban-standard-height-modular?configId=<id>
```

### Restore prebuilt

1. Open parent URL with a prebuilt `configId`.
2. Parent should auto-open modal.
3. Iframe should start on `/restore`, then redirect to `/prebuilt/model`.
4. Scene should restore from saved configuration.

### Restore custom

1. Open parent URL with a custom `configId`.
2. Parent should auto-open modal.
3. Iframe should start on `/restore`, then redirect to `/custom/cabinet-builder`.
4. Scene should restore from saved configuration.

## Debugging

Inside the iframe console:

```js
new URLSearchParams(window.location.search).get("hostUrl");
sessionStorage.getItem("hastingsModularConfiguratorHostUrl");
new URLSearchParams(window.location.search).get("configId");
```

Expected:

- `hostUrl` is present on the initial iframe URL.
- `hostUrl` remains available after internal redirects through sessionStorage or query params.
- `configId` is present on restore URLs.

Common failures:

| Symptom                                             | Likely cause                                                                                      |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Share URL points to `hastings-modular.vivid3d.tech` | Parent did not pass `hostUrl`, or old modular build is deployed.                                  |
| Parent URL contains `/restore`                      | `hostUrl` was built incorrectly. `/restore` belongs only to modular iframe URL.                   |
| Parent page does not auto-open modal                | Parent build does not read `configId`, or wrong product page is deployed.                         |
| Custom saved configuration opens as prebuilt        | Saved record has missing/incorrect `metadata.path`, or old modular save build created the record. |
