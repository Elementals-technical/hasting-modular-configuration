import { Link } from "react-router-dom";

import { ExpandIcon } from "@/shared/assets/images/svg/ExpandIcon";
import { TagIcon } from "@/shared/assets/images/svg/TagIcon";

import s from "./ViewModePanel.module.scss";

export const ViewModePanel = () => {
  return (
    <div className={s.viewTopPanel}>
      <div className={s.leftText}>
        <Link onClick={(e) => e.stopPropagation()} to={"#"}>
          <span>View in full mode</span>
          <span className={s.leftIcon}>
            <ExpandIcon />
          </span>
        </Link>
      </div>
      <div className={s.rightText}>
        <Link to={"#"} onClick={(e) => e.stopPropagation()}>
          <span>Order free Swatches</span>
          <span className={s.leftIcon}>
            <TagIcon />
          </span>
        </Link>
      </div>
    </div>
  );
};
