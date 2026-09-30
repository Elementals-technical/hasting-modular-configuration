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

export type VesselSkuParts = {
  series: string | null;
  model?: string | null;
  dimensions: VesselDimensionTokens;
  materialSku: string | null;
  colorCode: string | null;
};

/**
 * The grammar of a vessel SKU, whatever the collection:
 *   VES-{SERIES}-{MODEL}-{W}W-{H}H-{D}D[-{MaterialSKU}[-{ColorCode}]]
 *
 * A missing series, model or size is written X. The material block is appended only when the
 * material is known.
 */
export const formatVesselSku = ({ series, model, dimensions, materialSku, colorCode }: VesselSkuParts): string => {
  const w = dimensions.width ? `${dimensions.width}W` : `${FALLBACK}W`;
  const h = dimensions.height ? `${dimensions.height}H` : `${FALLBACK}H`;
  const d = dimensions.depth ? `${dimensions.depth}D` : `${FALLBACK}D`;
  const matBlock = materialSku ? `-${materialSku}${colorCode ? `-${colorCode}` : ""}` : "";

  return `${CATEGORY}-${series ?? FALLBACK}-${model?.trim() || "X"}-${w}-${h}-${d}${matBlock}`;
};

/**
 * Returns a SKU line for an Urban vessel sink:
 *   VES-{SERIES}-X-{W}W-{H}H-{D}D[-{MaterialSKU}-{ColorCode}]
 *
 * SERIES is derived from vessel type (e.g. Vessel_Blade11 → BLD11, Vessel_UrbanModo → URMOD).
 * Model is "X" by default, or "URSTD" for the standard countertop-top variant.
 * Material block is appended only when materialSku is provided.
 */
export function buildVesselSku(input: VesselSkuInput): string {
  // Fixed material SKU per vessel type takes priority over the passed-in value
  const fixedMat = input.vesselType ? vesselMaterialSkuMap[input.vesselType] : undefined;
  const rawMat = fixedMat ?? input.materialSku?.trim() ?? null;

  return formatVesselSku({
    series: (input.vesselType ? vesselSeriesSkuMap[input.vesselType] : null) ?? null,
    model: input.model,
    dimensions: resolveVesselDimensionTokens(input),
    materialSku: rawMat ? (vesselMaterialSkuAliasMap[rawMat.toUpperCase()] ?? rawMat) : null,
    colorCode: extractColorCode(input.colorCode)?.trim() || null,
  });
}
