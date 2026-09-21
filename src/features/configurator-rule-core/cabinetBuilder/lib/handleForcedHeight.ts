import { parseHeightMapping, resolveForcedHeight } from "@/entities/collection";
import type { CabinetHandleRelations } from "@/entities/collection";
import type { ConfiguratorCatalog, TypeCabinetRuleConfig } from "@/shared/config/configurator/typeCabinetCatalog";

export { parseHeightMapping };

/**
 * Adapts a catalog rule to the generic handle relations.
 * The rule already carries normalized maps, so no handle id appears here.
 */
export const toHandleRelations = (rule: TypeCabinetRuleConfig | undefined): CabinetHandleRelations | null => {
  if (!rule) return null;

  return {
    cabinetType: rule.code,
    forcedHeightByHandle: rule.forcedHeightByHandle ?? {},
    forcedHeightByDrawers: rule.forcedHeightByDrawers ?? {},
    requiresDrawersByHandle: rule.requiresDrawersByHandle ?? {},
  };
};

export const resolveForcedHeightForHandle = (args: {
  catalog: ConfiguratorCatalog;
  cabinetType: string | null;
  drawers: string | null;
  handle: string | null;
}): number | null => {
  const { catalog, cabinetType, drawers, handle } = args;
  if (!cabinetType || !drawers || !handle) return null;

  const rule = catalog.typeCabinetRules.find((entry) => entry.code === cabinetType);

  return resolveForcedHeight(toHandleRelations(rule), handle, drawers);
};
