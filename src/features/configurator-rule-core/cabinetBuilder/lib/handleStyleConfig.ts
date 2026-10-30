import { hasCapability, selectResetValue, type ProductProfile } from "@/entities/collection";

/**
 * Scene value that means "no groove color". Distinct from the empty Redux value:
 * an empty string in state and `None` in PlayCanvas do not substitute for each other.
 */
const FALLBACK_GROOVE_RESET_VALUE = "None";

export type HandleStyleConfigPatch = {
  Handle: string;
  HandleGrooveColor?: string;
};

const hasActiveHandleGrooveColor = (value: string | null | undefined, resetValue: string): boolean => {
  const normalized = value?.trim();
  return Boolean(normalized && normalized !== resetValue);
};

/**
 * Builds the scene patch for a handle change.
 *
 * Whether the groove color applies is read from the option capability
 * `supportsGrooveColor`, so a new groove-capable handle needs no id in this file.
 */
export const buildHandleStyleConfigPatch = (
  handle: string,
  handleGrooveColor: string | null | undefined,
  profile: ProductProfile | null,
): HandleStyleConfigPatch => {
  const resetValue = selectResetValue(profile, "HandleGrooveColor") ?? FALLBACK_GROOVE_RESET_VALUE;

  if (hasCapability(profile, "Handle", handle, "supportsGrooveColor") && hasActiveHandleGrooveColor(handleGrooveColor, resetValue)) {
    return { Handle: handle };
  }

  return {
    Handle: handle,
    HandleGrooveColor: resetValue,
  };
};
