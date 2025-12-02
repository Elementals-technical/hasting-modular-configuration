import { Link } from "react-router-dom";

import { ArrowTopRight } from "@/shared/assets/images/svg/ArrowTopRight";

import s from "./ProductModelItem.module.scss";

interface ProductModelGridI {
  id: number;
  title: string;
  img: string;
  desc: string;
  isProductModel: boolean;
  price: string;
}

export const ProductModelItem: React.FC<ProductModelGridI> = ({ title, desc, img, isProductModel, price }) => {
  return (
    <div className={s.productModelItem}>
      <div className={s.optionImage}>
        <div className={s.innerButton}>
          Customize
          <ArrowTopRight />
        </div>
        <img src={img} alt="image" />
      </div>
      <div className={s.title}>{title}</div>
      <div className={s.desc}>{desc}</div>
      {isProductModel && (
        <Link className={s.link} to={""}>
          Product Details
        </Link>
      )}
      <div className={s.price}>{price}</div>
    </div>
  );
};
