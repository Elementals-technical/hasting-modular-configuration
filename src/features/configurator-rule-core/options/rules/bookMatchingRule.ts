import type { BookMatchingRuleInput, BookMatchingRuleResult } from "../types";
import { deriveBookMatchingAvailability } from "@/shared/lib/bookMatching";

export const bookMatchingRule = ({ grainDirection, cabinets }: BookMatchingRuleInput): BookMatchingRuleResult => {
  const availability = deriveBookMatchingAvailability({
    grainDirection,
    cabinets,
  });

  return {
    enabled: availability.available,
    reason: availability.reason,
  };
};
