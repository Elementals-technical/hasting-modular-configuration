import noGrooveImage from "@/shared/assets/images/jpeg/no_groove.jpg";
import oneGrooveUpperImage from "@/shared/assets/images/jpeg/1_groove_upper.jpg";
import oneGrooveCentralImage from "@/shared/assets/images/jpeg/1_groove_central.jpg";
import twoGrooveImage from "@/shared/assets/images/jpeg/2_groove.jpg";
import dividerOptionAImage from "@/shared/assets/images/jpeg/varA.jpg";
import dividerOptionBImage from "@/shared/assets/images/jpeg/varB.jpg";
import dividerOptionCImage from "@/shared/assets/images/jpeg/varC.jpg";

/** Pictures of the side panel groove options, by profile value. */
export const sidePanelOptionImages: Record<string, string> = {
  NoG: noGrooveImage,
  UpperG: oneGrooveUpperImage,
  CenterG: oneGrooveCentralImage,
  DoubleG: twoGrooveImage,
};

/** Pictures of the divider styles, by profile value. */
export const dividerStyleOptionImages: Record<string, string> = {
  A: dividerOptionAImage,
  B: dividerOptionBImage,
  C: dividerOptionCImage,
};
