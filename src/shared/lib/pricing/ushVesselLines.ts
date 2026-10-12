import type { ProductProfile } from "@/entities/collection";
import { getAllowedVesselMaterialTokens } from "@/features/configurator-rule-core/countertop";
import {
  buildVesselSku,
  getCountertopMaterialTokensBySku,
  resolveCountertopColorCodeFromCandidates,
  resolveCountertopColorSkuFromCandidates,
  resolveCountertopMaterialSkuFromColorCode,
  vesselHeightCmMap,
  type CountertopColorSkuCandidatesByValue,
} from "@/shared/lib/sku";

import type { PricingLine } from "./types";
import type { UshCountertop } from "./ushCountertopLines";

/**
 * The Urban Standard Height vessel sink (D02): one on each sink base, spelled
 * `VES-{vessel}-X-{W}W-{H}H-{D}D-{material}-{code}`. USH orders its own with it, and so does a
 * collection whose SKU profile prices its countertop as USH's (Urban Low Height), which offers
 * the USH vessels.
 */

export type UshVesselLinesInput = {
  /** The collection whose vessel compatibility names the materials a vessel takes. */
  profile: ProductProfile | null;
  /** The countertop, whose materials pick the vessel colour's SKU for a vessel that names none. */
  countertop: UshCountertop;
  countertopColorSkuCandidatesByValue: CountertopColorSkuCandidatesByValue;
  /** The basin of the whole composition: a vessel (`Vessel_…`) is ordered. */
  sinkType: string | null;
  vesselColor: string | null;
  /**
   * The vessel colour's own material SKU, from the configurator section the collection reads it from,
   * for a colour the countertop colours do not name (Urban Freestanding's Bianco Gloss TAL is SSTKR).
   */
  vesselColorSku?: string | null;
  /** The countertop across the composition and its depth, for a vessel without a size of its own. */
  widthCm: number | null;
  depthCm: number | null;
  sinkBaseCount: number;
};

export const buildUshVesselLines = ({
  profile,
  countertop,
  countertopColorSkuCandidatesByValue: candidatesByValue,
  sinkType,
  vesselColor,
  vesselColorSku,
  widthCm,
  depthCm,
  sinkBaseCount,
}: UshVesselLinesInput): PricingLine[] => {
  const vesselType = sinkType?.startsWith("Vessel_") ? sinkType : null;
  if (!vesselType) return [];

  const allowedMaterialTokens = Array.from(getAllowedVesselMaterialTokens(vesselType, profile) ?? []);
  const preferredMaterialTokens =
    allowedMaterialTokens.length > 0
      ? allowedMaterialTokens
      : [...getCountertopMaterialTokensBySku(countertop.materialSku), ...countertop.preferredMaterialTokens];
  const colorCode = vesselColor
    ? resolveCountertopColorCodeFromCandidates({ value: vesselColor, candidatesByValue, preferredMaterialTokens })
    : null;
  const materialSku = vesselColor
    ? (resolveCountertopMaterialSkuFromColorCode(colorCode) ??
      resolveCountertopColorSkuFromCandidates({ value: vesselColor, candidatesByValue, preferredMaterialTokens }) ??
      vesselColorSku ??
      null)
    : null;

  const sku = buildVesselSku({
    vesselType,
    width: widthCm,
    height: vesselHeightCmMap[vesselType] ?? null,
    depth: depthCm,
    materialSku,
    colorCode,
  });
  return [{ id: "vessel", group: "vessel", sku, quantity: sinkBaseCount }];
};
