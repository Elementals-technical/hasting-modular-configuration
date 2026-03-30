import { useState } from "react";
import { Link } from "react-router-dom";

import { TagIcon } from "@/shared/assets/images/svg/TagIcon";
import { ExpandIcon } from "@/shared/assets/images/svg/ExpandIcon";
import { FullModeColorsModal } from "@/shared/ui/Popups/FullModeColorsModal/FullModeColorsModal";
import type { ProductOptionData } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";

import s from "./ViewModePanel.module.scss";

interface ViewModePanelProps {
  onOrderSwatches?: () => void;
  fullModeTitle?: string;
  fullModeOptions?: ProductOptionData[];
  fullModeActiveValue?: string | number | null;
  onFullModeSelect?: (name: string) => void | Promise<void>;
  fullModeGroupByDesc?: boolean;
  fullModeLoading?: boolean;
}

export const ViewModePanel = ({
  onOrderSwatches,
  fullModeTitle = "Colors",
  fullModeOptions = [],
  fullModeActiveValue,
  onFullModeSelect,
  fullModeGroupByDesc = true,
  fullModeLoading = false,
}: ViewModePanelProps) => {
  const [isFullModeOpen, setIsFullModeOpen] = useState(false);

  return (
    <>
      <div className={s.viewTopPanel}>
        <div className={s.leftText}>
          <div className={s.leftText}>
            <Link
              to="#"
              onClick={(event) => {
                event.preventDefault();
                if (!fullModeOptions.length) return;
                setIsFullModeOpen(true);
              }}
            >
              <span>View in full mode</span>
              <span className={s.leftIcon}>
                <ExpandIcon />
              </span>
            </Link>
          </div>
        </div>
        <div className={s.rightText}>
          <button type="button" onClick={onOrderSwatches}>
            <span>Order free Swatches</span>
            <span className={s.leftIcon}>
              <TagIcon />
            </span>
          </button>
        </div>
      </div>
      <FullModeColorsModal
        isOpening={isFullModeOpen}
        onClose={() => setIsFullModeOpen(false)}
        title={fullModeTitle}
        options={fullModeOptions}
        activeValue={fullModeActiveValue}
        onSelect={onFullModeSelect}
        isLoading={fullModeLoading}
        groupByDesc={fullModeGroupByDesc}
      />
    </>
  );
};
