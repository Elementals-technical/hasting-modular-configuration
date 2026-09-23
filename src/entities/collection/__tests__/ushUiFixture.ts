import ushUiDocument from "../../../../public/collections/urban-standard-height/ui.json";

import { resolveCustomizationImageUrls } from "../lib/customization/resolveCustomizationImageUrls";
import { validateCustomizationSchema } from "../lib/customization/validateCustomizationSchema";
import type { CustomizationSchema } from "../model/customizationSchema";

/** The root `buildReadyCollection` uses, so a fixture URL reads the same in either helper. */
const rootUrl = "https://app.test/collections/";

/**
 * The production USH ui.json, validated and with its image references resolved, exactly as the
 * loader hands it to a page.
 *
 * Tests read the shipped document, so a picture removed from the collection shows up as a
 * failing expectation rather than passing against a stale copy.
 */
export const ushCustomizationSchema: CustomizationSchema = (() => {
  const result = validateCustomizationSchema(ushUiDocument);

  if (!result.ok) {
    throw new Error(
      `Packaged USH ui.json failed validation: ${result.diagnostics.map(({ dataPath }) => dataPath).join(", ")}`,
    );
  }

  return resolveCustomizationImageUrls(result.schema, `${rootUrl}urban-standard-height/manifest.json`, rootUrl);
})();
