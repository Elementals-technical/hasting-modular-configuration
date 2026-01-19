import type { ConfiguratorCatalog } from "@/shared/config/configurator/typeCabinetCatalog";

import type { OptionState, RuleContext, RuleResult } from "../model/types";

const HANDLE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "handle_pto", label: "Push to open" },
  { value: "handle_urban_topcut", label: "Upper Groove" },
  { value: "handle_urban_botcut", label: "Central Groove" },
];

const DEFAULT_ALLOWED_HANDLES = HANDLE_OPTIONS.map((option) => option.value);
const CENTRAL_GROOVE_REASON = "Available only for selected drawers";
const HANDLE_HEIGHT_REASON = "Required for selected handle";
const DEFAULT_HANDLE_HEIGHT_REASON = "Required for selected handle and all products";

const supportsHeightForAllProducts = (
  productIds: string[] | undefined,
  catalog: ConfiguratorCatalog,
  requiredHeight: number,
): boolean => {
  if (!productIds?.length) return true;

  return productIds.every((productId) => {
    const normalized = productId.toLowerCase();
    const rule = catalog.typeCabinetRules.find((entry) => normalized.includes(entry.code.toLowerCase()));

    if (!rule) return false;

    const supported = rule.supportsHeight?.length ? rule.supportsHeight : rule.heights;
    return supported.includes(requiredHeight);
  });
};

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

export const handleRule = (
  ruleResult: RuleResult,
  context: RuleContext,
  catalog: ConfiguratorCatalog,
): RuleResult => {
  const { selection } = context;
  const activeRule = catalog.typeCabinetRules.find((rule) => rule.id === selection.cabinetTypeId);
  const allowedHandles = activeRule?.handlesAllowed?.length ? activeRule.handlesAllowed : DEFAULT_ALLOWED_HANDLES;

  const hasDrawerSelection = selection.drawers !== null && selection.drawers !== undefined;
  const requiresDrawers = activeRule?.handleUrbanBotcutRequiresDrawers ?? [];
  const isDrawerAllowed = !hasDrawerSelection || requiresDrawers.length === 0 || requiresDrawers.includes(selection.drawers as string);

  const handles: OptionState<string>[] = allowedHandles.length
    ? HANDLE_OPTIONS.map((option) => {
        if (!allowedHandles.includes(option.value)) {
          return { ...option, enabled: false, reason: "Not available for selected cabinet type" };
        }

    if (option.value !== "handle_urban_botcut") {
      return { ...option, enabled: true };
    }

    if (!isDrawerAllowed) {
      return { ...option, enabled: false, reason: CENTRAL_GROOVE_REASON };
    }

        return { ...option, enabled: true };
      })
    : [];

  let heightOptions = ruleResult.availableOptions.height;

  const resolveForcedHeight = (handleValue: string) => {
    if (!activeRule) return null;

    if (handleValue === "handle_pto") return activeRule.handlePtoForcedHeightCm ?? null;
    if (handleValue === "handle_urban_topcut") return activeRule.handleUrbanTopcutForcedHeightCm ?? null;
    if (handleValue === "handle_urban_botcut") return activeRule.handleUrbanBotcutForcedHeightCm ?? null;
    return null;
  };

  const handleIsAllowed = selection.handle ? allowedHandles.includes(selection.handle) : false;
  const forcedHeight = selection.handle && handleIsAllowed ? resolveForcedHeight(selection.handle) : null;
  const hasForcedHeight =
    typeof forcedHeight === "number" &&
    heightOptions.some((option) => option.value === forcedHeight && option.enabled) &&
    supportsHeightForAllProducts(context.selectedProductIds, catalog, forcedHeight);

  if (selection.handle === "handle_pto" && hasForcedHeight) {
    heightOptions = constrainHeightOptions(heightOptions, forcedHeight, HANDLE_HEIGHT_REASON);
  } else if (selection.handle === "handle_urban_topcut" && hasForcedHeight) {
    heightOptions = constrainHeightOptions(heightOptions, forcedHeight, DEFAULT_HANDLE_HEIGHT_REASON);
  } else if (selection.handle === "handle_urban_botcut" && hasForcedHeight && isDrawerAllowed) {
    heightOptions = constrainHeightOptions(heightOptions, forcedHeight, HANDLE_HEIGHT_REASON);
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
