import type { ProductProfile } from "@/entities/collection";
import { deriveBookMatchingAvailability } from "@/shared/lib/bookMatching";

import type { BookMatchingRuleInput, BookMatchingRuleResult } from "../types";

export const bookMatchingRule = (
  { grainDirection, cabinets }: BookMatchingRuleInput,
  profile: ProductProfile | null,
): BookMatchingRuleResult => {
  const availability = deriveBookMatchingAvailability({
    grainDirection,
    cabinets,
    profile,
  });

  return {
    enabled: availability.available,
    reason: availability.reason,
    reasonCode: availability.reasonCode,
  };
};
