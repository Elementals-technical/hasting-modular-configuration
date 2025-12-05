import { Link } from "react-router-dom";

import { ArrowTopRight } from "@/shared/assets/images/svg/ArrowTopRight";

import s from "./ProductModelItem.module.scss";
import { Hint } from "../Hint/Hint";
import { addProduct } from "@/utils/functions/playcanvas/addProduct";

interface ProductModelGridI {
  id: number;
  title: string;
  img: string;
  desc: string;
  isProductModel: boolean;
  price: string;
  presetProducts?: Array<{ name: string }>;
}

export const ProductModelItem: React.FC<ProductModelGridI> = ({ id, title, desc, img, isProductModel, price }) => {
  const handleCustomize = async (name: string) => {
    try {
      await addProduct(name);
    } catch (error) {
      console.error("[ProductModelItem] Failed to apply preset", error);
    }
  };

  return (
    <div
      className={s.productModelItem}
      onClick={() => {
        handleCustomize(title);
      }}
    >
      <div className={s.optionImage}>
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
      <div className={s.title}>{title}</div>
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
