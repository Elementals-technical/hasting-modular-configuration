import { useActiveCollection, type CustomizationOptionImages, type OptionImageVariants } from "@/entities/collection";

/**
 * Current attribute values a variant row is matched against, by attributeId. An attribute that
 * is not set reads as "", which a row matches explicitly — that is how Mako says "no legs yet".
 */
export type OptionImageContext = Record<string, string>;

/**
 * The picture of one option card.
 *
 * A collection declares one picture per option value in `optionImages`, and rows in
 * `optionImageVariants` for the cases where a card has to show something else: Urban shows the
 * groove of the handle its forced height stands for, Mako shows legs once a leg colour is
 * chosen. Rows are read in the declared order and the first whose conditions all hold wins.
 *
 * Without a match the plain picture is used, and without that the card gets no picture and its
 * grid shows the placeholder — an option is never dropped for want of one.
 */
export const resolveOptionImage = ({
  optionImages,
  variants,
  attributeId,
  value,
  context,
}: {
  optionImages: CustomizationOptionImages | undefined;
  variants: OptionImageVariants | undefined;
  attributeId: string;
  value: string;
  context: OptionImageContext;
}): string | undefined => {
  const matched = variants?.[attributeId]?.find(
    (variant) =>
      variant.value === value &&
      Object.entries(variant.when).every(([conditionId, expected]) => (context[conditionId] ?? "") === expected),
  );

  return matched?.image ?? optionImages?.[attributeId]?.[value];
};

/**
 * Variant pictures of the active collection, as absolute URLs.
 *
 * The plain pictures come from `useOptionImages`; both are read together by a grid that shows
 * cabinets.
 */
export const useOptionImageVariants = (): OptionImageVariants | undefined =>
  useActiveCollection((collection) => collection.catalog.customization?.optionImageVariants);
