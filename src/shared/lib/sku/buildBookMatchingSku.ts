export type BookMatchingSkuInput = {
  /** "H" (horizontal) or "V" (vertical) */
  direction: "H" | "V";
};

const CATEGORY = "VAN";
const SERIES = "URBMG";

/**
 * Builds a pricing SKU for Book Matching.
 *
 * Examples:
 *   VAN-URBMG-VER
 *   VAN-URBMG-HOR
 */
export function buildBookMatchingSku(input: BookMatchingSkuInput): string {
  const suffix = input.direction === "H" ? "HOR" : "VER";
  return `${CATEGORY}-${SERIES}-${suffix}`;
}
