import { Link } from "react-router-dom";

import { ArrowTopRight } from "@/shared/assets/images/svg/ArrowTopRight";
import none_img from "../../assets/images/png/img_png.png";

import s from "./ProductStyleItem.module.scss";

interface ProductStyleItemI {
  id: number;
  title: string;
  imageSrc?: string;
  handleOpenStyleSidebar: () => void;
  isActive?: boolean;
  onSelectStyle?: (id: number) => void;
  isAvailable?: boolean;
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
  isMixingRestricted = false,
  onMixingRestrictedSelect,
}) => {
  const isClickable = isAvailable && !isMixingRestricted;

  const handleClick = () => {
    if (!isAvailable) return;

    if (isMixingRestricted) {
      onMixingRestrictedSelect?.(id);
      return;
    }

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
    <div className={itemClass}>
      <div className={s.image} onClick={handleClick}>
        <img src={imageSrc ?? none_img} alt="image" />
      </div>
      <div className={s.title}>{title}</div>

      <Link className={s.link} to={`#`}>
        <span>Product Details</span>
        <span className={s.linkIcon}>
          <ArrowTopRight color={"#ad5534"} />
        </span>
      </Link>
    </div>
  );
};
