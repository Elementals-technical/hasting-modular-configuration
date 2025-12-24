import type { MouseEvent } from "react";
import { Link } from "react-router-dom";

import { ArrowTopRight } from "@/shared/assets/images/svg/ArrowTopRight";
import { type PresetProduct } from "@/entities/product/types";

import { Hint } from "../Hint/Hint";

import s from "./ProductModelItem.module.scss";

interface ProductModelGridI {
  id: number;
  title: string;
  img: string;
  desc: string;
  isProductModel: boolean;
  price: string;
  presetProducts?: PresetProduct[];
  onSelect: (presetProducts?: PresetProduct[]) => void;
  onCustomize?: (presetProducts?: PresetProduct[]) => void;
  isActive?: boolean;
}

export const ProductModelItem: React.FC<ProductModelGridI> = ({
  id,
  title,
  desc,
  img,
  isProductModel,
  price,
  onSelect,
  onCustomize,
  presetProducts,
  isActive,
}) => {
  const className = [s.productModelItem, isActive ? s.active : ""].filter(Boolean).join(" ");
  const handleSelect = () => onSelect(presetProducts);
  const handleCustomize = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();

    if (onCustomize) {
      onCustomize(presetProducts);
      return;
    }

    onSelect(presetProducts);
  };

  return (
    <div className={className}>
      <div className={s.optionImage} onClick={handleSelect}>
        <Hint
          content="Take this pre-built model into custom mode for full design control. Use our drag-n-drop editor to add/remove/reposition cabinets and more."
          placement="top"
          trigger="hover"
        >
          <div className={s.innerButton} onClick={handleCustomize}>
            Customize
            <ArrowTopRight />
          </div>
        </Hint>
        <img src={img} alt="image" />
      </div>
      <div onClick={handleSelect} className={s.title}>
        {title}
      </div>
      <div className={s.desc}>{desc}</div>

      {isProductModel && (
        <Link className={s.link} to={`/prebuilt/model/${id}`}>
          <span>Product Details</span>
          <span className={s.linkIcon}>
            <ArrowTopRight color={"#ad5534"} />
          </span>
        </Link>
      )}
      <div className={s.price}>{price}</div>
    </div>
  );
};
