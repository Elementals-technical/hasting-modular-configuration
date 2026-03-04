import type { ConfiguratorCatalog } from "@/shared/config/configurator/typeCabinetCatalog";

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

const uniqueNumbers = (values: number[]) => Array.from(new Set(values)).sort((a, b) => a - b);

const buildDimensionUniverse = (catalog: ConfiguratorCatalog) => {
  const flatten = (items: number[][]) => items.reduce<number[]>((acc, item) => acc.concat(item), []);
  const width = uniqueNumbers(flatten(catalog.typeCabinetRules.map((rule) => rule.widths)));
  const depth = uniqueNumbers(flatten(catalog.typeCabinetRules.map((rule) => rule.depths)));
  const height = uniqueNumbers(flatten(catalog.typeCabinetRules.map((rule) => rule.heights)));
  const drawers = Array.from(new Set(catalog.typeCabinetRules.flatMap((rule) => rule.drawers)));

  return { width, depth, height, drawers };
};

const resolveHeightLock = (
  context: RuleContext,
  catalog: ConfiguratorCatalog,
): { heightLocked: number | null; intersection: number[] | null } => {
  const ids = context.selectedProductIds ?? [];
  if (ids.length === 0) {
    return { heightLocked: null, intersection: null };
  }

  const supportsLists: number[][] = [];

  for (const productId of ids) {
    const normalized = productId.toLowerCase();
    const rule = catalog.typeCabinetRules.find((entry) => normalized.includes(entry.code.toLowerCase()));
    if (!rule) {
      return { heightLocked: null, intersection: [] };
    }

    const supports = rule.supportsHeight?.length ? rule.supportsHeight : rule.heights;
    supportsLists.push(supports);
  }

  if (supportsLists.length === 0) {
    return { heightLocked: null, intersection: null };
  }

  const intersection = supportsLists[0].filter((value) =>
    supportsLists.every((list) => list.includes(value)),
  );

  if (intersection.length === 1) {
    return { heightLocked: intersection[0], intersection };
  }

  return { heightLocked: null, intersection };
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

export const typeCabinetRule = (catalog: ConfiguratorCatalog, context: RuleContext): RuleResult => {
  const { selection } = context;
  const ruleForType = catalog.typeCabinetRules.find((rule) => rule.code === selection.cabinetType);
  const hasActiveRule = Boolean(ruleForType);

  const dimensionUniverse = buildDimensionUniverse(catalog);
  const { heightLocked, intersection: heightIntersection } = resolveHeightLock(context, catalog);

  const allowedWidths = new Set(ruleForType?.widths ?? []);
  const allowedDepths = new Set(ruleForType?.depths ?? []);
  const allowedHeights = new Set(ruleForType?.heights ?? []);
  const allowedDrawers = new Set(ruleForType?.drawers ?? []);

  const reason = "Not available for selected cabinet type";

  const widths = buildOptions(dimensionUniverse.width, allowedWidths, reason, !hasActiveRule);
  const depths = buildOptions(dimensionUniverse.depth, allowedDepths, reason, !hasActiveRule);
  const heights = buildOptions(dimensionUniverse.height, allowedHeights, reason, !hasActiveRule);
  const drawers = buildOptions(dimensionUniverse.drawers, allowedDrawers, reason, !hasActiveRule);

  const violations: Violation[] = [];
  let heightOptions = heights.options;

  if (heightIntersection?.length === 0) {
    const heightConflictReason = "No common supported height across selected products";
    heightOptions = heightOptions.map((option) => {
      if (!option.enabled) {
        return option.reason ? option : { ...option, reason: heightConflictReason };
      }

      return { ...option, enabled: false, reason: heightConflictReason };
    });
    violations.push({ field: "height", reason: heightConflictReason });
  } else if (typeof heightLocked === "number") {
    heightOptions = constrainHeightOptions(heightOptions, heightLocked, "Height locked by existing products");
  }

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
      height: heightOptions,
      drawers: drawers.options,
      handles: [],
    },

    violations,
    heightLocked,
  };
};
