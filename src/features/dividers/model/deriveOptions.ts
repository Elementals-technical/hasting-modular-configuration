import { selectMessageOr, type ProductProfile } from "@/entities/collection";

import { normalizeDividerType } from "./normalize";
import type { DividerAvailability, DividerType } from "./types";
import { unavailableDividerReason } from "./validate";

/** A style option as the step lists it: `name` is the style value the profile declares. */
export type DividerOptionBase = { name: string };

export type DerivedDividerOption<T extends DividerOptionBase> = T & {
  isAvailable?: boolean;
  disabledReason?: string;
  /** Stable code of `disabledReason`; the interface resolves it to text. */
  disabledReasonCode?: string;
};

export type DividerAvailabilityInput =
  | DividerAvailability
  | ReadonlySet<DividerType>
  | readonly DividerType[]
  | null
  | undefined;

export const REASON_DIVIDER_OPTION_DOES_NOT_FIT = "divider.optionDoesNotFit";
const NON_DIVIDER_OPTION_DISABLED_REASON = "This divider option does not fit in the selected drawer space.";

const resolveAvailableTypes = (availability: DividerAvailabilityInput): readonly DividerType[] | null => {
  if (!availability) return null;
  if (Array.isArray(availability)) return availability as readonly DividerType[];
  if (availability instanceof Set) return Array.from(availability) as DividerType[];

  return (availability as DividerAvailability).types;
};

/**
 * Maps the step's style options and the current availability into grid-ready options with
 * `isAvailable` / `disabledReason`. The style of an option is its declared value, so a
 * collection may label it however it likes.
 */
export function deriveDividerOptions<T extends DividerOptionBase>(
  options: readonly T[],
  availability: DividerAvailabilityInput,
  profile: ProductProfile | null = null,
): DerivedDividerOption<T>[] {
  const types = resolveAvailableTypes(availability);
  if (!types) return [...options];

  const availableTypes = [...types];

  return options.map((option) => {
    const dividerType = normalizeDividerType(option.name);
    const isAvailable = dividerType ? types.includes(dividerType) : true;
    const reason = dividerType
      ? unavailableDividerReason(dividerType, availableTypes, profile)
      : {
          reasonCode: REASON_DIVIDER_OPTION_DOES_NOT_FIT,
          message: selectMessageOr(profile, REASON_DIVIDER_OPTION_DOES_NOT_FIT, NON_DIVIDER_OPTION_DISABLED_REASON),
        };

    return {
      ...option,
      isAvailable,
      disabledReason: isAvailable ? undefined : reason.message,
      disabledReasonCode: isAvailable ? undefined : reason.reasonCode,
    };
  });
}
