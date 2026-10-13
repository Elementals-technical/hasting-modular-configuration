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
export const heightsOfDrawerStyle = (rule: TypeCabinetRuleConfig, drawers: string): readonly number[] | null => {
  const choices = rule.heightsByDrawers?.[drawers];
  if (choices?.length) return choices;

  const forced = rule.forcedHeightByDrawers?.[drawers];
  return typeof forced === "number" ? [forced] : null;
};

/**
 * A cabinet of this type and drawers cannot take the height of a placed cabinet. A cabinet
 * another series supplies is judged too: it comes in the heights of its series only.
 */
export const isDrawerStyleHeightRestricted = (
  rule: TypeCabinetRuleConfig | null | undefined,
  drawers: string,
  placedHeights: readonly number[],
): boolean => {
  if (!rule) return false;
  if (!rule.series && Object.keys(rule.heightsByDrawers ?? {}).length === 0) return false;

  const heights = heightsOfDrawerStyle(rule, drawers);
  return heights !== null && placedHeights.some((placed) => !heights.includes(placed));
};

/** What switching every drawer cabinet to a style leaves the composition with. */
export type DrawerStyleSwitch =
  /** A placed cabinet of another series does not come in the style, or in none of its heights. */
  | { possible: false }
  /** The height the composition takes; null where the style decides none. */
  | { possible: true; height: number | null };

/**
 * The height of the composition once every drawer cabinet takes a style: one the style comes in
 * and every placed cabinet of another series comes in with it, the nearest to the height the
 * composition has. An Urban Low Height cabinet has one drawer at 38 or 28 cm, so a composition it
 * stands in cannot switch to two drawers, which are 56 cm.
 */
export const resolveDrawerStyleSwitch = ({
  rule,
  drawers,
  placedHeight,
  placedSeriesRules,
}: {
  /** The rule of the cabinet being added. */
  rule: TypeCabinetRuleConfig | null | undefined;
  drawers: string;
  /** The height the placed cabinets share. */
  placedHeight: number | null;
  /** The rule of each placed cabinet another series supplies. */
  placedSeriesRules: readonly TypeCabinetRuleConfig[];
}): DrawerStyleSwitch => {
  const lists = [
    rule ? heightsOfDrawerStyle(rule, drawers) : null,
    ...placedSeriesRules.map((placed) =>
      placed.drawers.includes(drawers) ? (heightsOfDrawerStyle(placed, drawers) ?? placed.heights) : [],
    ),
  ].filter((heights): heights is readonly number[] => heights !== null);

  if (lists.length === 0) return { possible: true, height: null };

  const shared = lists[0].filter((height) => lists.every((heights) => heights.includes(height)));
  if (shared.length === 0) return { possible: false };
  if (placedHeight === null) return { possible: true, height: null };

  return {
    possible: true,
    height: shared.reduce((nearest, height) =>
      Math.abs(height - placedHeight) < Math.abs(nearest - placedHeight) ? height : nearest,
    ),
  };
};
