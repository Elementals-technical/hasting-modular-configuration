import { useActiveCollection, type CustomizationOptionImages } from "@/entities/collection";

/**
 * Pictures of the active collection's options, by attribute and option value, as absolute URLs.
 *
 * The countertop step joins these onto the option lists it reads from the profile. A collection
 * that declares none shows its options without a picture, never drops them.
 */
export const useOptionImages = (): CustomizationOptionImages | undefined =>
  useActiveCollection((collection) => collection.catalog.customization?.optionImages);
