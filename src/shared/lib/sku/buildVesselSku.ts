import { cmToInches } from "./cmToInches";
import {
  vesselSeriesSkuMap,
  vesselFixedWidthInMap,
  vesselFixedDepthInMap,
  vesselMaterialSkuMap,
  vesselMaterialBlockModeMap,
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

const FALLBACK = "X";
const CATEGORY = "VES";

/**
 * Returns a SKU line for a vessel sink:
 *   VES-{SERIES}-X-{W}W-{H}H-{D}D[-VES-{MaterialSKU}-{ColorCode}]
 *
 * SERIES is derived from vessel type (e.g. Vessel_Blade11 → BLD11, Vessel_UrbanModo → URMOD).
 * Model is "X" by default, or "URSTD" for the standard countertop-top variant.
 * Material block is appended only when materialSku is provided.
 */
export function buildVesselSku(input: VesselSkuInput): string {
  const series = (input.vesselType ? vesselSeriesSkuMap[input.vesselType] : null) ?? FALLBACK;
  const model = input.model?.trim() || "X";

  const normalizedDepth = input.depth === 46 ? 45.5 : input.depth;

  const fixedW = input.vesselType ? vesselFixedWidthInMap[input.vesselType] : undefined;
  const fixedD = input.vesselType ? vesselFixedDepthInMap[input.vesselType] : undefined;

  const w = fixedW ? `${fixedW}W` : input.width != null ? `${cmToInches(input.width)}W` : `${FALLBACK}W`;
  const h = input.height != null ? `${cmToInches(input.height)}H` : `${FALLBACK}H`;
  const d = fixedD ? `${fixedD}D` : normalizedDepth != null ? `${cmToInches(normalizedDepth)}D` : `${FALLBACK}D`;

  const materialBlockMode = input.vesselType ? (vesselMaterialBlockModeMap[input.vesselType] ?? "selected") : "selected";
  // Fixed material SKU per vessel type takes priority over the passed-in value
  const fixedMat = input.vesselType ? vesselMaterialSkuMap[input.vesselType] : undefined;
  const mat = materialBlockMode === "none" ? null : (fixedMat ?? input.materialSku?.trim() ?? null);
  const color = input.colorCode?.trim() || null;
  // Keep Blade SKUs (BLD11/BLD18) untouched, including the CER-specific suffix.
  const isBladeSeries = series === "BLD11" || series === "BLD18";
  const matBlock = isBladeSeries
    ? mat === "CER"
      ? `-${CATEGORY}-${mat}${color ? `-${color}` : ""}`
      : mat
        ? `-${mat}`
        : ""
    : mat
      ? `-${mat}${color ? `-${color}` : ""}`
      : "";

  return `${CATEGORY}-${series}-${model}-${w}-${h}-${d}${matBlock}`;
}
