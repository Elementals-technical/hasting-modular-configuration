import { cabinetTypeSkuMap, drawerSkuMap, handleSkuMap, patternSkuMap } from "./cabinetSkuMaps";

export type ElementMaterial = {
  materialSku: string | null;
  colorCode: string | null;
};

export type ProductSkuInput = {
  // ── Config block ──
  cabinetType: string | null;
  drawers: string | null;
  handle: string | null;
  pattern: string | null;

  // ── Dimensions (W-H-D order with suffixes: 60W-53H-50D) ──
  width: number | null;
  height: number | null;
  depth: number | null;

  // ── Element triplets: ELEMENT-MATERIAL-COLOR ──
  /** CAB — Cabinet body */
  cab: ElementMaterial | null;
  /** HDL — Handle groove */
  hdl: ElementMaterial | null;
  /** MSP — Metal Side Panel */
  msp: ElementMaterial | null;
  /** BKPL — Back Panel */
  bkpl: ElementMaterial | null;
};

const FALLBACK = "X";
const CATEGORY = "VAN";
const SERIES = "URSTD";

const resolve = (map: Record<string, string>, value: string | null): string => {
  if (!value) return FALLBACK;
  return map[value] ?? FALLBACK;
};

function buildTriplet(code: string, el: ElementMaterial | null): string | null {
  const mat = el?.materialSku?.trim();
  if (!mat) return null;

  const color = el?.colorCode?.trim();
  return color ? `${code}-${mat}-${color}` : `${code}-${mat}`;
}

/**
 * Builds a single unified cabinet product SKU.
 *
 * Towel-bar accessories are **not** included here — they have their own
 * full product SKUs built by `buildTowelBarSku`.
 *
 * Example output:
 * VAN-URSTD-SB/1DW/PTO/X-60W-53H-50D-CAB-LACG-37-HDL-LACG-77
 */
export function buildProductSku(input: ProductSkuInput): string {
  // Config block: CabinetType/CabinetStyle/HandleStyle/DrawerPanelFluting
  const type = resolve(cabinetTypeSkuMap, input.cabinetType);
  const drawers = resolve(drawerSkuMap, input.drawers);
  const handle = resolve(handleSkuMap, input.handle);
  const pattern = resolve(patternSkuMap, input.pattern);

  const configBlock = [type, drawers, handle, pattern].join("/");

  // Dimensions: W-H-D order with suffixes
  const w = input.width != null ? `${input.width}W` : FALLBACK;
  const h = input.height != null ? `${input.height}H` : FALLBACK;
  const d = input.depth != null ? `${input.depth}D` : FALLBACK;

  // Element triplets (order matches spec)
  const triplets = [
    buildTriplet("CAB", input.cab),
    buildTriplet("HDL", input.hdl),
    buildTriplet("MSP", input.msp),
    buildTriplet("BKPL", input.bkpl),
  ].filter(Boolean) as string[];

  const elementsSuffix = triplets.length ? `-${triplets.join("-")}` : "";

  return `${CATEGORY}-${SERIES}-${configBlock}-${w}-${h}-${d}${elementsSuffix}`;
}
