import oneGrooveCentralImage from "@/shared/assets/images/jpeg/1_groove_central.jpg";
import oneGrooveUpperImage from "@/shared/assets/images/jpeg/1_groove_upper.jpg";
import twoGrooveImage from "@/shared/assets/images/jpeg/2_groove.jpg";
import noGrooveImage from "@/shared/assets/images/jpeg/no_groove.jpg";
import dividerOptionAImage from "@/shared/assets/images/jpeg/varA.jpg";
import dividerOptionBImage from "@/shared/assets/images/jpeg/varB.jpg";
import dividerOptionCImage from "@/shared/assets/images/jpeg/varC.jpg";

/**
 * Pictures of profile options, by option value. The ProductProfile holds no images: a page
 * joins these to the options it reads from the profile. An option without an entry is shown
 * without a picture, never dropped.
 *
 * The countertop step no longer lists its pictures here: basins and countertop styles come from
 * the active collection's `ui.json` (`optionImages`, read with `useOptionImages`). Side panels
 * and divider styles still wait for the same move.
 */

/** Basins whose card shows the short description layout. */
export const basinShortDescValues: ReadonlySet<string> = new Set(["Top_HPLPrisma"]);

/** SidePanels values; "None" has no picture. */
export const sidePanelOptionImages: Record<string, string> = {
  NoG: noGrooveImage,
  UpperG: oneGrooveUpperImage,
  CenterG: oneGrooveCentralImage,
  DoubleG: twoGrooveImage,
};

/** DividersStyle values. */
export const dividerStyleOptionImages: Record<string, string> = {
  A: dividerOptionAImage,
  B: dividerOptionBImage,
  C: dividerOptionCImage,
};
