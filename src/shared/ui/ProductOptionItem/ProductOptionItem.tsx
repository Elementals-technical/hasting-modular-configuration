import color_img from "../../assets/images/png/img_png.png";
import none_img from "../../assets/images/png/none_img.png";
import { Hint } from "../Hint/Hint";

import { HintOptionIcon } from "@/shared/assets/images/svg/HintOptionIcon";

import s from "./ProductOptionItem.module.scss";
import type { addProductConfigI } from "@/utils/functions/playcanvas/addProduct";

interface ProductOptionItemI {
  id: number | string;
  title: string;
  desc?: string | undefined;
  isAvailable?: boolean;
  name?: string;
  isShortDesc: boolean;
  config?: addProductConfigI;
  isActive?: boolean;
  onClick?: (name: string, config?: addProductConfigI) => void | Promise<void>;
  setActive?: (id: number | string) => void;
  metadata?: Record<string, unknown>;
}

export const ProductOptionItem: React.FC<ProductOptionItemI> = ({
  id,
  title,
  desc,
  isAvailable,
  isShortDesc,
  name,
  config,
  isActive = false,
  onClick,
  setActive,
  metadata,
}) => {
  const available = isAvailable ?? true; // undefined as available
  const productName = name ?? title;

  return (
    <div
      className={`${s.productOption} ${isActive ? s.activeItem : ""}`}
      onClick={() => {
        onClick?.(productName, config);
        setActive?.(id);
      }}
    >
      <div className={s.image}>
        <img src={title !== "None" ? color_img : none_img} alt="color image" />
      </div>

      {available ? (
        <div className={`${s.title} ${s.titleHint}`}>
          {title}

          {isShortDesc && (
            <Hint
              className={s.optionHint_descr}
              placement="right"
              content={"Hint with dimensions & short description "}
            >
              <span className={s.descIcon}>
                <HintOptionIcon />
              </span>
            </Hint>
          )}
        </div>
      ) : (
        <Hint className={s.optionHint} content={"Not available for Mineralmaro Countertop"}>
          <div className={`${s.title} ${s.titleDisabled}`}>{title}</div>
        </Hint>
      )}

      <div className={s.desc}>{desc}</div>
    </div>
  );
};
