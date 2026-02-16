import { cabinetTypeSkuMap, drawerSkuMap, handleSkuMap, patternSkuMap } from "./cabinetSkuMaps";
// import { cmToInches } from "./cmToInches";

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

  // ── Dimensions in cm (converted to inches in the SKU) ──
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
 * Builds a single unified cabinet product SKU (dimensions in cm).
 *
 * Example output:
 * VAN-URSTD-SB/2DW/PTO/X-105W-50H-50D-HDL-3D
 */
export function buildProductSku(input: ProductSkuInput): string {
  const configBlock = buildConfigBlock(input);

  // Dimensions: cm, W-H-D order with suffixes
  // TODO: uncomment cmToInches when backend switches to inches
  // const w = input.width != null ? `${cmToInches(input.width)}W` : FALLBACK;
  // const h = input.height != null ? `${cmToInches(input.height)}H` : FALLBACK;
  // const d = input.depth != null ? `${cmToInches(input.depth)}D` : FALLBACK;
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

/**
 * Builds a base cabinet SKU with raw cm dimensions and no materials.
 *
 * Example output:
 * VAN-URSTD-SB/2DW/UG/X-60W-56H-50D
 */
export function buildProductBaseSku(input: ProductSkuInput): string {
  const configBlock = buildConfigBlock(input);

  const w = input.width != null ? `${input.width}W` : FALLBACK;
  const h = input.height != null ? `${input.height}H` : FALLBACK;
  const d = input.depth != null ? `${input.depth}D` : FALLBACK;

  return `${CATEGORY}-${SERIES}-${configBlock}-${w}-${h}-${d}`;
}

function buildConfigBlock(input: ProductSkuInput): string {
  const type = resolve(cabinetTypeSkuMap, input.cabinetType);
  const drawers = resolve(drawerSkuMap, input.drawers);
  const handle = resolve(handleSkuMap, input.handle);
  const pattern = resolve(patternSkuMap, input.pattern);

  return [type, drawers, handle, pattern].join("/");
}
