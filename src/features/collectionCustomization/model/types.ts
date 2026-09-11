import type { CustomizationFlowId, CustomizationSchema, CustomizationScreenKind } from "@/entities/collection";

export type CustomizationSchemaDiagnosticCode =
  | "invalid-schema"
  | "missing-entry-step"
  | "unknown-step-id"
  | "duplicate-route"
  | "unsupported-kind"
  | "unknown-section-id"
  | "unsupported-control";

export type CustomizationSchemaDiagnostic = {
  code: CustomizationSchemaDiagnosticCode;
  dataPath: string;
  message: string;
};

export type ValidateCustomizationSchemaResult =
  | { ok: true; schema: CustomizationSchema }
  | { ok: false; diagnostics: CustomizationSchemaDiagnostic[] };

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
