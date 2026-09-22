export { validateCustomizationSchema } from "@/entities/collection";
export { computeNavigation, resolveEntryStep, resolveFlowForPath } from "./lib/computeNavigation";
export { buildStepRoutes } from "./lib/buildStepRoutes";
export type { StepScreen, StepScreens } from "./lib/buildStepRoutes";
export { useCollectionNavigation } from "./lib/useCollectionNavigation";
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
export { ColorField } from "./ui/ColorField";
export type {
  CustomizationSchemaDiagnostic,
  CustomizationSchemaDiagnosticCode,
  NavigationResult,
  NavigationStep,
  ValidateCustomizationSchemaResult,
} from "./model/types";
export type { ResolvedCustomizationField, ResolvedCustomizationSection } from "./lib/useCustomizationSectionState";
