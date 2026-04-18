import type { AttributeValue } from "../model/types";
import { AttributeHelper } from "./AttributeHelper";

export interface SwatchPreview {
  value: string;
  label: string;
  color: string;
  image?: string;
}

export const toSwatchPreview = (item: AttributeValue): SwatchPreview => {
  const value = item.metadata?.value ?? item.value ?? item.label;
  return {
    value,
    label: AttributeHelper.getValueLabel(item),
    color: AttributeHelper.getHexColor(item) ?? "#dcdcdc",
    image: AttributeHelper.getImage(item),
  };
};
