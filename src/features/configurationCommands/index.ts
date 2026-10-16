export type {
  AttributeChange,
  DimensionChange,
  ChangeBlockedReason,
  ChangeErrorCode,
  ChangePreview,
  ChangeResult,
  ConfirmationReason,
  FailedChange,
  PlannedChange,
} from "./model/types";

export { changeAttribute } from "./lib/changeAttribute";
export type { ChangeAttributeDeps } from "./lib/changeAttribute";
export { confirmAttributeChange } from "./lib/confirmAttributeChange";
export { changeDimension } from "./lib/changeDimension";
export type { ChangeDimensionDeps } from "./lib/changeDimension";
export { recordValues, replayValues } from "./lib/replayValues";
export {
  addCabinet,
  adoptComposition,
  applyPreset,
  clearComposition,
  prepareCabinet,
  removeCabinets,
  swapCabinets,
  toPresetSceneProduct,
} from "./lib/composition";
export type {
  AddCabinetRequest,
  AdoptCompositionRequest,
  ApplyPresetRequest,
  ClearCompositionRequest,
  CompositionDeps,
  CompositionErrorCode,
  CompositionResult,
  PlacedCabinet,
  PreparedCabinet,
} from "./lib/composition";
export { clearDividers } from "./lib/clearDividers";
export type { ClearDividersChange, ClearDividersResult } from "./lib/clearDividers";

export { changeSidePanels } from "./lib/changeSidePanels";
export type {
  SidePanelChange,
  SidePanelChangeResult,
  SidePanelStatus as SidePanelSideStatus,
} from "./lib/changeSidePanels";
export type {
  RecordValuesResult,
  ReplayDeps,
  ReplayRequest,
  ReplayResult,
  ReplayValues,
  SkippedReplayValue,
} from "./lib/replayValues";
export { createCommandRunner } from "./lib/createCommandRunner";
export type { CommandRunner, CommandRunnerDeps } from "./lib/createCommandRunner";
export { useChangeAttribute } from "./hooks/useChangeAttribute";
export type { UseChangeAttributeOptions } from "./hooks/useChangeAttribute";
export { useChangeDimension } from "./hooks/useChangeDimension";
export { useAttributeChangeHandler } from "./hooks/useAttributeChangeHandler";
export { useAvailabilityResets } from "./hooks/useAvailabilityResets";
export { useFieldAutoSelect } from "./hooks/useFieldAutoSelect";
export { useDefaultCountertopThickness } from "./hooks/useDefaultCountertopThickness";
export { useRuleDrivenHandleSync } from "./hooks/useRuleDrivenHandleSync";
export { usePerCabinetAttributeFields } from "./hooks/usePerCabinetAttributeFields";
export { selectPerCabinetAttributeFields } from "./lib/perCabinetAttributes";
export { selectOwnCabinetValues } from "./lib/compositionValues";
export type { PerCabinetAttributeField } from "./lib/perCabinetAttributes";
export { resolveChangeRequest } from "./lib/resolveChangeRequest";
export { resolveColorTraits, selectConfiguratorSection } from "./lib/resolveColorTraits";
export type { ColorTraits } from "./lib/resolveColorTraits";

export { validateChange, REASON_VALUE_NOT_IN_CATALOG } from "./lib/validateChange";
export type { ValidationVerdict } from "./lib/validateChange";

export {
  buildChangePlan,
  REASON_DEPENDENT_HEIGHT,
  REASON_GROOVE_FOLLOWS_CABINET_COLOR,
  REASON_GROOVE_NOT_SUPPORTED,
} from "./lib/buildChangePlan";
export type { BuildChangePlanArgs, BuildChangePlanResult } from "./lib/buildChangePlan";

export { resolveTarget } from "./lib/resolveTarget";
export { commitChange, commitPlan, TYPED_COMMIT_ATTRIBUTE_IDS } from "./lib/commitChange";
export type { CommitContext } from "./lib/commitChange";
