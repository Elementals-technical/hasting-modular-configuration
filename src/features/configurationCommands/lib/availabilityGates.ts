import type { RootState } from "@/app/store";
import type { ProductProfile } from "@/entities/collection";
import { selectAttribute, selectMessage } from "@/entities/collection";
import type { AttributeValue } from "@/entities/configuration";
import { selectFlutingState, selectGrainDirectionState } from "@/entities/product/model/store/derivedSelectors";

import type { ChangeBlockedReason } from "../model/types";

/**
 * Gate 4 for attributes the rule engine's selection does not cover.
 *
 * Availability comes from the existing rules through their selectors, so the command
 * refuses exactly what the pages already show as unavailable.
 */

export const REASON_FLUTING_NOT_AVAILABLE = "fluting.notAvailable";
export const REASON_GRAIN_NOT_AVAILABLE = "grain.notAvailable";

type Availability = { available: boolean; reason?: string };

type AvailabilityGate = {
  reasonCode: string;
  select: (state: RootState) => Availability;
};

const AVAILABILITY_GATES: Record<string, AvailabilityGate> = {
  DrawerPanelFluting: { reasonCode: REASON_FLUTING_NOT_AVAILABLE, select: selectFlutingState },
  GrainDirection: { reasonCode: REASON_GRAIN_NOT_AVAILABLE, select: selectGrainDirectionState },
};

/** Clearing a value is always allowed: an unavailable option must still be removable. */
const isClearingValue = (profile: ProductProfile, attributeId: string, value: AttributeValue): boolean =>
  value === "" || value === selectAttribute(profile, attributeId)?.noneValue;

export const checkAvailability = (
  attributeId: string,
  value: AttributeValue,
  state: RootState,
  profile: ProductProfile,
): ChangeBlockedReason | null => {
  const gate = AVAILABILITY_GATES[attributeId];
  if (!gate || isClearingValue(profile, attributeId, value)) return null;

  const availability = gate.select(state);
  if (availability.available) return null;

  return {
    attributeId,
    reasonCode: gate.reasonCode,
    reason: availability.reason ?? selectMessage(profile, gate.reasonCode),
  };
};
