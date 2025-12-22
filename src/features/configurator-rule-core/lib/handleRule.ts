import type { OptionState, RuleContext, RuleResult } from "../model/types";

const HANDLE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "handle_pto", label: "Push to open" },
  { value: "handle_urban_topcut", label: "Upper Groove" },
  { value: "handle_urban_botcut", label: "Central Groove" },
];

const CENTRAL_GROOVE_REQUIRED_DRAWERS = "2";
const PTO_HEIGHT = 50;
const CENTRAL_GROOVE_HEIGHT = 53;

const CENTRAL_GROOVE_REASON = "Available only for 2 drawers";
const HANDLE_HEIGHT_REASON = "Required for selected handle";

const constrainHeightOptions = (
  options: OptionState<number>[],
  requiredHeight: number,
  reason: string,
): OptionState<number>[] =>
  options.map((option) => {
    if (option.value === requiredHeight) {
      return option;
    }

    if (!option.enabled) {
      return option.reason ? option : { ...option, reason };
    }

    return { ...option, enabled: false, reason };
  });

export const handleRule = (ruleResult: RuleResult, context: RuleContext): RuleResult => {
  const { selection } = context;

  const hasDrawerSelection = selection.drawers !== null && selection.drawers !== undefined;
  const isDrawerTwo = selection.drawers === CENTRAL_GROOVE_REQUIRED_DRAWERS;

  const handles: OptionState<string>[] = HANDLE_OPTIONS.map((option) => {
    if (option.value !== "handle_urban_botcut") {
      return { ...option, enabled: true };
    }

    if (hasDrawerSelection && !isDrawerTwo) {
      return { ...option, enabled: false, reason: CENTRAL_GROOVE_REASON };
    }

    return { ...option, enabled: true };
  });

  let heightOptions = ruleResult.availableOptions.height;

  if (selection.handle === "handle_pto") {
    heightOptions = constrainHeightOptions(heightOptions, PTO_HEIGHT, HANDLE_HEIGHT_REASON);
  } else if (selection.handle === "handle_urban_botcut" && isDrawerTwo) {
    heightOptions = constrainHeightOptions(heightOptions, CENTRAL_GROOVE_HEIGHT, HANDLE_HEIGHT_REASON);
  }

  return {
    ...ruleResult,
    availableOptions: {
      ...ruleResult.availableOptions,
      height: heightOptions,
      handles,
    },
  };
};
