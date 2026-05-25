import type { AttributeValue } from "../model/types";
import { AttributeHelper } from "./AttributeHelper";
import { getSwatchIdentity } from "./getSwatchIdentity";

export interface SwatchPreview {
  identity: string;
  value: string;
  label: string;
  materialLabel?: string;
  color: string;
  image?: string;
}

export const toSwatchPreview = (item: AttributeValue): SwatchPreview => {
  const value = item.metadata?.value ?? item.value ?? item.label;
  return {
    identity: getSwatchIdentity(item),
    value,
    label: AttributeHelper.getValueLabel(item),
    materialLabel: AttributeHelper.getMaterialDisplayName(item),
    color: AttributeHelper.getHexColor(item) ?? "#dcdcdc",
    image: AttributeHelper.getImage(item),
  };
};
