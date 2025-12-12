import { Hint } from "../Hint/Hint";
import s from "./ProductSwatchItem.module.scss";
import { HintOptionIcon } from "@/shared/assets/images/svg/HintOptionIcon";

interface ProductSwatchItemI {
  title: string;
  isSwatchWithHint?: boolean;
  isActive?: boolean;
  onSelect?: () => void;
}

export const ProductSwatchItem: React.FC<ProductSwatchItemI> = ({ title, isSwatchWithHint, isActive, onSelect }) => {
  const classNames = [s.swatchItem, isActive ? s.active : ""].filter(Boolean).join(" ");

  return (
    <button className={classNames} onClick={onSelect} type="button">
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
