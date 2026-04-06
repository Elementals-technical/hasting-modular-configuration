export type BookMatchingSkuInput = {
  /** "H" (horizontal) or "V" (vertical) */
  direction: "H" | "V";
  /** Cabinet material SKU (e.g. "HPL", "LACM"). Appended when provided. */
  materialSku?: string | null;
};

const CATEGORY = "VAN";
const SERIES = "URBMG";

/**
 * Builds a pricing SKU for Book Matching.
 *
 * Examples:
 *   VAN-URBMG-VER
 *   VAN-URBMG-HOR
 *   VAN-URBMG-VER-HPL
 */
export function buildBookMatchingSku(input: BookMatchingSkuInput): string {
  const suffix = input.direction === "H" ? "HOR" : "VER";
  const base = `${CATEGORY}-${SERIES}-${suffix}`;
  return input.materialSku ? `${base}-${input.materialSku}` : base;
}
