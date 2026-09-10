export type {
  AttributeScope,
  CabinetMatrixLegacyAdapter,
  OptionCapabilities,
  ProductProfile,
  ProfileAttribute,
  ProfileMessages,
  ProfileOption,
  ProfileRuleData,
  ProfileSourceRefs,
} from "./model/productProfile";
export { ATTRIBUTE_SCOPES } from "./model/productProfile";

export type {
  CabinetHandleRelations,
  HandleHeightConstraint,
  NormalizedHandleProfile,
} from "./model/handleProfile";

export { getPackagedProductProfile, loadPackagedProductProfile } from "./lib/bootstrapProductProfile";
export type { BootstrapProductProfileResult } from "./lib/bootstrapProductProfile";

export { parseProductProfile } from "./lib/parseProductProfile";
export type {
  ParseProductProfileResult,
  ProfileDiagnostic,
  ProfileDiagnosticCode,
} from "./lib/parseProductProfile";

export {
  hasCapability,
  isKnownOption,
  normalizeOptionValue,
  selectAttribute,
  selectEffectiveFallback,
  selectInitialValue,
  selectMessage,
  selectOption,
  selectOptionValues,
  selectOptions,
  selectOptionsByCapability,
  selectResetValue,
} from "./lib/productProfileSelectors";

export {
  isHandleAllowedForDrawers,
  normalizeHandleProfile,
  parseHeightMapping,
  resolveForcedHeight,
  resolvePossibleForcedHeights,
} from "./lib/normalizeHandleProfile";
export type { NormalizedMatrixRow, NormalizeHandleProfileArgs } from "./lib/normalizeHandleProfile";
