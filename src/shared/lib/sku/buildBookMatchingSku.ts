import type { SkuProfile } from "./skuProfile";

export type BookMatchingSkuInput = {
  /** "H" (horizontal) or "V" (vertical) */
  direction: "H" | "V";
  /** Cabinet material SKU (e.g. "HPL", "LACM"). Appended when provided. */
  materialSku?: string | null;
};

const CATEGORY = "VAN";

/**
 * Builds a pricing SKU for Book Matching.
 *
 * Examples:
 *   VAN-URBMG-VER
 *   VAN-URBMG-HOR
 *   VAN-URBMG-VER-HPL
 */
export function buildBookMatchingSku(profile: SkuProfile, input: BookMatchingSkuInput): string {
  const suffix = input.direction === "H" ? "HOR" : "VER";
  const base = `${CATEGORY}-${profile.series.bookMatching}-${suffix}`;
  return input.materialSku ? `${base}-${input.materialSku}` : base;
}
