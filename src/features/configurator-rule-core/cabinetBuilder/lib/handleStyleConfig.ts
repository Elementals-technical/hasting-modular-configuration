const HANDLE_GROOVE_COLOR_RESET_VALUE = "None";

export type HandleStyleConfigPatch = {
  Handle: string;
  HandleGrooveColor?: typeof HANDLE_GROOVE_COLOR_RESET_VALUE;
};

const isGrooveHandle = (handle: string): boolean =>
  handle === "handle_urban_topcut" || handle === "handle_urban_botcut";

const hasActiveHandleGrooveColor = (value: string | null | undefined): boolean => {
  const normalized = value?.trim();
  return Boolean(normalized && normalized !== HANDLE_GROOVE_COLOR_RESET_VALUE);
};

export const buildHandleStyleConfigPatch = (
  handle: string,
  handleGrooveColor: string | null | undefined,
): HandleStyleConfigPatch => {
  if (isGrooveHandle(handle) && hasActiveHandleGrooveColor(handleGrooveColor)) {
    return { Handle: handle };
  }

  return {
    Handle: handle,
    HandleGrooveColor: HANDLE_GROOVE_COLOR_RESET_VALUE,
  };
};
