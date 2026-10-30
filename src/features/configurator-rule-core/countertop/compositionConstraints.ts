import type { ProductProfile } from "@/entities/collection";
import { selectMessage, selectRuleData } from "@/entities/collection";

import { normalizeMaterialToken } from "./parse";

export const REASON_SYNTESI_SINGLE_CABINET = "syntesi.singleCabinetOnly";

export interface CountertopCabinetCompositionConstraint {
  isSingleCabinetOnly: boolean;
  isWithinCabinetLimit: boolean;
  canAddCabinet: boolean;
  canRepositionCabinets: boolean;
  reason?: string;
}

/** Whether the countertop materials include the collection's Syntesi material. */
export const hasSyntesiMaterialToken = (materialTokens: readonly string[], profile: ProductProfile | null): boolean => {
  const material = selectRuleData(profile, "syntesi")?.material;
  if (!material) return false;

  const syntesiToken = normalizeMaterialToken(material);
  return materialTokens.some((token) => normalizeMaterialToken(token) === syntesiToken);
};

/**
 * How many cabinets a countertop allows. A Syntesi countertop is limited to
 * `ruleData.syntesi.maxCabinetCount`; a collection without Syntesi has no such limit.
 */
export const resolveCountertopCabinetCompositionConstraint = ({
  materialTokens,
  cabinetCount,
  profile,
}: {
  materialTokens: readonly string[];
  cabinetCount: number;
  profile: ProductProfile | null;
}): CountertopCabinetCompositionConstraint => {
  const syntesi = selectRuleData(profile, "syntesi");

  if (!syntesi || !hasSyntesiMaterialToken(materialTokens, profile)) {
    return {
      isSingleCabinetOnly: false,
      isWithinCabinetLimit: true,
      canAddCabinet: true,
      canRepositionCabinets: true,
    };
  }

  const isWithinCabinetLimit = cabinetCount <= syntesi.maxCabinetCount;
  const canAddCabinet = cabinetCount < syntesi.maxCabinetCount;

  return {
    isSingleCabinetOnly: true,
    isWithinCabinetLimit,
    canAddCabinet,
    canRepositionCabinets: false,
    reason: canAddCabinet ? undefined : selectMessage(profile, REASON_SYNTESI_SINGLE_CABINET),
  };
};
