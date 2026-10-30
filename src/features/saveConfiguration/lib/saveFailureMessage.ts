import type { SaveCurrentConfigurationResult } from "../hooks/useSaveCurrentConfiguration";
import { RESTORE_INCOMPLETE_SAVE_MESSAGE } from "./restoreSaveGuard";

type SaveFailureReason = Extract<SaveCurrentConfigurationResult, { ok: false }>["reason"];

const SAVE_FAILURE_MESSAGES: Record<SaveFailureReason, string> = {
  "no-products": "No products to save",
  "no-collection": "The collection is still loading. Try saving again in a moment.",
  "missing-id": "The configuration could not be saved. Please try again.",
  "restore-incomplete": RESTORE_INCOMPLETE_SAVE_MESSAGE,
};

/** What every save entry point tells the user when Save did not produce a link. */
export const getSaveFailureMessage = (reason: SaveFailureReason): string => SAVE_FAILURE_MESSAGES[reason];
