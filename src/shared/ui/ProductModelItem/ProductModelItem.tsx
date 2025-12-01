import { Link } from "react-router-dom";

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
    <div className={s.productOptionItem}>
      <div className={s.optionImage}>
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
