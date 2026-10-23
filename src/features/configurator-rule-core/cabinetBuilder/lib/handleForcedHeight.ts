import { parseHeightMapping, resolveForcedHeight } from "@/entities/collection";
import type { CabinetHandleRelations } from "@/entities/collection";
import {
  findCabinetRule,
  type ConfiguratorCatalog,
  type TypeCabinetRuleConfig,
} from "@/shared/config/configurator/typeCabinetCatalog";

import { findPlacedCabinetRule } from "./placedCabinetRule";

export { parseHeightMapping };

/**
 * The heights each handle gives a cabinet of the rule (Urban Low Height: upper groove 38/28 cm,
 * push-to-open 35/25 cm). The cabinets of a composition share one height, so a type whose own
 * handle decides none (the open shelf, which has no handle) takes those of the placed cabinets.
 */
export const resolveHeightsByHandle = (
  catalog: ConfiguratorCatalog,
  rule: TypeCabinetRuleConfig | null | undefined,
  placedProductIds: readonly string[] = [],
): Record<string, number[]> => {
  const decides = (heights: Record<string, number[]> | undefined) => Object.keys(heights ?? {}).length > 0;
  if (decides(rule?.heightsByHandle)) return rule?.heightsByHandle ?? {};

  return (
    placedProductIds.map((runtimeId) => findPlacedCabinetRule(catalog, runtimeId)?.heightsByHandle).find(decides) ?? {}
  );
};

/**
 * Adapts a catalog rule to the generic handle relations.
 * The rule already carries normalized maps, so no handle id appears here.
 */
export const toHandleRelations = (rule: TypeCabinetRuleConfig | null | undefined): CabinetHandleRelations | null => {
  if (!rule) return null;

  return {
    cabinetType: rule.code,
    forcedHeightByHandle: rule.forcedHeightByHandle ?? {},
    forcedHeightByDrawers: rule.forcedHeightByDrawers ?? {},
    requiresDrawersByHandle: rule.requiresDrawersByHandle ?? {},
    heightsByHandle: rule.heightsByHandle ?? {},
    heightsByDrawers: rule.heightsByDrawers ?? {},
  };
};

export const resolveForcedHeightForHandle = (args: {
  catalog: ConfiguratorCatalog;
  cabinetType: string | null;
  drawers: string | null;
  handle: string | null;
  series?: string | null;
}): number | null => {
  const { catalog, cabinetType, drawers, handle, series } = args;
  if (!cabinetType || !drawers || !handle) return null;

  const rule = findCabinetRule(catalog, cabinetType, series);

  return resolveForcedHeight(toHandleRelations(rule), handle, drawers);
};
