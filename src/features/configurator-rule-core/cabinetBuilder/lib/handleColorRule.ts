import { selectRuleData, type ProductProfile } from "@/entities/collection";

/**
 * The colours a handle comes in (`ruleData.handleColors`).
 *
 * Read from the profile's map, so no handle or collection is named. A collection without the
 * section, or a handle the map does not name, is not restricted.
 */

/** The colours `handle` comes in, the one it starts in first; undefined where it comes in every colour of the field. */
export const selectHandleColors = (
  profile: ProductProfile | null,
  handle: string | null | undefined,
): readonly string[] | undefined =>
  handle ? selectRuleData(profile, "handleColors")?.allowedByHandle[handle] : undefined;

/** The colour `handle` holds after a change: `current` where it comes in it, else the one it starts in. */
export const resolveHandleColor = (
  profile: ProductProfile | null,
  handle: string | null | undefined,
  current: string,
): string => {
  const colors = selectHandleColors(profile, handle);
  return !colors || colors.includes(current) ? current : colors[0];
};
