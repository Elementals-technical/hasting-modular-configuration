import { AttributeHelper } from "../../lib/AttributeHelper";
import type { AttributeValue } from "../../model/types";
import s from "./GridZoom.module.scss";

export const ImageGridZoom = ({ item }: { item: AttributeValue }) => {
  const imageUrl = AttributeHelper.getImage(item);
  const valueLabel = AttributeHelper.getValueLabel(item);
  const needsLightBorder = AttributeHelper.getNeedsLightBorder(item);

  return (
    <div className={`${s.tile} ${needsLightBorder ? s.lightBorder : ""}`}>
      {imageUrl ? <img src={imageUrl} alt={valueLabel} loading="lazy" className={s.img} /> : null}
    </div>
  );
};
