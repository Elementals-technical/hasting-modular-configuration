import { cmToInches } from "./cmToInches";
import { vesselSeriesSkuMap } from "./vesselSkuMaps";

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

  const w = input.width != null ? `${cmToInches(input.width)}W` : `${FALLBACK}W`;
  const h = input.height != null ? `${cmToInches(input.height)}H` : `${FALLBACK}H`;
  const d = normalizedDepth != null ? `${cmToInches(normalizedDepth)}D` : `${FALLBACK}D`;

  const mat = input.materialSku?.trim() || null;
  const color = input.colorCode?.trim() || null;
  const matBlock = mat ? `-${CATEGORY}-${mat}${color ? `-${color}` : ""}` : "";

  return `${CATEGORY}-${series}-${model}-${w}-${h}-${d}${matBlock}`;
}
