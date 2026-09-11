export type {
  AttributeChange,
  ChangeBlockedReason,
  ChangeErrorCode,
  ChangeResult,
  FailedChange,
  PlannedChange,
} from "./model/types";

export { changeAttribute } from "./lib/changeAttribute";
export type { ChangeAttributeDeps } from "./lib/changeAttribute";

export { validateChange, REASON_VALUE_NOT_IN_CATALOG } from "./lib/validateChange";
export type { ValidationVerdict } from "./lib/validateChange";

export { buildChangePlan, REASON_DEPENDENT_HEIGHT, REASON_GROOVE_NOT_SUPPORTED } from "./lib/buildChangePlan";
export type { BuildChangePlanArgs, BuildChangePlanResult } from "./lib/buildChangePlan";

export { resolveTarget } from "./lib/resolveTarget";
export { commitChange, TYPED_COMMIT_ATTRIBUTE_IDS } from "./lib/commitChange";
export type { CommitContext } from "./lib/commitChange";
