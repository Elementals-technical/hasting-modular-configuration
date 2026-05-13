export type OpenSideShelfSide = "L" | "R";

export type ResolveOpenSideShelfSideInput = {
  productIds?: readonly (string | null | undefined)[];
  orderedProductIds?: readonly string[];
  fallbackIndex: number;
};

const normalizeId = (value: string | null | undefined) => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

/**
 * OSS side is a property of the product position in the composition:
 * left edge -> L, every other OSS edge -> R.
 */
export const resolveOpenSideShelfSide = ({
  productIds = [],
  orderedProductIds = [],
  fallbackIndex,
}: ResolveOpenSideShelfSideInput): OpenSideShelfSide => {
  const candidates = new Set(productIds.map(normalizeId).filter((value): value is string => value !== null));

  if (candidates.size > 0 && orderedProductIds.length > 0) {
    const position = orderedProductIds.findIndex((id) => candidates.has(id));
    if (position >= 0) return position === 0 ? "L" : "R";
  }

  return fallbackIndex === 0 ? "L" : "R";
};
