export type DividerSkuInput = {
  /** Divider style from state: "Option A" | "Option B" | "Option C" | "None" */
  dividerStyle: string | null;
};

const CATEGORY = "VAN";
const SERIES = "URDIV";

/** Divider option → pricing code for the URDIV SKU */
const dividerPricingMap: Record<string, string> = {
  "Option A": "A",
  "Option B": "B",
  "Option C": "C",
};

/**
 * Builds a pricing SKU for a divider accessory (Resolver 4).
 *
 * No materials or dimensions — only the style code.
 *
 * Example: VAN-URDIV-A
 */
export function buildDividerSku(input: DividerSkuInput): string | null {
  if (!input.dividerStyle || input.dividerStyle === "None") return null;

  const code = dividerPricingMap[input.dividerStyle];
  if (!code) return null;

  return `${CATEGORY}-${SERIES}-${code}`;
}
