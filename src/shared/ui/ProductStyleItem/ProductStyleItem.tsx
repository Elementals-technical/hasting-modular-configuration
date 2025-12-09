import { Link } from "react-router-dom";

import { ArrowTopRight } from "@/shared/assets/images/svg/ArrowTopRight";
import none_img from "../../assets/images/png/img_png.png";

import s from "./ProductStyleItem.module.scss";

interface ProductStyleItemI {
  id: number;
  title: string;
}

export const ProductStyleItem: React.FC<ProductStyleItemI> = ({ title }) => {
  return (
    <div className={s.productStyleItem}>
      <div className={s.image}>
        <img src={none_img} alt="image" />
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
