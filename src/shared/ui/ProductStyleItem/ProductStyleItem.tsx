import { Link } from "react-router-dom";

import { ArrowTopRight } from "@/shared/assets/images/svg/ArrowTopRight";
import none_img from "../../assets/images/png/img_png.png";
import { Hint } from "../Hint/Hint";

import s from "./ProductStyleItem.module.scss";
import { useReasonText, type MessageParams } from "@/shared/lib/reasonText";

/** Shown when a style is unavailable and its rule named no reason. */
const UNAVAILABLE_OPTION_REASON_CODE = "ui.optionUnavailable";
/** The collection does not allow this style next to the cabinets already placed. */
const MIXING_RESTRICTED_REASON_CODE = "drawers.mixingRestricted";

interface ProductStyleItemI {
  id: number;
  title: string;
  imageSrc?: string;
  detailsTo?: string;
  handleOpenStyleSidebar: () => void;
  isActive?: boolean;
  onSelectStyle?: (id: number) => void;
  isAvailable?: boolean;
  /** Text a caller resolved itself; used while its rule has no reason code. */
  disabledReason?: string;
  /** Stable reason code; the interface resolves it (`shared/lib/reasonText`). */
  disabledReasonCode?: string;
  disabledReasonParams?: MessageParams;
  isMixingRestricted?: boolean;
  onMixingRestrictedSelect?: (id: number) => void;
}

export const ProductStyleItem: React.FC<ProductStyleItemI> = ({
  id,
  title,
  imageSrc,
  detailsTo = "#",
  handleOpenStyleSidebar,
  isActive = false,
  onSelectStyle,
  isAvailable = true,
  disabledReason,
  disabledReasonCode,
  disabledReasonParams,
  isMixingRestricted = false,
  onMixingRestrictedSelect,
}) => {
  const reasonText = useReasonText();

  const handleClick = () => {
    if (isMixingRestricted) {
      onMixingRestrictedSelect?.(id);
      return;
    }

    if (!isAvailable) return;

    onSelectStyle?.(id);
    handleOpenStyleSidebar();
  };

  const itemClass = [
    s.productStyleItem,
    isActive ? s.activeItem : "",
    !isAvailable ? s.disabled : "",
    isAvailable && isMixingRestricted ? s.restricted : "",
  ]
    .filter(Boolean)
    .join(" ");

  const hintContent = !isAvailable
    ? reasonText({
        code: disabledReasonCode ?? UNAVAILABLE_OPTION_REASON_CODE,
        params: disabledReasonParams,
        text: disabledReason,
      })
    : isMixingRestricted
      ? reasonText({ code: MIXING_RESTRICTED_REASON_CODE })
      : null;

  const card = (
    <div className={itemClass} onClick={handleClick}>
      <div className={s.image}>
        <img src={imageSrc ?? none_img} alt="image" />
      </div>
      {!isAvailable || isMixingRestricted ? (
        <div className={`${s.title} ${s.titleDisabled}`}>{title}</div>
      ) : (
        <div className={s.title}>{title}</div>
      )}

      <Link
        className={s.link}
        to={detailsTo}
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <span>Product Details</span>
        <span className={s.linkIcon}>
          <ArrowTopRight color={"#ad5534"} />
        </span>
      </Link>
    </div>
  );

  if (!hintContent) return card;

  return (
    <Hint className={s.optionHint} content={hintContent} placement="top">
      {card}
    </Hint>
  );
};
