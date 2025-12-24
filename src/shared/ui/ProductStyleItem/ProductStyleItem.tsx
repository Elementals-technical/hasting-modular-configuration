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
}

export const ProductStyleItem: React.FC<ProductStyleItemI> = ({
  id,
  title,
  imageSrc,
  handleOpenStyleSidebar,
  isActive = false,
  onSelectStyle,
  isAvailable = true,
}) => {
  const isClickable = isAvailable;

  const handleClick = () => {
    if (!isClickable) return;

    onSelectStyle?.(id);
    handleOpenStyleSidebar();
  };

  return (
    <div className={`${s.productStyleItem} ${isActive ? s.activeItem : ""} ${!isClickable ? s.disabled : ""}`}>
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
