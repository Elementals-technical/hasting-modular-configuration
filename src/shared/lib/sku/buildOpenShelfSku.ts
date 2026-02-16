export type OpenShelfSkuInput = {
  /** Width in cm */
  width: number | null;
  /** Height in cm */
  height: number | null;
  /** Depth in cm */
  depth: number | null;
};

const FALLBACK = "X";

/**
 * Builds a pricing SKU for an Open Shelf product (UROS).
 *
 * Format: VAN-UROS-2S-{W}W-{H}H-{D}D
 *
 * Examples:
 *   VAN-UROS-2S-35W-56H-50D
 *   VAN-UROS-2S-60W-53H-46D
 */
export function buildOpenShelfSku(input: OpenShelfSkuInput): string {
  const w = input.width != null ? `${input.width}W` : `${FALLBACK}W`;
  const h = input.height != null ? `${input.height}H` : `${FALLBACK}H`;
  const d = input.depth != null ? `${input.depth}D` : `${FALLBACK}D`;

  return `VAN-UROS-2S-${w}-${h}-${d}`;
}
