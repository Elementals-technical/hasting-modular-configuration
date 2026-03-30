import { CloseBtnIcon } from "@/shared/assets/images/svg/CloseBtnIcon";
import { ProductOptionsGrid, type ProductOptionData } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";
import { PopupCenterContent } from "../PopupCenterContent/PopupCenterContent";

import s from "./FullModeColorsModal.module.scss";

interface FullModeColorsModalProps {
  isOpening: boolean;
  onClose: () => void;
  title: string;
  options: ProductOptionData[];
  activeValue?: string | number | null;
  onSelect?: (name: string) => void | Promise<void>;
  isLoading?: boolean;
  groupByDesc?: boolean;
}

export const FullModeColorsModal: React.FC<FullModeColorsModalProps> = ({
  isOpening,
  onClose,
  title,
  options,
  activeValue,
  onSelect,
  isLoading,
  groupByDesc = true,
}) => {
  return (
    <PopupCenterContent isOpening={isOpening} onClose={onClose}>
      <div className={s.modal} role="dialog" aria-modal="true" aria-label={title}>
        <div className={s.header}>
          <div className={s.title}>{title}</div>
          <button className={s.closeBtn} onClick={onClose} type="button">
            <CloseBtnIcon />
          </button>
        </div>

        <div className={s.content}>
          <ProductOptionsGrid
            data={options}
            handleAdd={onSelect}
            activeValue={activeValue}
            isLoading={isLoading}
            groupByDesc={groupByDesc}
          />
        </div>
      </div>
    </PopupCenterContent>
  );
};
