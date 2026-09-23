import type {
  CustomizationOptionImages,
  CustomizationSchema,
  OptionImageVariants,
} from "../../model/customizationSchema";
import { resolveCollectionImageUrl } from "../paths";

/**
 * Turns the picture references of a validated schema into URLs, the way the loader already does
 * for `presets.img`. A reference that escapes the collections root or is not HTTPS throws, so a
 * broken picture fails the collection rather than reaching a page.
 */
export const resolveCustomizationImageUrls = (
  schema: CustomizationSchema,
  manifestUrl: string,
  collectionsRootUrl: string,
): CustomizationSchema => {
  const resolve = (reference: string) => resolveCollectionImageUrl(reference, manifestUrl, collectionsRootUrl);

  const optionImages: CustomizationOptionImages | undefined = schema.optionImages
    ? Object.fromEntries(
        Object.entries(schema.optionImages).map(([attributeId, byValue]) => [
          attributeId,
          Object.fromEntries(Object.entries(byValue).map(([value, reference]) => [value, resolve(reference)])),
        ]),
      )
    : undefined;

  const optionImageVariants: OptionImageVariants | undefined = schema.optionImageVariants
    ? Object.fromEntries(
        Object.entries(schema.optionImageVariants).map(([attributeId, rows]) => [
          attributeId,
          rows.map((row) => ({ ...row, image: resolve(row.image) })),
        ]),
      )
    : undefined;

  if (!optionImages && !optionImageVariants) return schema;

  return {
    ...schema,
    ...(optionImages ? { optionImages } : {}),
    ...(optionImageVariants ? { optionImageVariants } : {}),
  };
};
