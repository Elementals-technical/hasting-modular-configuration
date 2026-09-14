import type { CustomizationFlowId, CustomizationScreenKind } from "@/entities/collection";

export type {
  CustomizationSchemaDiagnostic,
  CustomizationSchemaDiagnosticCode,
  ValidateCustomizationSchemaResult,
} from "@/entities/collection";

export type NavigationStep = {
  stepId: string;
  path: string;
  label: string;
  headerLabel: string;
  kind: CustomizationScreenKind;
};

export type NavigationResult = {
  flowId: CustomizationFlowId;
  steps: NavigationStep[];
  currentStep: NavigationStep | null;
  previousStep: NavigationStep | null;
  nextStep: NavigationStep | null;
  summaryStep: NavigationStep | null;
};
