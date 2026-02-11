import { cabinetTypeSkuMap, drawerSkuMap, grainDirectionSkuMap, handleSkuMap, patternSkuMap } from "./cabinetSkuMaps";

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
  grainDirection: string | null;

  // ── Dimensions ──
  width: number | null;
  height: number | null;
  depth: number | null;

  // ── Element triplets: ELEMENT-MATERIAL-COLOR ──
  /** CAB — Cabinet body */
  cab: ElementMaterial | null;
  /** HDL — Handle */
  hdl: ElementMaterial | null;
  /** MSP — Metal Side Panel */
  msp: ElementMaterial | null;
  /** BKPL — Back Panel */
  bkpl: ElementMaterial | null;
  /** TBR — Towel Bar */
  tbr: ElementMaterial | null;
  /** TBL — Table / Countertop */
  tbl: ElementMaterial | null;
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
 * Builds a single unified product SKU.
 *
 * Example output:
 * VAN-URSTD-SB/1D/PTO/NRF-60-50-53-CAB-LACG-37GL-HDL-GL-77GL-TBR-LACM-FEMT-TBL-LACM-FEMT
 */
export function buildProductSku(input: ProductSkuInput): string {
  // Config block
  const type = resolve(cabinetTypeSkuMap, input.cabinetType);
  const drawers = resolve(drawerSkuMap, input.drawers);
  const handle = resolve(handleSkuMap, input.handle);
  const pattern = resolve(patternSkuMap, input.pattern);
  const grain = resolve(grainDirectionSkuMap, input.grainDirection);

  const configBlock = [type, drawers, handle, pattern, grain].join("/");

  // Dimensions (plain numbers, no W/H/D suffixes)
  const w = input.width != null ? `${input.width}W` : FALLBACK;
  const h = input.height != null ? `${input.height}H` : FALLBACK;
  const d = input.depth != null ? `${input.depth}D` : FALLBACK;

  // Element triplets (order matches spec)
  const triplets = [
    buildTriplet("CAB", input.cab),
    buildTriplet("HDL", input.hdl),
    buildTriplet("MSP", input.msp),
    buildTriplet("BKPL", input.bkpl),
    buildTriplet("TBR", input.tbr),
    buildTriplet("TBL", input.tbl),
  ].filter(Boolean) as string[];

  const elementsSuffix = triplets.length ? `-${triplets.join("-")}` : "";

  return `${CATEGORY}-${SERIES}-${configBlock}-${w}-${h}-${d}${elementsSuffix}`;
}
