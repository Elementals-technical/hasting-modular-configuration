export type OpenSideShelfSkuInput = {
  /** "L" or "R" */
  side: "L" | "R";
  /** Width in cm */
  width: number | null;
  /** Height in cm */
  height: number | null;
  /** Depth in cm */
  depth: number | null;
};

const FALLBACK = "X";

/**
 * Builds a pricing SKU for an Open Side Shelf product (UROSS).
 *
 * Format: VAN-UROSS-{L|R}-{W}W-{H}H-{D}D
 *
 * Examples:
 *   VAN-UROSS-L-15W-50H-50D
 *   VAN-UROSS-R-15W-50H-46D
 */
export function buildOpenSideShelfSku(input: OpenSideShelfSkuInput): string {
  const w = input.width != null ? `${input.width}W` : `${FALLBACK}W`;
  const h = input.height != null ? `${input.height}H` : `${FALLBACK}H`;
  const d = input.depth != null ? `${input.depth}D` : `${FALLBACK}D`;

  return `VAN-UROSS-${input.side}-${w}-${h}-${d}`;
}
