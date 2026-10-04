// Restore of a saved configuration — owned by C (C09).
export { buildRestorePlan, isTopConfig } from "./lib/buildRestorePlan";
export type { BuildRestorePlanResult, RestoreIssue, RestorePlan, RestoreTopConfig } from "./lib/buildRestorePlan";

export { applyRestoredIdentity, matchSavedStableKeys, toRestoredValues } from "./lib/applyRestoredIdentity";

export { restoreSavedConfiguration } from "./lib/restoreSavedConfiguration";
export type { RestoreSavedConfigurationDeps, RestoreSavedConfigurationResult } from "./lib/restoreSavedConfiguration";

export { useRestoreSavedConfiguration } from "./hooks/useRestoreSavedConfiguration";
export { RestoreFailurePopup } from "./ui/RestoreFailurePopup";
export type { UseRestoreSavedConfigurationOptions } from "./hooks/useRestoreSavedConfiguration";
