import { normalizeMaterialToken } from "./parse";
import { SYNTESI_MATERIAL } from "./syntesiOptions";

export const SYNTESI_MAX_CABINET_COUNT = 1;
export const SYNTESI_SINGLE_CABINET_REASON = "Syntesi is available for single cabinet configurations only.";
export const SYNTESI_SIDE_PANEL_UNAVAILABLE_REASON = "Syntesi is not available with side panels.";

const SYNTESI_NORMALIZED_TOKEN = normalizeMaterialToken(SYNTESI_MATERIAL);

export interface CountertopCabinetCompositionConstraint {
  isSingleCabinetOnly: boolean;
  isWithinCabinetLimit: boolean;
  canAddCabinet: boolean;
  canRepositionCabinets: boolean;
  reason?: string;
}

export const hasSyntesiMaterialToken = (materialTokens: readonly string[]): boolean =>
  materialTokens.some((token) => normalizeMaterialToken(token) === SYNTESI_NORMALIZED_TOKEN);

export const resolveCountertopCabinetCompositionConstraint = ({
  materialTokens,
  cabinetCount,
}: {
  materialTokens: readonly string[];
  cabinetCount: number;
}): CountertopCabinetCompositionConstraint => {
  const isSingleCabinetOnly = hasSyntesiMaterialToken(materialTokens);

  if (!isSingleCabinetOnly) {
    return {
      isSingleCabinetOnly: false,
      isWithinCabinetLimit: true,
      canAddCabinet: true,
      canRepositionCabinets: true,
    };
  }

  const isWithinCabinetLimit = cabinetCount <= SYNTESI_MAX_CABINET_COUNT;
  const canAddCabinet = cabinetCount < SYNTESI_MAX_CABINET_COUNT;

  return {
    isSingleCabinetOnly,
    isWithinCabinetLimit,
    canAddCabinet,
    canRepositionCabinets: false,
    reason: canAddCabinet ? undefined : SYNTESI_SINGLE_CABINET_REASON,
  };
};
