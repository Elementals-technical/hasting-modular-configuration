import { cabinetTypeSkuMap, drawerSkuMap, handleSkuMap, patternSkuMap } from "./cabinetSkuMaps";
import { cmToInches } from "./cmToInches";
import { toSkuDepth } from "./toSkuDepth";

export type ElementMaterial = {
  materialSku: string | null;
  colorCode: string | null;
  /** Grain direction suffix: "H" for Horizontal, "V" for Vertical */
  grainDirection?: "H" | "V" | null;
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

const normalizeToken = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");

const resolveCabinetType = (value: string | null): string => {
  if (!value) return FALLBACK;

  // If already a known code (e.g. "SB"), keep it.
  if (Object.values(cabinetTypeSkuMap).includes(value)) return value;

  // Exact key match (e.g. "Sink-Base").
  if (cabinetTypeSkuMap[value]) return cabinetTypeSkuMap[value];

  // Fuzzy match on normalized tokens (e.g. "SinkBase60" -> "Sink-Base").
  const normalizedValue = normalizeToken(value);
  for (const [key, code] of Object.entries(cabinetTypeSkuMap)) {
    const normalizedKey = normalizeToken(key);
    if (normalizedKey && normalizedValue.includes(normalizedKey)) return code;
  }

  return FALLBACK;
};

function buildTriplet(code: string, el: ElementMaterial | null): string | null {
  const mat = el?.materialSku?.trim();
  if (!mat) return null;

  const color = el?.colorCode?.trim();
  const grainSuffix = el?.grainDirection === "H" ? "/H" : el?.grainDirection === "V" ? "/V" : "";
  const colorWithGrain = color ? `${color}${grainSuffix}` : null;
  return colorWithGrain ? `${code}-${mat}-${colorWithGrain}` : `${code}-${mat}`;
}

/**
 * Builds a single unified cabinet product SKU (dimensions in inches).
 *
 * Example output:
 * VAN-URSTD-SB/2DW/PTO/X-41.3W-19.7H-19.7D-HDL-3D
 */
export function buildProductSku(input: ProductSkuInput): string {
  const configBlock = buildConfigBlock(input);

  // Dimensions: inches, W-H-D order with suffixes
  const w = input.width != null ? `${cmToInches(input.width)}W` : FALLBACK;
  const h = input.height != null ? `${cmToInches(input.height)}H` : FALLBACK;
  const normalizedDepth = input.depth != null ? toSkuDepth(input.depth) : null;
  const d = normalizedDepth != null ? `${cmToInches(normalizedDepth)}D` : FALLBACK;

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
 * Builds a base cabinet SKU with inch dimensions and no materials.
 *
 * Example output:
 * VAN-URSTD-SB/2DW/UG/X-23.6W-22H-19.7D
 */
export function buildProductBaseSku(input: ProductSkuInput): string {
  const configBlock = buildConfigBlock(input);

  const w = input.width != null ? `${cmToInches(input.width)}W` : FALLBACK;
  const h = input.height != null ? `${cmToInches(input.height)}H` : FALLBACK;
  const normalizedDepth = input.depth != null ? toSkuDepth(input.depth) : null;
  const d = normalizedDepth != null ? `${cmToInches(normalizedDepth)}D` : FALLBACK;

  return `${CATEGORY}-${SERIES}-${configBlock}-${w}-${h}-${d}`;
}

function buildConfigBlock(input: ProductSkuInput): string {
  const type = resolveCabinetType(input.cabinetType);
  const drawers = resolve(drawerSkuMap, input.drawers);
  const handle = resolve(handleSkuMap, input.handle);
  const pattern = resolve(patternSkuMap, input.pattern);

  return [type, drawers, handle, pattern].join("/");
}
