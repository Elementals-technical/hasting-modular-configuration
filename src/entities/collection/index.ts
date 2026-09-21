// Collection data access — owned by A.
export * from "./lib/collectionUrl";
export * from "./lib/customization/deriveCollectionNavigation";
export * from "./lib/customization/validateCustomizationSchema";
export * from "./lib/loadCollection";
export * from "./lib/paths";
export * from "./lib/resolveCollection";
export * from "./lib/resolveRestoredCollection";
export * from "./lib/rtkRemoteLoader";
export * from "./lib/validation";
export * from "./model/constants";
export * from "./model/diagnostics";
export * from "./model/errors";
export * from "./model/schemas";
export * from "./model/types";
export * from "./ui/ActiveCollectionProvider";
export * from "./ui/CollectionReadinessGate";
export * from "./ui/activeCollectionContext";

// ProductProfile — owned by C: the semantic shape of the product data and the pure
// transformations over it. A binds the sources and calls them while loading.
//
// Listed explicitly rather than re-exported wholesale: this barrel is edited by two
// people, and an explicit list turns a name collision into a compile error here instead
// of a silently missing export at the call site.
export type {
  AttributeConfirmation,
  AttributeScope,
  BookMatchingRuleData,
  CabinetColorTraitsRuleData,
  CabinetMatrixLegacyAdapter,
  CountertopFallbacksRuleData,
  DrawerStyleGroups,
  FlutingRuleData,
  GrainDirectionRuleData,
  MaterialDisplayGroup,
  MaterialNormalizationRuleData,
  OptionCapabilities,
  ProductProfile,
  ProfileAttribute,
  ProfileMessages,
  ProfileOption,
  ProfileRuleData,
  ProfileSourceRefs,
  SidePanelAvailabilityRow,
  SidePanelsRuleData,
  SyntesiFinishTransform,
  SyntesiRuleData,
  VesselCompatibilityRuleData,
  VesselFinishPreference,
} from "./model/productProfile";
export { ATTRIBUTE_SCOPES } from "./model/productProfile";

export type { CabinetHandleRelations, HandleHeightConstraint, NormalizedHandleProfile } from "./model/handleProfile";

export { parseProductProfile } from "./lib/parseProductProfile";
export type { ParseProductProfileResult, ProfileDiagnostic, ProfileDiagnosticCode } from "./lib/parseProductProfile";

export {
  hasCapability,
  isDrawerStyleMixingRestricted,
  isKnownOption,
  normalizeOptionValue,
  selectAttribute,
  selectEffectiveFallback,
  selectInitialValue,
  selectLegacySpelling,
  selectMessage,
  selectMessageOr,
  selectBasinOptions,
  selectOption,
  selectOptionValues,
  selectOptions,
  selectOptionsByCapability,
  selectResetValue,
  selectRuleData,
} from "./lib/productProfileSelectors";
export type { MessageParams } from "./lib/productProfileSelectors";

export {
  isHandleAllowedForDrawers,
  normalizeHandleProfile,
  parseHeightMapping,
  resolveForcedHeight,
  resolvePossibleForcedHeights,
} from "./lib/normalizeHandleProfile";
export type { NormalizedMatrixRow, NormalizeHandleProfileArgs } from "./lib/normalizeHandleProfile";

// Runtime bindings — owned by I: how a semantic value reaches the PlayCanvas scene.
export type {
  BoundRuntimeBinding,
  FlowTargets,
  IdentityValues,
  MappedValues,
  RuntimeBinding,
  RuntimeBindingSet,
  RuntimeFlow,
  RuntimeTarget,
  SceneValue,
  ScenePatch,
  SemanticValue,
  UnboundRuntimeBinding,
} from "./model/runtimeBindings";

export { parseRuntimeBindings } from "./lib/runtimeBindings/parseRuntimeBindings";
export type {
  ParseRuntimeBindingsResult,
  RuntimeBindingsDiagnostic,
  RuntimeBindingsDiagnosticCode,
} from "./lib/runtimeBindings/parseRuntimeBindings";

export {
  findMissingBindings,
  resolveRuntimeBinding,
  selectRuntimeBinding,
} from "./lib/runtimeBindings/resolveRuntimeBinding";
export type {
  ResolvedRuntimeBinding,
  RuntimeBindingFailure,
  RuntimeBindingFailureReason,
  RuntimeBindingRequest,
  RuntimeBindingResolution,
} from "./lib/runtimeBindings/resolveRuntimeBinding";

export { validateRuntimeBindings } from "./lib/runtimeBindings/validateRuntimeBindings";
export type { RuntimeBindingIssue, RuntimeBindingIssueCode } from "./lib/runtimeBindings/validateRuntimeBindings";
export {
  collectCustomizationAttributeIds,
  validateCollectionRuntimeContract,
} from "./lib/runtimeBindings/collectionRuntimeContract";

// Customization schema — owned by B: the UI description of steps, sections and fields.
export type {
  CustomizationFieldControl,
  CustomizationFieldDefinition,
  CustomizationFlow,
  CustomizationFlowId,
  CustomizationFlowStepRef,
  CustomizationScreenId,
  CustomizationScreenKind,
  CustomizationSchema,
  CustomizationSchemaDiagnostic,
  CustomizationSchemaDiagnosticCode,
  CustomizationSectionDefinition,
  CustomizationStepDefinition,
  FieldOptionState,
  FieldOptionTraits,
  FieldRuntimeState,
  ValidateCustomizationSchemaResult,
} from "./model/customizationSchema";
export { CUSTOMIZATION_FLOW_IDS, CUSTOMIZATION_SCREEN_IDS } from "./model/customizationSchema";

export { useCollectionPresets } from "./lib/useCollectionPresets";
