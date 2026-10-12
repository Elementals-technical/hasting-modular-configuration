import { AttentionPopup } from "@/shared/ui/Popups/ui/AttentionPopup/AttentionPopup";

type Props = {
  message: string | null;
  onDismiss: () => void;
};

/** Reports a sink move that failed (the move itself runs without asking, see `useSinkLanding`). */
export const SinkLandingMessage = ({ message, onDismiss }: Props) => (
  <AttentionPopup
    isOpening={message !== null}
    setIsOpening={(isOpening) => {
      if (!isOpening) onDismiss();
    }}
    title="Sink"
    cancelLabel="Close"
    confirmLabel="OK"
    content={<p>{message}</p>}
  />
);
