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

const parseHeightMapping = (raw: string): Record<string, number> =>
  Object.fromEntries(
    raw.split("|").flatMap((entry) => {
      const colonIdx = entry.indexOf(":");
      if (colonIdx === -1) return [];
      const key = entry.slice(0, colonIdx).trim();
      const num = Number(entry.slice(colonIdx + 1).trim());
      return key && Number.isFinite(num) ? [[key, num]] : [];
    }),
  );

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
  const activeRule = catalog.typeCabinetRules.find((rule) => rule.code === selection.cabinetType);
  const allowedHandles = activeRule?.handlesAllowed?.length ? activeRule.handlesAllowed : DEFAULT_ALLOWED_HANDLES;
  const heightLocked = ruleResult.heightLocked;
  const heightLockedReason =
    typeof heightLocked === "number"
      ? `Not available for current configuration height (${heightLocked}cm locked)`
      : null;

  const hasDrawerSelection = selection.drawers !== null && selection.drawers !== undefined;
  const requiresDrawers = activeRule?.handleUrbanBotcutRequiresDrawers ?? [];
  const isDrawerAllowed =
    requiresDrawers.length === 0 ||
    (hasDrawerSelection && requiresDrawers.includes(selection.drawers as string));

  let heightOptions = ruleResult.availableOptions.height;
  const violations = [...ruleResult.violations];

  const getRawMapping = (handleValue: string): string | null => {
    if (!activeRule) return null;
    if (handleValue === "handle_pto") return activeRule.handlePtoForcedHeightCm ?? null;
    if (handleValue === "handle_urban_topcut") return activeRule.handleUrbanTopcutForcedHeightCm ?? null;
    if (handleValue === "handle_urban_botcut") return activeRule.handleUrbanBotcutForcedHeightCm ?? null;
    return null;
  };

  const resolveForcedHeight = (handleValue: string, drawers: string | null | undefined): number | null => {
    const raw = getRawMapping(handleValue);
    if (!raw) return null;
    if (!drawers) return null;
    return parseHeightMapping(raw)[drawers] ?? null;
  };

  const resolvePossibleForcedHeights = (handleValue: string): number[] => {
    const raw = getRawMapping(handleValue);
    if (!raw) return [];
    return Object.values(parseHeightMapping(raw)).filter((value) => Number.isFinite(value));
  };

  const isHandleLockedConflict = (handleValue: string): boolean => {
    if (typeof heightLocked !== "number") return false;

    if (hasDrawerSelection) {
      const forced = resolveForcedHeight(handleValue, selection.drawers);
      return typeof forced === "number" && forced !== heightLocked;
    }

    const possible = resolvePossibleForcedHeights(handleValue);
    return possible.length > 0 && !possible.includes(heightLocked);
  };

  const handles: OptionState<string>[] = allowedHandles.length
    ? HANDLE_OPTIONS.map((option) => {
        if (!allowedHandles.includes(option.value)) {
          return { ...option, enabled: false, reason: "Not available for selected cabinet type" };
        }

        if (option.value === "handle_urban_botcut" && !isDrawerAllowed) {
          return { ...option, enabled: false, reason: CENTRAL_GROOVE_REASON };
        }

        if (heightLockedReason && isHandleLockedConflict(option.value)) {
          return { ...option, enabled: false, reason: heightLockedReason };
        }

        return { ...option, enabled: true };
      })
    : [];

  const handleIsAllowed = selection.handle ? allowedHandles.includes(selection.handle) : false;

  // When no handle is explicitly selected, fall back to "handle_urban_topcut" for height computation.
  // This ensures the correct forced height is applied even before the user picks a handle,
  // since handle_urban_topcut is the default applied during auto-add.
  const DEFAULT_HANDLE = "handle_urban_topcut";
  const effectiveHandle =
    selection.handle && handleIsAllowed
      ? selection.handle
      : allowedHandles.includes(DEFAULT_HANDLE)
        ? DEFAULT_HANDLE
        : null;

  if (selection.handle && handleIsAllowed) {
    const raw = getRawMapping(selection.handle);
    if (raw && !selection.drawers) {
      violations.push({ field: "drawers", reason: "Select drawers to determine height for selected handle" });
    }
  }

  const forcedHeight = effectiveHandle ? resolveForcedHeight(effectiveHandle, selection.drawers) : null;
  const forcedHeightConflictsLock =
    typeof heightLocked === "number" && typeof forcedHeight === "number" && forcedHeight !== heightLocked;
  const hasForcedHeight =
    typeof forcedHeight === "number" &&
    heightOptions.some((option) => option.value === forcedHeight && option.enabled) &&
    supportsHeightForAllProducts(context.selectedProductIds, catalog, forcedHeight);

  if (effectiveHandle === "handle_pto" && hasForcedHeight && !forcedHeightConflictsLock) {
    heightOptions = constrainHeightOptions(heightOptions, forcedHeight, HANDLE_HEIGHT_REASON);
  } else if (effectiveHandle === "handle_urban_topcut" && hasForcedHeight && !forcedHeightConflictsLock) {
    heightOptions = constrainHeightOptions(heightOptions, forcedHeight, DEFAULT_HANDLE_HEIGHT_REASON);
  } else if (effectiveHandle === "handle_urban_botcut" && hasForcedHeight && isDrawerAllowed && !forcedHeightConflictsLock) {
    heightOptions = constrainHeightOptions(heightOptions, forcedHeight, HANDLE_HEIGHT_REASON);
  }

  return {
    ...ruleResult,
    violations,
    availableOptions: {
      ...ruleResult.availableOptions,
      height: heightOptions,
      handles,
    },
  };
};
