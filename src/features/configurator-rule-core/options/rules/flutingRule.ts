import { FLUTING_VALUES } from "../constants";
import type { FlutingRuleInput, FlutingRuleResult, OptionState } from "../types";

const toOptionStates = (values: { value: string; label: string }[]): OptionState<string>[] =>
  values.map((entry) => ({
    value: entry.value,
    label: entry.label,
    enabled: true,
  }));

export const flutingRule = ({ targetPart, isOpenShelf }: FlutingRuleInput): FlutingRuleResult => {
  if (targetPart === "SIDE_PANEL") {
    return { available: false, options: [], reason: "Fluting is not available for side panels." };
  }

  if (isOpenShelf) {
    return { available: false, options: [], reason: "Fluting is not available for open shelves." };
  }

  return {
    available: true,
    options: toOptionStates(FLUTING_VALUES),
  };
};
