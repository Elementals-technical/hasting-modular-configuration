import color_img from "../../assets/images/jpeg/colorImage.jpg";
import none_img from "../../assets/images/png/none_img.png";
import { Hint } from "../Hint/Hint";

import s from "./ProductOptionItem.module.scss";

interface ProductOptionItemI {
  id: number;
  title: string;
  desc?: string | undefined;
  isAvailable?: boolean;
}

export const ProductOptionItem: React.FC<ProductOptionItemI> = ({ id, title, desc, isAvailable }) => {
  const available = isAvailable ?? true; // undefined as available

  return (
    <div className={s.productOption}>
      <div className={s.image}>
        <img src={title !== "None" ? color_img : none_img} alt="color image" />
      </div>

      {available ? (
        <div className={`${s.title} `}>{title}</div>
      ) : (
        <Hint className={s.optionHint} content={"Not available for Mineralmaro Countertop"}>
          <div className={`${s.title} ${s.titleDisabled}`}>{title}</div>
        </Hint>
      )}

      <div className={s.desc}>{desc}</div>
    </div>
  );
};
