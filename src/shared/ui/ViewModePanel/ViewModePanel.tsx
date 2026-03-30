import { Link } from "react-router-dom";

import { TagIcon } from "@/shared/assets/images/svg/TagIcon";

import { ExpandIcon } from "@/shared/assets/images/svg/ExpandIcon";

import s from "./ViewModePanel.module.scss";

interface ViewModePanelProps {
  onOrderSwatches?: () => void;
}

export const ViewModePanel = ({ onOrderSwatches }: ViewModePanelProps) => {
  return (
    <div className={s.viewTopPanel}>
      <div className={s.leftText}>
        <div className={s.leftText}>
          <Link to={"#"}>
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
  );
};
