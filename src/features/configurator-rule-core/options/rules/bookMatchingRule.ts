import { GRAIN_HORIZONTAL, GRAIN_VERTICAL } from "../constants";
import type { BookMatchingRuleInput, BookMatchingRuleResult } from "../types";

export const bookMatchingRule = ({ grainDirection, cabinetCount }: BookMatchingRuleInput): BookMatchingRuleResult => {
  if (!grainDirection) {
    return { enabled: false, reason: "Select grain direction first." };
  }

  if (grainDirection === GRAIN_VERTICAL) {
    return { enabled: true };
  }

  if (grainDirection === GRAIN_HORIZONTAL) {
    if (cabinetCount >= 2) return { enabled: true };
    return { enabled: false, reason: "Horizontal grain requires at least 2 cabinets." };
  }

  return { enabled: false, reason: "Book matching is not available." };
};
