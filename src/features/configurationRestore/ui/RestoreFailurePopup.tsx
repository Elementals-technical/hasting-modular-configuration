import { useState } from "react";

import type { RestoreFailureReason } from "@/entities/configuration";
import { getRestoreState } from "@/entities/configuration/model/store/selectors";
import { useAppSelector } from "@/shared/hooks/store/redux";
import { AttentionPopup } from "@/shared/ui/Popups/ui/AttentionPopup/AttentionPopup";

const RESTORE_FAILURE_MESSAGES: Record<RestoreFailureReason, string> = {
  "not-found": "The saved link was not found.",
  collection: "This configuration belongs to a collection that could not be opened.",
  invalid: "The saved configuration is damaged and could not be opened.",
  scene: "The 3D scene could not be rebuilt from this configuration.",
  partial: "Only part of the configuration was restored. Check it before saving.",
};

/** Tells the user once when a saved configuration did not open whole (C09). */
export const RestoreFailurePopup = () => {
  const { configId, status, reason } = useAppSelector(getRestoreState);
  const [dismissedConfigId, setDismissedConfigId] = useState<string | null>(null);

  // A new restore of the same link may fail again and must be reported again.
  if (status === "restoring" && dismissedConfigId !== null) {
    setDismissedConfigId(null);
  }

  const isFailure = status === "failed" || status === "partial";
  const isOpening = isFailure && configId !== null && configId !== dismissedConfigId;
  const message = RESTORE_FAILURE_MESSAGES[reason ?? (status === "partial" ? "partial" : "invalid")];

  return (
    <AttentionPopup
      isOpening={isOpening}
      setIsOpening={(isOpen) => {
        if (!isOpen) setDismissedConfigId(configId);
      }}
      title="We couldn't open this configuration"
      content={<p>{message}</p>}
      cancelLabel="Close"
      confirmLabel="OK"
    />
  );
};
