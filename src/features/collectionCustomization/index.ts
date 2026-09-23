export { validateCustomizationSchema } from "@/entities/collection";
export { computeNavigation, resolveEntryStep, resolveFlowForPath } from "./lib/computeNavigation";
export { buildStepRoutes } from "./lib/buildStepRoutes";
export type { StepScreen, StepScreens } from "./lib/buildStepRoutes";
export { useCollectionNavigation } from "./lib/useCollectionNavigation";
export { buildStepPathById, useStepPathById } from "./lib/useStepPathById";
export { useEntryStep } from "./lib/useEntryStep";
export { useStepNavigate, withPreservedCollectionId } from "./lib/useStepNavigate";
export { useCollectionNavigate } from "./lib/useCollectionNavigate";
export { withPreservedEntrySearch } from "./lib/withPreservedEntrySearch";
export { resolveSectionFields } from "./lib/resolveSectionState";
export { useCustomizationStepSections } from "./lib/useCustomizationSectionState";
export { buildConfiguratorOptions, fromCsv, pick } from "./lib/buildConfiguratorOptions";
export { useCountertopRuleState } from "./lib/useCountertopRuleState";
export { selectOptionLabel, useOptionLabel } from "./lib/selectOptionLabel";
export { FieldControl } from "./ui/FieldControl";
export { useOptionImages } from "./lib/useOptionImages";
export { ColorField } from "./ui/ColorField";
export { ReasonTextProvider } from "./ui/ReasonTextProvider";
export type {
  CustomizationSchemaDiagnostic,
  CustomizationSchemaDiagnosticCode,
  NavigationResult,
  NavigationStep,
  ValidateCustomizationSchemaResult,
} from "./model/types";
export type { ResolvedCustomizationField, ResolvedCustomizationSection } from "./lib/useCustomizationSectionState";
export {
  buildBasinOptions,
  buildCountertopStyleOptions,
  buildDividerModeOptions,
  buildDividerStyleOptions,
  buildSidePanelOptions,
  buildThicknessOptions,
  buildTowelBarOptions,
} from "./lib/pageOptionCatalogs";
