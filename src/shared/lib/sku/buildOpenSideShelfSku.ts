export type OpenSideShelfSkuInput = {
  /** "L" or "R" */
  side: "L" | "R";
  /** Width in cm */
  width: number | null;
  /** Height in cm */
  height: number | null;
  /** Depth in cm */
  depth: number | null;
  /** Cabinet material SKU (e.g. "LACM", "HPL") */
  cabinetMaterialSku: string | null;
  /** Cabinet color code (e.g. "TKH", "FE") */
  cabinetColorCode: string | null;
  /** Grain direction suffix: "H" for Horizontal, "V" for Vertical */
  grainDirection?: "H" | "V" | null;
};

const FALLBACK = "X";

/**
 * Builds a pricing SKU for an Open Side Shelf product (UROSS).
 *
 * Format: VAN-UROSS-{L|R}-{W}W-{H}H-{D}D-CAB-{mat}-{color}
 *
 * Examples:
 *   VAN-UROSS-L-15W-50H-50D-CAB-LACM-TKH
 *   VAN-UROSS-R-15W-50H-46D-CAB-HPL-FE
 */
export function buildOpenSideShelfSku(input: OpenSideShelfSkuInput): string {
  const w = input.width != null ? `${input.width}W` : `${FALLBACK}W`;
  const h = input.height != null ? `${input.height}H` : `${FALLBACK}H`;
  const d = input.depth != null ? `${input.depth}D` : `${FALLBACK}D`;

  let sku = `VAN-UROSS-${input.side}-${w}-${h}-${d}`;

  const mat = input.cabinetMaterialSku?.trim();
  if (mat) {
    const color = input.cabinetColorCode?.trim();
    const grainSuffix = input.grainDirection === "H" ? "/H" : input.grainDirection === "V" ? "/V" : "";
    const colorWithGrain = color ? `${color}${grainSuffix}` : null;
    sku += colorWithGrain ? `-CAB-${mat}-${colorWithGrain}` : `-CAB-${mat}`;
  }

  return sku;
}
