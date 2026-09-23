import type { CustomizationOptionImages, CustomizationSchema } from "../../model/customizationSchema";
import { resolveCollectionImageUrl } from "../paths";

/**
 * Turns the `optionImages` references of a validated schema into URLs, the way the loader
 * already does for `presets.img`. A reference that escapes the collections root or is not
 * HTTPS throws, so a broken picture fails the collection rather than reaching a page.
 */
export const resolveCustomizationImageUrls = (
  schema: CustomizationSchema,
  manifestUrl: string,
  collectionsRootUrl: string,
): CustomizationSchema => {
  if (!schema.optionImages) return schema;

  const optionImages: CustomizationOptionImages = Object.fromEntries(
    Object.entries(schema.optionImages).map(([attributeId, byValue]) => [
      attributeId,
      Object.fromEntries(
        Object.entries(byValue).map(([value, reference]) => [
          value,
          resolveCollectionImageUrl(reference, manifestUrl, collectionsRootUrl),
        ]),
      ),
    ]),
  );

  return { ...schema, optionImages };
};
