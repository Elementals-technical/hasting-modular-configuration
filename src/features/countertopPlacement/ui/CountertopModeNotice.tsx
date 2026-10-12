import { useEffect, type CSSProperties } from "react";

import { useReasonText } from "@/shared/lib/reasonText";

import type { CountertopModeNoticeState } from "../lib/useCountertopMovementMode";
import s from "./CountertopDragMode.module.scss";

export const COUNTERTOP_MODE_NOTICE_MS = 6000;

type Props = { notice: CountertopModeNoticeState | null; onDismiss(): void; style?: CSSProperties };

/** Short notice of a countertop movement-mode switch (and of its auto-correction); closes itself. */
export const CountertopModeNotice = ({ notice, onDismiss, style }: Props) => {
  const reasonText = useReasonText();

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(onDismiss, COUNTERTOP_MODE_NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [notice, onDismiss]);

  if (!notice) return null;
  const text = notice.codes
    .map((code) => reasonText({ code }))
    .filter(Boolean)
    .join(" ");
  const failure = notice.failure && (reasonText(notice.failure) ?? notice.failure.text);

  return (
    <div role="status" aria-label="Countertop movement" className={s.modeNotice} style={style}>
      <div>
        {text && <p className={s.modeNoticeText}>{text}</p>}
        {failure && (
          <p className={s.message} role="alert">
            {failure}
          </p>
        )}
      </div>
      <button type="button" className={s.modeNoticeClose} aria-label="Close" onClick={onDismiss}>
        ×
      </button>
    </div>
  );
};
