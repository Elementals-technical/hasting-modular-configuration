import { useReasonText, type Reason } from "@/shared/lib/reasonText";
import { AttentionPopup } from "@/shared/ui/Popups/ui/AttentionPopup/AttentionPopup";

type Props = {
  message: Reason | null;
  onDismiss: () => void;
};

/** Reports a sink move that failed (the move itself runs without asking, see `useSinkLanding`). */
export const SinkLandingMessage = ({ message, onDismiss }: Props) => {
  const reasonText = useReasonText();

  return (
    <AttentionPopup
      isOpening={message !== null}
      setIsOpening={(isOpening) => {
        if (!isOpening) onDismiss();
      }}
      title="Sink"
      cancelLabel="Close"
      confirmLabel="OK"
      content={<p>{message ? reasonText(message) : null}</p>}
    />
  );
};
