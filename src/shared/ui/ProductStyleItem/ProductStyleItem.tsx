import { Link } from "react-router-dom";

import { ArrowTopRight } from "@/shared/assets/images/svg/ArrowTopRight";
import none_img from "../../assets/images/png/img_png.png";
import { Hint } from "../Hint/Hint";

import s from "./ProductStyleItem.module.scss";

interface ProductStyleItemI {
  id: number;
  title: string;
  imageSrc?: string;
  handleOpenStyleSidebar: () => void;
  isActive?: boolean;
  onSelectStyle?: (id: number) => void;
  isAvailable?: boolean;
  disabledReason?: string;
  isMixingRestricted?: boolean;
  onMixingRestrictedSelect?: (id: number) => void;
}

export const ProductStyleItem: React.FC<ProductStyleItemI> = ({
  id,
  title,
  imageSrc,
  handleOpenStyleSidebar,
  isActive = false,
  onSelectStyle,
  isAvailable = true,
  disabledReason,
  isMixingRestricted = false,
  onMixingRestrictedSelect,
}) => {
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

  return (
    <div className={itemClass} onClick={handleClick}>
      <div className={s.image}>
        <img src={imageSrc ?? none_img} alt="image" />
      </div>
      {!isAvailable ? (
        <Hint className={s.optionHint} content={disabledReason ?? "Not available for selected configuration"}>
          <div className={`${s.title} ${s.titleDisabled}`}>{title}</div>
        </Hint>
      ) : isMixingRestricted ? (
        <Hint
          className={s.optionHint}
          content={"Cannot mix 1 Drawer and 2 Drawer cabinet styles in one vanity configuration."}
        >
          <div className={`${s.title} ${s.titleDisabled}`}>{title}</div>
        </Hint>
      ) : (
        <div className={s.title}>{title}</div>
      )}

      <Link
        className={s.link}
        to={`#`}
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
};
