import type { TypeCabinetRuleConfig } from "@/shared/config/configurator/typeCabinetCatalog";

/**
 * A cabinet style and the height of the cabinets already placed.
 *
 * Where drawers come in several heights (Urban Duplex: one drawer at 53, 38 or 28 cm), the
 * style groups no longer say how high the composition is: a cabinet with an inner drawer, 53 cm
 * only, is in the group of the one-drawer cabinets and cannot stand beside the Slim ones. Such a
 * style is mixed in as a style of another group is: every drawer cabinet switches to it.
 *
 * A collection whose drawers each have one height is not judged here; its groups say it all.
 */

/** The heights a cabinet comes in with these drawers; null when the drawers decide none. */
const heightsOfDrawers = (rule: TypeCabinetRuleConfig, drawers: string): readonly number[] | null => {
  const choices = rule.heightsByDrawers?.[drawers];
  if (choices?.length) return choices;

  const forced = rule.forcedHeightByDrawers?.[drawers];
  return typeof forced === "number" ? [forced] : null;
};

/** A cabinet of this type and drawers cannot take the height of a placed cabinet. */
export const isDrawerStyleHeightRestricted = (
  rule: TypeCabinetRuleConfig | null | undefined,
  drawers: string,
  placedHeights: readonly number[],
): boolean => {
  if (!rule || Object.keys(rule.heightsByDrawers ?? {}).length === 0) return false;

  const heights = heightsOfDrawers(rule, drawers);
  return heights !== null && placedHeights.some((placed) => !heights.includes(placed));
};
