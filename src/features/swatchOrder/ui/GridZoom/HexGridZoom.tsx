import { AttributeHelper } from "../../lib/AttributeHelper";
import type { AttributeValue } from "../../model/types";
import s from "./GridZoom.module.scss";

const DEFAULT_HEX = "#e5e5e5";

export const HexGridZoom = ({ item }: { item: AttributeValue }) => {
  const hex = AttributeHelper.getHexColor(item) ?? DEFAULT_HEX;
  return <div className={s.tile} style={{ backgroundColor: hex }} aria-hidden />;
};
