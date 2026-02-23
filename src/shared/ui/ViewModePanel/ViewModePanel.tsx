import { Link } from "react-router-dom";

import { TagIcon } from "@/shared/assets/images/svg/TagIcon";

import s from "./ViewModePanel.module.scss";

export const ViewModePanel = () => {
  return (
    <div className={s.viewTopPanel}>
      <div className={s.leftText}></div>
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
