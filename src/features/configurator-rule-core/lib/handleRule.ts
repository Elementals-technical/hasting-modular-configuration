import type { OptionState, RuleContext, RuleResult } from "../model/types";

const handleOptions: OptionState<string>[] = [
  { value: "handle_pto", label: "Push to open", enabled: true },
  { value: "handle_urban_topcut", label: "Upper Groove", enabled: true },
  { value: "handle_urban_botcut", label: "Central Groove", enabled: true },
];

const restrictHeights = (
  options: OptionState<number>[],
  requiredHeight: number,
  reason: string,
): OptionState<number>[] =>
  options.map((option) => {
    if (!option.enabled) return option;
    if (option.value === requiredHeight) return option;
    return { ...option, enabled: false, reason };
  });

export const handleRule = (baseResult: RuleResult, context: RuleContext): RuleResult => {
  const { selection } = context;
  const isTwoDrawer = selection.drawers === "2";

  const handles = handleOptions.map((option) => {
    if (option.value === "handle_urban_botcut" && !isTwoDrawer) {
      return { ...option, enabled: false, reason: "Only available for 2 drawers" };
    }

    return { ...option, enabled: true, reason: undefined };
  });

  let heightOptions = baseResult.availableOptions.height;

  if (selection.handle === "handle_pto") {
    heightOptions = restrictHeights(heightOptions, 50, "Handle requires height 50");
  } else if (selection.handle === "handle_urban_botcut" && isTwoDrawer) {
    heightOptions = restrictHeights(heightOptions, 53, "Central groove requires height 53");
  }

  return {
    availableOptions: {
      ...baseResult.availableOptions,
      height: heightOptions,
      handles,
    },
    violations: baseResult.violations,
  };
};
