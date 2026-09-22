import {
  isHandleAllowedForDrawers,
  resolveDrawersForcedHeight,
  resolveForcedHeight,
  resolvePossibleForcedHeights,
  selectEffectiveFallback,
  selectMessage,
  selectOptions,
  type ProductProfile,
} from "@/entities/collection";
import type { ConfiguratorCatalog } from "@/shared/config/configurator/typeCabinetCatalog";
import { cmToInches } from "@/shared/lib/sku";

import type { OptionState, RuleContext, RuleResult } from "../model/types";
import { toHandleRelations } from "./handleForcedHeight";

/** Stable reason codes; the English fallback text lives in profile.messages. */
const REASON_CENTRAL_GROOVE_REQUIRES_DRAWERS = "handle.centralGrooveRequiresDrawers";
const REASON_REQUIRED_HEIGHT = "handle.requiredHeight";
const REASON_DEFAULT_REQUIRED_HEIGHT = "handle.defaultRequiredHeight";
const REASON_DRAWERS_REQUIRED_HEIGHT = "drawers.requiredHeight";
const REASON_NOT_AVAILABLE_FOR_CABINET_TYPE = "handle.notAvailableForCabinetType";
const REASON_SELECT_DRAWERS_FOR_HEIGHT = "handle.selectDrawersForHeight";

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
  profile: ProductProfile | null,
): RuleResult => {
  const { selection } = context;
  const activeRule = catalog.typeCabinetRules.find((rule) => rule.code === selection.cabinetType);
  const relations = toHandleRelations(activeRule);

  // Catalog of the active collection. No local list of handle ids.
  const handleCatalog = selectOptions(profile, "Handle");
  const catalogValues = handleCatalog.map((option) => option.value);

  // handles_allowed narrows the catalog for this cabinet type; an empty column means
  // "every catalog option", which is what the previous DEFAULT_ALLOWED_HANDLES did.
  const allowedHandles = activeRule?.handlesAllowed?.length ? activeRule.handlesAllowed : catalogValues;

  const heightLocked = ruleResult.heightLocked;
  const heightLockedReason =
    typeof heightLocked === "number"
      ? `Not available for current configuration height (${heightLocked} cm / ${cmToInches(heightLocked)}" locked)`
      : null;

  const hasDrawerSelection = selection.drawers !== null && selection.drawers !== undefined;

  const isDrawerAllowedFor = (handleValue: string): boolean =>
    isHandleAllowedForDrawers(relations, handleValue, selection.drawers ?? null);

  const hasDrawerRestriction = (handleValue: string): boolean =>
    (relations?.requiresDrawersByHandle[handleValue]?.length ?? 0) > 0;

  let heightOptions = ruleResult.availableOptions.height;
  const violations = [...ruleResult.violations];

  const isHandleLockedConflict = (handleValue: string): boolean => {
    if (typeof heightLocked !== "number") return false;

    if (hasDrawerSelection) {
      const forced = resolveForcedHeight(relations, handleValue, selection.drawers ?? null);
      return typeof forced === "number" && forced !== heightLocked;
    }

    const possible = resolvePossibleForcedHeights(relations, handleValue);
    return possible.length > 0 && !possible.includes(heightLocked);
  };

  const handles: OptionState<string>[] = allowedHandles.length
    ? handleCatalog.map((option) => {
        if (!allowedHandles.includes(option.value)) {
          return {
            value: option.value,
            label: option.label,
            enabled: false,
            reason: selectMessage(profile, REASON_NOT_AVAILABLE_FOR_CABINET_TYPE),
          };
        }

        if (heightLockedReason && isHandleLockedConflict(option.value)) {
          return { value: option.value, label: option.label, enabled: false, reason: heightLockedReason };
        }

        if (hasDrawerRestriction(option.value) && !isDrawerAllowedFor(option.value)) {
          return {
            value: option.value,
            label: option.label,
            enabled: false,
            reason: selectMessage(profile, REASON_CENTRAL_GROOVE_REQUIRES_DRAWERS),
            deferAutoChange: !hasDrawerSelection,
          };
        }

        return { value: option.value, label: option.label, enabled: true };
      })
    : [];

  const handleIsAllowed = selection.handle ? allowedHandles.includes(selection.handle) : false;

  // While nothing is selected, the collection's declared fallback drives the height
  // computation, matching the value auto-add applies. It is not the attribute's
  // initial value and must not be treated as a global default.
  const declaredFallback = selectEffectiveFallback(profile, "Handle");
  const effectiveHandle =
    selection.handle && handleIsAllowed
      ? selection.handle
      : declaredFallback && allowedHandles.includes(declaredFallback)
        ? declaredFallback
        : null;

  if (selection.handle && handleIsAllowed) {
    const hasMapping = Object.keys(relations?.forcedHeightByHandle[selection.handle] ?? {}).length > 0;
    if (hasMapping && !selection.drawers) {
      violations.push({ field: "drawers", reason: selectMessage(profile, REASON_SELECT_DRAWERS_FOR_HEIGHT) });
    }
  }

  const handleForcedHeight = resolveForcedHeight(relations, effectiveHandle, selection.drawers ?? null);
  // A handle's own height wins; otherwise the drawers may require one whatever the handle, or with none.
  const forcedHeight = handleForcedHeight ?? resolveDrawersForcedHeight(relations, selection.drawers ?? null);
  const forcedHeightConflictsLock =
    typeof heightLocked === "number" && typeof forcedHeight === "number" && forcedHeight !== heightLocked;
  const hasForcedHeight =
    typeof forcedHeight === "number" &&
    heightOptions.some((option) => option.value === forcedHeight && option.enabled) &&
    supportsHeightForAllProducts(context.selectedProductIds, catalog, forcedHeight);
  const handleAllowsDrawers =
    handleForcedHeight === null || (effectiveHandle !== null && isDrawerAllowedFor(effectiveHandle));

  if (hasForcedHeight && !forcedHeightConflictsLock && handleAllowsDrawers) {
    // The collection's fallback handle applies to every product, so its explanation
    // differs from an explicitly chosen handle; a height the drawers require names no
    // handle. The texts come from profile.messages.
    const reasonCode =
      handleForcedHeight === null
        ? REASON_DRAWERS_REQUIRED_HEIGHT
        : effectiveHandle === declaredFallback
          ? REASON_DEFAULT_REQUIRED_HEIGHT
          : REASON_REQUIRED_HEIGHT;

    heightOptions = constrainHeightOptions(heightOptions, forcedHeight as number, selectMessage(profile, reasonCode));
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
