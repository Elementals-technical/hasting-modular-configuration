import { cmToInches } from "./cmToInches";
import { extractColorCode } from "./extractColorCode";
import {
  vesselSeriesSkuMap,
  vesselFixedWidthInMap,
  vesselFixedDepthInMap,
  vesselMaterialSkuAliasMap,
  vesselMaterialSkuMap,
} from "./vesselSkuMaps";

export type VesselSkuInput = {
  /** PlayCanvas vessel type, e.g. "Vessel_Blade11", "Vessel_UrbanModo" */
  vesselType: string | null;
  /** Model/style code — "X" (default) or "URSTD" */
  model?: string | null;
  width: number | null;
  height: number | null;
  depth: number | null;
  /** Material SKU for vessel element (e.g. "CER") */
  materialSku: string | null;
  /** Color code (e.g. "OCB", "FEMT") */
  colorCode: string | null;
};

export type VesselDimensionInput = Pick<VesselSkuInput, "vesselType" | "width" | "height" | "depth">;

export type VesselDimensionTokens = {
  width: string | null;
  height: string | null;
  depth: string | null;
};

const FALLBACK = "X";
const CATEGORY = "VES";

const normalizeDepthCm = (depth: number | null) => (depth === 46 ? 45.5 : depth);

const resolveFixedDimensionToken = (value: string | undefined): string | null => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

const resolveCmDimensionToken = (value: number | null): string | null =>
  value != null ? cmToInches(value) : null;

export const resolveVesselDimensionTokens = (input: VesselDimensionInput): VesselDimensionTokens => {
  const fixedWidth = input.vesselType ? resolveFixedDimensionToken(vesselFixedWidthInMap[input.vesselType]) : null;
  const fixedDepth = input.vesselType ? resolveFixedDimensionToken(vesselFixedDepthInMap[input.vesselType]) : null;

  return {
    width: fixedWidth ?? resolveCmDimensionToken(input.width),
    height: resolveCmDimensionToken(input.height),
    depth: fixedDepth ?? resolveCmDimensionToken(normalizeDepthCm(input.depth)),
  };
};

export const formatVesselDimensionLabel = (value: string | null | undefined): string | null => {
  const normalized = value?.trim();
  return normalized ? `${normalized}"` : null;
};

/**
 * Returns a SKU line for a vessel sink:
 *   VES-{SERIES}-X-{W}W-{H}H-{D}D[-{MaterialSKU}-{ColorCode}]
 *
 * SERIES is derived from vessel type (e.g. Vessel_Blade11 → BLD11, Vessel_UrbanModo → URMOD).
 * Model is "X" by default, or "URSTD" for the standard countertop-top variant.
 * Material block is appended only when materialSku is provided.
 */
export function buildVesselSku(input: VesselSkuInput): string {
  const series = (input.vesselType ? vesselSeriesSkuMap[input.vesselType] : null) ?? FALLBACK;
  const model = input.model?.trim() || "X";
  const dimensions = resolveVesselDimensionTokens(input);

  const w = dimensions.width ? `${dimensions.width}W` : `${FALLBACK}W`;
  const h = dimensions.height ? `${dimensions.height}H` : `${FALLBACK}H`;
  const d = dimensions.depth ? `${dimensions.depth}D` : `${FALLBACK}D`;

  // Fixed material SKU per vessel type takes priority over the passed-in value
  const fixedMat = input.vesselType ? vesselMaterialSkuMap[input.vesselType] : undefined;
  const rawMat = fixedMat ?? input.materialSku?.trim() ?? null;
  const mat = rawMat ? (vesselMaterialSkuAliasMap[rawMat.toUpperCase()] ?? rawMat) : null;
  const color = extractColorCode(input.colorCode)?.trim() || null;
  const matBlock = mat ? `-${mat}${color ? `-${color}` : ""}` : "";

  return `${CATEGORY}-${series}-${model}-${w}-${h}-${d}${matBlock}`;
}
