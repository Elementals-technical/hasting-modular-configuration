import { AttentionPopup } from "@/shared/ui/Popups/ui/AttentionPopup/AttentionPopup";
import {
  formatSidePanelGrooveLabel,
  formatSidePanelSideLabel,
  type SidePanelSyncPrompt,
} from "../lib/sidePanelSelectionState";

export const SidePanelSyncConfirmModal = ({
  pendingChange,
  onCancel,
  onConfirm,
}: {
  pendingChange: SidePanelSyncPrompt | null;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) => (
  <AttentionPopup
    isOpening={pendingChange !== null}
    setIsOpening={(isOpening) => {
      if (!isOpening) onCancel();
    }}
    onConfirm={onConfirm}
    title="Update both side panels?"
    cancelLabel="Cancel"
    confirmLabel="Update both sides"
    content={
      pendingChange ? (
        <>
          <p>The {formatSidePanelSideLabel(pendingChange.otherSide)} side panel is also active.</p>
          <p>
            Changing to {formatSidePanelGrooveLabel(pendingChange.requestedGroove)} will update that side panel as
            well.
          </p>
        </>
      ) : null
    }
  />
);
