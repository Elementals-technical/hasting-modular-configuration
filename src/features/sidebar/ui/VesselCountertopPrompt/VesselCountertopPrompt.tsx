import { selectOption } from "@/entities/collection";
import { getActiveProductProfile } from "@/entities/configuration";
import { useAppSelector } from "@/shared/hooks/store/redux";
import { cmToInchLabel } from "@/shared/lib/cmToInchLabel";
import { AttentionPopup } from "@/shared/ui/Popups/ui/AttentionPopup/AttentionPopup";

import type { VesselCountertopRequest } from "../../lib/useVesselCountertop";

type VesselCountertopPromptProps = {
  request: VesselCountertopRequest | null;
  onApprove: () => void;
  onCancel: () => void;
};

/**
 * Asks to switch to the vessel countertop a cabinet needs (`useVesselCountertop`), naming the width the
 * integrated one leaves out: another width needs no switch.
 */
export const VesselCountertopPrompt = ({ request, onApprove, onCancel }: VesselCountertopPromptProps) => {
  const profile = useAppSelector(getActiveProductProfile);

  return (
    <AttentionPopup
      isOpening={request !== null}
      setIsOpening={onCancel}
      title="Switch to Vessel Countertop?"
      content={
        // Empty, not the popup's own text, while it closes.
        <>
          {request && (
            <>
              <p>
                A {request.widthCm} cm ({cmToInchLabel(request.widthCm)}){" "}
                {selectOption(profile, "CabinetType", request.cabinetType)?.label ?? request.cabinetType} with{" "}
                {selectOption(profile, "Drawers", request.drawers)?.label ?? request.drawers} is not available with an
                Integrated countertop.
              </p>
              <p>
                Change the width, or approve to switch the countertop to Vessel with a hole cutout and update the
                cabinets in your design.
              </p>
            </>
          )}
        </>
      }
      confirmLabel="Approve"
      onConfirm={onApprove}
    />
  );
};
