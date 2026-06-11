import { getDividerTypeFromOptionTitle } from "./normalize";
import type { DividerAvailability, DividerType } from "./types";
import { buildUnavailableDividerWarning } from "./validate";

export type DividerOptionBase = { title: string };

export type DerivedDividerOption<T extends DividerOptionBase> = T & {
  isAvailable?: boolean;
  disabledReason?: string;
};

export type DividerAvailabilityInput =
  | DividerAvailability
  | ReadonlySet<DividerType>
  | readonly DividerType[]
  | null
  | undefined;

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
): DerivedDividerOption<T>[] {
  const types = resolveAvailableTypes(availability);
  if (!types) return [...options];

  const availableTypes = [...types];

  return options.map((option) => {
    const dividerType = getDividerTypeFromOptionTitle(option.title);
    const isAvailable = dividerType ? types.includes(dividerType) : true;
    const disabledReason = dividerType
      ? buildUnavailableDividerWarning(dividerType, availableTypes)
      : NON_DIVIDER_OPTION_DISABLED_REASON;

    return {
      ...option,
      isAvailable,
      disabledReason: isAvailable ? undefined : disabledReason,
    };
  });
}
