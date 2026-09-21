export { validateCustomizationSchema } from "@/entities/collection";
export { computeNavigation, resolveEntryStep, resolveFlowForPath } from "./lib/computeNavigation";
export { buildStepRoutes } from "./lib/buildStepRoutes";
export type { StepScreen, StepScreens } from "./lib/buildStepRoutes";
export { useCollectionNavigation } from "./lib/useCollectionNavigation";
export { useEntryStep } from "./lib/useEntryStep";
export { useStepNavigate, withPreservedCollectionId } from "./lib/useStepNavigate";
export { resolveSectionFields } from "./lib/resolveSectionState";
export { useCustomizationSectionFields, useCustomizationStepSections } from "./lib/useCustomizationSectionState";
export { buildConfiguratorOptions } from "./lib/buildConfiguratorOptions";
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
