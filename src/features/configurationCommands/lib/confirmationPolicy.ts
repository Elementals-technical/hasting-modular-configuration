import type { ProductProfile } from "@/entities/collection";
import { selectAttribute, selectMessage } from "@/entities/collection";

import type { AttributeChange, ConfirmationReason, PlannedChange } from "../model/types";

/**
 * Whether a planned set waits for the user's confirmation, and why.
 *
 * Declared per attribute in the profile, so asking is data rather than a branch per
 * attribute: USH asks before a handle change reaches placed cabinets, as the style
 * sidebar did. When confirmation is asked, the dependent changes are listed with their
 * reasons too, so the user sees everything the set will change.
 *
 * An empty result means the set is applied without asking.
 */
export const resolveConfirmation = (
  change: AttributeChange,
  plan: readonly PlannedChange[],
  profile: ProductProfile,
  placedCabinetCount: number,
): ConfirmationReason[] => {
  const confirmation = selectAttribute(profile, change.attributeId)?.confirmation;

  if (!confirmation) return [];

  if (confirmation.when === "cabinetsPlaced" && placedCabinetCount === 0) return [];

  const dependencies = plan.flatMap(({ attributeId, origin, reasonCode }) =>
    origin === "dependency" && reasonCode
      ? [{ attributeId, reasonCode, reason: selectMessage(profile, reasonCode) }]
      : [],
  );

  return [
    {
      attributeId: change.attributeId,
      reasonCode: confirmation.reasonCode,
      reason: selectMessage(profile, confirmation.reasonCode),
    },
    ...dependencies,
  ];
};
