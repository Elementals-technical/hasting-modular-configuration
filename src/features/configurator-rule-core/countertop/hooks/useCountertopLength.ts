import { calcTotalCountertopWidthCm, getActiveSidePanelCount } from "@/entities/countertop";
import { getSidePanelLeftStatus, getSidePanelRightStatus } from "@/features/sidePanel";
import { getActiveProductProfile } from "@/entities/configuration/model/store/selectors";
import { getSidePanelWidthCm } from "@/entities/countertop";
import { useAppSelector } from "@/shared/hooks/store/redux";
import { useCountertopRuntimeValue } from "@/shared/hooks/useCountertopRuntimeState";
import { useSceneTotalWidth } from "@/shared/hooks/useSceneTotalWidth";

/** The length (cm) the countertop's rules judge: with its side panels, and of its cabinets alone. */
export type CountertopLength = {
  withSidePanels: number | null;
  cabinetsOnly: number | null;
};

/** Below one whole cm; the scene's 0.05 cm joints never add up to it before 20 cabinets. */
const FLOAT_EPSILON_CM = 1e-6;

/**
 * The length of the countertop over the composition, in cm. The scene's auto length is the run of
 * cabinets the countertop covers, with the side panels it takes: cabinets on a lower level, under
 * cabinet covers, and a custom or dragged length do not count. The scene adds 0.05 cm per joint
 * between two cabinets, so the whole cm below is the cabinets' own length (widths are whole cm).
 * Without a countertop in the scene: the composition's width, as before.
 */
export const useCountertopLength = (productIds: string[], fallbackWidth: number | null = null): CountertopLength => {
  const autoLengthM = useCountertopRuntimeValue((state) =>
    state?.productId &&
    typeof state.autoLength === "number" &&
    Number.isFinite(state.autoLength) &&
    state.autoLength > 0
      ? state.autoLength
      : null,
  );
  const profile = useAppSelector(getActiveProductProfile);
  const left = useAppSelector(getSidePanelLeftStatus);
  const right = useAppSelector(getSidePanelRightStatus);
  // One scene poll for both values, as `useSceneTotalWidthWithSidePanels` adds the panels.
  const compositionOnly = useSceneTotalWidth(productIds, fallbackWidth);

  if (autoLengthM === null) {
    return {
      withSidePanels:
        compositionOnly === null
          ? null
          : calcTotalCountertopWidthCm(compositionOnly, left, right, getSidePanelWidthCm(profile)),
      cabinetsOnly: compositionOnly,
    };
  }

  const withSidePanels = Math.floor(autoLengthM * 100 + FLOAT_EPSILON_CM);
  return {
    withSidePanels,
    cabinetsOnly: withSidePanels - getActiveSidePanelCount(left, right) * getSidePanelWidthCm(profile),
  };
};
