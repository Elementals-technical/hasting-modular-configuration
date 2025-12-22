import type { ConfiguratorCatalog } from "@/shared/config/configurator/typeCabinetCatalog";
import { typeCabinetDimensionUniverse } from "@/shared/config/configurator/typeCabinetCatalog";

import type { RuleContext, RuleResult } from "../model/types";
import type { OptionState, Violation } from "../model/types";

const buildOptions = <T>(
  universe: T[],
  allowed: Set<T>,
  reason: string,
  allowAllWhenEmpty: boolean,
): { options: OptionState<T>[] } => {
  if (!allowAllWhenEmpty && allowed.size === 0) {
    return { options: [] };
  }

  const isUnrestricted = allowAllWhenEmpty && allowed.size === 0;

  const options: OptionState<T>[] = universe.map((value) => ({
    value,
    label: String(value),
    enabled: isUnrestricted ? true : allowed.has(value),
    reason: isUnrestricted || allowed.has(value) ? undefined : reason,
  }));

  return { options };
};

export const typeCabinetRule = (catalog: ConfiguratorCatalog, context: RuleContext): RuleResult => {
  const { selection } = context;
  const ruleForType = catalog.typeCabinetRules.find((rule) => rule.id === selection.cabinetTypeId);
  const hasActiveRule = Boolean(ruleForType);

  const allowedWidths = new Set(ruleForType?.widths ?? []);
  const allowedDepths = new Set(ruleForType?.depths ?? []);
  const allowedHeights = new Set(ruleForType?.heights ?? []);
  const allowedDrawers = new Set(ruleForType?.drawers ?? []);

  const reason = "Not available for selected cabinet type";

  const widths = buildOptions(typeCabinetDimensionUniverse.width, allowedWidths, reason, !hasActiveRule);
  const depths = buildOptions(typeCabinetDimensionUniverse.depth, allowedDepths, reason, !hasActiveRule);
  const heights = buildOptions(typeCabinetDimensionUniverse.height, allowedHeights, reason, !hasActiveRule);
  const drawers = buildOptions(typeCabinetDimensionUniverse.drawers, allowedDrawers, reason, !hasActiveRule);

  const violations: Violation[] = [];

  const validateValue = <T>(value: T | undefined | null, allowed: Set<T>, field: Violation["field"]) => {
    if (!hasActiveRule) return;

    if (allowed.size === 0) {
      if (value !== undefined && value !== null) {
        violations.push({ field, reason });
      }

      return;
    }

    if (value !== undefined && value !== null && !allowed.has(value)) {
      violations.push({ field, reason });
    }
  };

  validateValue(selection.width, allowedWidths, "width");
  validateValue(selection.depth, allowedDepths, "depth");
  validateValue(selection.height, allowedHeights, "height");
  validateValue(selection.drawers, allowedDrawers, "drawers");

  return {
    availableOptions: {
      width: widths.options,
      depth: depths.options,
      height: heights.options,
      drawers: drawers.options,
      handles: [],
    },

    violations,
  };
};
