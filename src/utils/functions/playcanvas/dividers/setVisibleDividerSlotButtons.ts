import { getDividerConfiguratorWindow } from "./dividerUiDebug";

export function setVisibleDividerSlotButtons(visible: boolean) {
  const canvasIframe = getDividerConfiguratorWindow();
  const api = canvasIframe?.ConfiguratorAPI as
    | {
        setVisibleDividerSlotButtons?: (visible: boolean) => unknown;
      }
    | undefined;
  const apiMethod = api?.setVisibleDividerSlotButtons;

  if (!apiMethod) {
    return null;
  }

  try {
    return apiMethod(visible);
  } catch {
    return null;
  }
}
