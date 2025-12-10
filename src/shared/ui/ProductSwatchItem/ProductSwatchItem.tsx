import { Hint } from "../Hint/Hint";
import s from "./ProductSwatchItem.module.scss";
import { HintOptionIcon } from "@/shared/assets/images/svg/HintOptionIcon";

interface ProductSwatchItemI {
  title: string;
  isSwatchWithHint?: boolean;
}

export const ProductSwatchItem: React.FC<ProductSwatchItemI> = ({ title, isSwatchWithHint }) => {
  return (
    <button className={s.swatchItem}>
      <div className="title">{title}</div>

      {isSwatchWithHint && title !== "None" && (
        <Hint content={"Hint content"}>
          <div>
            <HintOptionIcon width="16" height="16" />
          </div>
        </Hint>
      )}
    </button>
  );
};
