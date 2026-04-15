import { AttributeHelper } from "../../lib/AttributeHelper";
import { ImageGridZoom } from "../GridZoom/ImageGridZoom";
import { HexGridZoom } from "../GridZoom/HexGridZoom";
import { CheckMarkIconSVG } from "../icons/CheckMarkIconSVG";
import type { AttributeValue } from "../../model/types";
import s from "./MaterialListItem.module.scss";

interface MaterialListItemProps {
  val: AttributeValue;
  isSelected: boolean;
  onClick: (item: AttributeValue) => void;
}

export const MaterialListItem = ({ val, isSelected, onClick }: MaterialListItemProps) => {
  const hasImage = Boolean(AttributeHelper.getImage(val));

  return (
    <div className={s.cell}>
      <button
        type="button"
        onClick={() => onClick(val)}
        className={`${s.tileBtn} ${isSelected ? s.tileBtnSelected : ""}`}
        aria-pressed={isSelected}
      >
        <span className={s.tile}>
          {hasImage ? <ImageGridZoom item={val} /> : <HexGridZoom item={val} />}
        </span>
        <span className={`${s.check} ${isSelected ? s.checkSelected : ""}`} aria-hidden>
          <CheckMarkIconSVG width={12} height={9} />
        </span>
      </button>
      <div className={s.meta}>
        <span className={s.title}>{val.metadata?.label ?? val.label}</span>
        <span className={s.desc}>{val.parentName}</span>
      </div>
    </div>
  );
};
