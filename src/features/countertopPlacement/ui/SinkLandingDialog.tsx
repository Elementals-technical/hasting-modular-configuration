import { AttentionPopup } from "@/shared/ui/Popups/ui/AttentionPopup/AttentionPopup";

import type { SinkLandingPrompt } from "../lib/useSinkLanding";

type Props = {
  prompt: SinkLandingPrompt | null;
  message: string | null;
  onConfirm: () => void;
  onDecline: () => void;
  onDismissMessage: () => void;
};

/**
 * Asks before the sink moves to the cabinet under the dropped top. AttentionPopup closes itself
 * (setIsOpening(false)) before it calls onConfirm, so the close is deferred: Confirm decides first
 * and the hook keeps the first decision; ×, the overlay and "Keep where it was" decline.
 */
export const SinkLandingDialog = ({ prompt, message, onConfirm, onDecline, onDismissMessage }: Props) => (
  <>
    <AttentionPopup
      isOpening={prompt !== null}
      setIsOpening={(isOpening) => {
        if (!isOpening) queueMicrotask(onDecline);
      }}
      onConfirm={onConfirm}
      title="Move the sink to this cabinet?"
      cancelLabel="Keep where it was"
      confirmLabel="Confirm"
      content={<p>The sink base and the side cabinet swap places; the price is updated.</p>}
    />
    <AttentionPopup
      isOpening={prompt === null && message !== null}
      setIsOpening={(isOpening) => {
        if (!isOpening) onDismissMessage();
      }}
      title="Sink"
      cancelLabel="Close"
      confirmLabel="OK"
      content={<p>{message}</p>}
    />
  </>
);
