const TOWEL_BAR_OPTIONS: readonly string[] = ["None", "Left", "Right", "Both"];

/**
 * The towel bar option of a saved configuration. A legacy save names the scene's towel bar
 * ("TowelBar40_R") and its side instead of the option; the side then gives the option.
 */
export const resolveTowelBarOption = (option: string | undefined, side: string | undefined): string | undefined => {
  if (option && TOWEL_BAR_OPTIONS.includes(option)) return option;
  if (!option || !side) return undefined;

  const fromSide = side.charAt(0).toUpperCase() + side.slice(1).toLowerCase();
  return TOWEL_BAR_OPTIONS.includes(fromSide) ? fromSide : undefined;
};
