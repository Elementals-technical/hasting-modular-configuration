import type { RestoreStatus } from "@/entities/configuration";

export const RESTORE_INCOMPLETE_SAVE_MESSAGE =
  "This configuration was not fully restored. Change it or reload the page before saving.";

/** A configuration still being restored, or restored incompletely, must not be saved as if it were whole. */
export const isRestoreBlockingSave = (status: RestoreStatus): boolean =>
  status === "restoring" || status === "partial" || status === "failed";
