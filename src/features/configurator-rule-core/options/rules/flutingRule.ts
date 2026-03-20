import { FLUTING_VALUES } from "../constants";
import type { FlutingRuleInput, FlutingRuleResult, OptionState } from "../types";

const toOptionStates = (values: { value: string; label: string }[]): OptionState<string>[] =>
  values.map((entry) => ({
    value: entry.value,
    label: entry.label,
    enabled: true,
  }));

const isLacquerMatte = (material?: string | null) => {
  if (!material) return false;
  const normalized = material.trim().toUpperCase();
  return (
    normalized === "LACM" ||
    normalized === "LACQUER MATTE" ||
    normalized === "LACQUERED MATTE" ||
    normalized === "LACQUERED MT" ||
    normalized === "LACQUER MT"
  );
};

export const flutingRule = ({ targetPart, material }: FlutingRuleInput): FlutingRuleResult => {
  if (targetPart === "SIDE_PANEL") {
    return { available: false, options: [], reason: "Fluting is not available for side panels." };
  }

  if (!isLacquerMatte(material)) {
    return { available: false, options: [], reason: "Fluting is available only for Lacquer Matte (LACM)." };
  }

  return {
    available: true,
    options: toOptionStates(FLUTING_VALUES),
  };
};
