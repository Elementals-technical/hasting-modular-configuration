import { selectMessageOr, type ProductProfile } from "@/entities/collection";

import { getDividerTypeFromOptionTitle } from "./normalize";
import type { DividerAvailability, DividerType } from "./types";
import { unavailableDividerReason } from "./validate";

export type DividerOptionBase = { title: string };

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
 * Maps UI option mock data + current availability into grid-ready options with
 * `isAvailable` / `disabledReason`. Moved verbatim from the pages' `dividerOptions`
 * useMemo (custom accessories page) — behavior must not change.
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
    const dividerType = getDividerTypeFromOptionTitle(option.title);
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
