import type { AttributeValue } from "@/entities/configuration";
import type { OptionState } from "@/features/configurator-rule-core/cabinetBuilder";

export type CustomizationFlowId = "prebuilt" | "custom";

export type CustomizationFlowStepRef = {
  stepId: string;
  path: string;
};

export type CustomizationFlow = {
  entryStepId: string;
  steps: CustomizationFlowStepRef[];
};

export type CustomizationScreenKind = "preset-picker" | "cabinet-builder" | "fields" | "summary";

export type CustomizationStepDefinition = {
  label: string;
  kind: CustomizationScreenKind;
  headerPrefix?: string | null;
  sectionIds?: string[];
};

export type CustomizationFieldControl = "swatches" | "options-grid" | "checkbox";

export type CustomizationFieldDefinition = {
  attributeId: string;
  control: CustomizationFieldControl;
  optionsRef?: string;
  availabilityRef?: string;
};

export type CustomizationSectionDefinition = {
  label: string;
  defaultOpen?: boolean;
  fields: CustomizationFieldDefinition[];
};

export type CustomizationSchema = {
  collectionId: string;
  flows: Record<CustomizationFlowId, CustomizationFlow>;
  steps: Record<string, CustomizationStepDefinition>;
  sections: Record<string, CustomizationSectionDefinition>;
};

export type FieldOptionState = OptionState<string> & { image?: string };

export type FieldRuntimeState = {
  attributeId: string;
  value: AttributeValue;
  options: FieldOptionState[];
  visible: boolean;
  enabled: boolean;
  disabledReason?: string;
  loading?: boolean;
  error?: string;
};

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
