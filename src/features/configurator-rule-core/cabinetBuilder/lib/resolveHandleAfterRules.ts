import type { OptionState } from "../model/types";

export type ResolveHandleAfterRulesArgs = {
  currentHandle: string | null;
  handles: OptionState<string>[];
  heightLocked: number | null;
};

/**
 * Resolves which handle should be selected after the rules ran.
 *
 * This used to exist twice — once in the product reducer and once in CabinetBuilderPage —
 * with the same `handle_pto` preference and the same `heightLocked === 50` special case
 * written out separately. Both call this now, so the two paths cannot drift.
 *
 * The preference is expressed generically: the handle rule already disables every option
 * whose forced height conflicts with the lock, so the first still-enabled option in
 * catalog order is the one that fits the locked height. For the USH data that is the
 * push-to-open option, which is why the old code named it explicitly.
 */
export const resolveHandleAfterRules = ({
  currentHandle,
  handles,
  heightLocked,
}: ResolveHandleAfterRulesArgs): string | null => {
  const preferredForLock = typeof heightLocked === "number" ? handles.find((option) => option.enabled) : undefined;

  if (currentHandle && handles.length > 0) {
    const currentOption = handles.find((option) => option.value === currentHandle);

    if (currentOption && !currentOption.enabled && !currentOption.deferAutoChange) {
      const replacement = preferredForLock ?? handles.find((option) => option.enabled);
      return replacement ? String(replacement.value) : null;
    }
  }

  if (!currentHandle && preferredForLock) {
    return String(preferredForLock.value);
  }

  // A locked height leaves exactly one compatible handle; if the current one is no longer
  // selectable, fall back to it rather than keeping a value the scene cannot honour.
  if (preferredForLock && currentHandle && currentHandle !== preferredForLock.value) {
    const stillSelectable = handles.find((option) => option.value === currentHandle && option.enabled);
    if (!stillSelectable) return String(preferredForLock.value);
  }

  return currentHandle;
};
