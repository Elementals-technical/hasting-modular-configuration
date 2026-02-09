import {
  GRAIN_DIRECTION_VALUES,
  HPL_NO_GRAIN_FINISHES,
  HPL_NO_GRAIN_LABEL,
  THREE_D_NO_GRAIN_FINISHES,
  THREE_D_NO_GRAIN_LABEL,
} from "../constants";
import type { GrainDirectionRuleInput, GrainDirectionRuleResult, OptionState } from "../types";

const toOptionStates = (values: { value: string; label: string }[]): OptionState<string>[] =>
  values.map((entry) => ({
    value: entry.value,
    label: entry.label,
    enabled: true,
  }));

const isExcludedFinish = (material: string, finish?: string | null) => {
  if (!finish) return false;

  if (material === "HPL") return HPL_NO_GRAIN_FINISHES.has(finish);
  if (material === "3D") return THREE_D_NO_GRAIN_FINISHES.has(finish);
  return false;
};

export const grainDirectionRule = ({ material, finish }: GrainDirectionRuleInput): GrainDirectionRuleResult => {
  const normalizedMaterial = material?.trim();

  if (!normalizedMaterial) {
    return {
      available: false,
      options: [],
      reason: "Grain direction is only available for Essenze, HPL, and 3D materials.",
    };
  }

  const isEligibleMaterial = normalizedMaterial === "Essenze" || normalizedMaterial === "HPL" || normalizedMaterial === "3D";

  if (!isEligibleMaterial) {
    return {
      available: false,
      options: [],
      reason: `Grain direction is not available for ${normalizedMaterial}.`,
    };
  }

  if (isExcludedFinish(normalizedMaterial, finish?.trim())) {
    if (normalizedMaterial === "HPL") {
      return {
        available: false,
        options: [],
        reason: `Grain direction is not available for HPL material finishes: ${HPL_NO_GRAIN_LABEL}.`,
      };
    }
    if (normalizedMaterial === "3D") {
      return {
        available: false,
        options: [],
        reason: `Grain direction is not available for 3D material finishes: ${THREE_D_NO_GRAIN_LABEL}.`,
      };
    }
    return { available: false, options: [], reason: "Grain direction is not available for this finish." };
  }

  return {
    available: true,
    options: toOptionStates(GRAIN_DIRECTION_VALUES),
  };
};
