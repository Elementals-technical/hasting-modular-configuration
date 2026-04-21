import { setVisibleDrawerButtons } from "../setVisibleDrawerButtons";
import { setVisibleDividerSlotButtons } from "./setVisibleDividerSlotButtons";
import { wrapExitTopView } from "./wrapExitTopView";

export function closeDrawerInteraction() {
  const exitTopView = wrapExitTopView({});
  if (exitTopView) exitTopView();

  setVisibleDrawerButtons(false);
  setVisibleDividerSlotButtons(false);
}
