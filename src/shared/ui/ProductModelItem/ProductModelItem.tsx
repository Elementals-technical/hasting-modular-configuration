import { Link } from "react-router-dom";

import { ArrowTopRight } from "@/shared/assets/images/svg/ArrowTopRight";

import { Hint } from "../Hint/Hint";

import s from "./ProductModelItem.module.scss";

interface ProductModelGridI {
  id: number;
  title: string;
  img: string;
  desc: string;
  isProductModel: boolean;
  price: string;
  presetProducts?: Array<{ name: string }>;
  onClick: (presetProducts: any) => void;
}

export const ProductModelItem: React.FC<ProductModelGridI> = ({
  id,
  title,
  desc,
  img,
  isProductModel,
  price,
  onClick,
  presetProducts,
}) => {
  return (
    <div className={s.productModelItem}>
      <div
        className={s.optionImage}
        onClick={() => {
          onClick(presetProducts);
        }}
      >
        <Hint
          content="Take this pre-built model into custom mode for full design control. Use our drag-n-drop editor to add/remove/reposition cabinets and more."
          placement="top"
          trigger="hover"
        >
          <div className={s.innerButton}>
            Customize
            <ArrowTopRight />
          </div>
        </Hint>
        <img src={img} alt="image" />
      </div>
      <div
        onClick={() => {
          onClick(presetProducts);
        }}
        className={s.title}
      >
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
