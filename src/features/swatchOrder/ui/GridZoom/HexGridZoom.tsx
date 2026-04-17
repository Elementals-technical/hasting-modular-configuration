import { AttributeHelper } from "../../lib/AttributeHelper";
import type { AttributeValue } from "../../model/types";
import s from "./GridZoom.module.scss";

const DEFAULT_HEX = "#e5e5e5";

export const HexGridZoom = ({ item }: { item: AttributeValue }) => {
  const hex = AttributeHelper.getHexColor(item) ?? DEFAULT_HEX;
  const needsLightBorder = AttributeHelper.getNeedsLightBorder(item);
  return (
    <div
      className={`${s.tile} ${needsLightBorder ? s.lightBorder : ""}`}
      style={{ backgroundColor: hex }}
      aria-hidden
    />
  );
};
