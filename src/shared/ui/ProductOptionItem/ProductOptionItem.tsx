import color_img from "../../assets/images/jpeg/colorImage.jpg";
import none_img from "../../assets/images/png/none_img.png";

import s from "./ProductOptionItem.module.scss";

interface ProductOptionItemI {
  id: number;
  title: string;
  desc?: string | undefined;
}

export const ProductOptionItem: React.FC<ProductOptionItemI> = ({ id, title, desc }) => {
  return (
    <div className={s.productOption}>
      <div className={s.image}>
        <img src={title !== "None" ? color_img : none_img} alt="color image" />
      </div>

      <div className={s.title}>{title}</div>
      <div className={s.desc}>{desc}</div>
    </div>
  );
};
