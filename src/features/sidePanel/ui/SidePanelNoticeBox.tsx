import type { SidePanelNotice } from "../lib/sidePanelReasons";
import s from "./SidePanelNoticeBox.module.scss";

export const SidePanelNoticeBox = ({ notice }: { notice: SidePanelNotice }) => (
  <div className={`${s.notice} ${s[notice.tone]}`}>
    <div className={s.header}>
      <span className={s.label}>Applies to</span>
      <span className={s.target}>{notice.targetLabel}</span>
    </div>
    <p className={s.message}>{notice.message}</p>
  </div>
);
