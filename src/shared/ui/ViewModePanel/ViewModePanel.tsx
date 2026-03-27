import { TagIcon } from "@/shared/assets/images/svg/TagIcon";

import s from "./ViewModePanel.module.scss";

interface ViewModePanelProps {
  onOrderSwatches?: () => void;
}

export const ViewModePanel = ({ onOrderSwatches }: ViewModePanelProps) => {
  return (
    <div className={s.viewTopPanel}>
      <div className={s.leftText}></div>
      <div className={s.rightText}>
        <button type="button" onClick={onOrderSwatches}>
          <span>Order free Swatches</span>
          <span className={s.leftIcon}>
            <TagIcon />
          </span>
        </button>
      </div>
    </div>
  );
};
