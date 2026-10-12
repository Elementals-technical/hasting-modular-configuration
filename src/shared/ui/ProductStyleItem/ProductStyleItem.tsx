import { Link, type To } from "react-router-dom";

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
  /** The option value this card stands for; it is the card's identity. */
  value: string;
  title: string;
  imageSrc?: string;
  detailsTo?: To;
  handleOpenStyleSidebar: () => void;
  isActive?: boolean;
  onSelectStyle?: (value: string) => void;
  isAvailable?: boolean;
  /** Text a caller resolved itself; used while its rule has no reason code. */
  disabledReason?: string;
  /** Stable reason code; the interface resolves it (`shared/lib/reasonText`). */
  disabledReasonCode?: string;
  disabledReasonParams?: MessageParams;
  isMixingRestricted?: boolean;
  onMixingRestrictedSelect?: (value: string) => void;
}

export const ProductStyleItem: React.FC<ProductStyleItemI> = ({
  value,
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
    if (!isAvailable) return;

    if (isMixingRestricted) {
      onMixingRestrictedSelect?.(value);
      return;
    }

    onSelectStyle?.(value);
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
    <div className={itemClass}>
      <button
        type="button"
        className={s.selectButton}
        aria-label={title}
        aria-pressed={isActive}
        aria-disabled={!isAvailable || undefined}
        onClick={handleClick}
      >
        <span className={s.image}>
          <img src={imageSrc ?? none_img} alt="" />
        </span>
        {!isAvailable || isMixingRestricted ? (
          <span className={`${s.title} ${s.titleDisabled}`}>{title}</span>
        ) : (
          <span className={s.title}>{title}</span>
        )}
      </button>

      <Link className={s.link} to={detailsTo}>
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
