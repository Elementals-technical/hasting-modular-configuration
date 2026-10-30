import { useReasonText, type MessageParams } from "@/shared/lib/reasonText";

import s from "./CabinetColorSections.module.scss";

/** Shown next to a control the collection cannot offer and names no reason for. */
export const VALUE_UNAVAILABLE_REASON_CODE = "ui.valueUnavailable";

type UnavailableMessageProps = {
  reason?: string;
  reasonCode?: string;
  /** Values the code's text names; the resolver fills them in. */
  reasonParams?: MessageParams;
};

/** Why a field cannot be used, in the collection's own words when it has any. */
export const UnavailableMessage = ({ reason, reasonCode, reasonParams }: UnavailableMessageProps) => {
  const reasonText = useReasonText();

  return (
    <div className={s.disabledMessage}>
      {reasonText({ code: reasonCode ?? VALUE_UNAVAILABLE_REASON_CODE, params: reasonParams, text: reason })}
    </div>
  );
};
