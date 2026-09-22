import type { AttributeValue } from "@/entities/configuration";
import type { OptionState } from "@/features/configurator-rule-core/cabinetBuilder";

export const CUSTOMIZATION_FLOW_IDS = ["prebuilt", "custom"] as const;

export type CustomizationFlowId = (typeof CUSTOMIZATION_FLOW_IDS)[number];

export const CUSTOMIZATION_SCREEN_IDS = [
  "prebuilt-cabinet",
  "custom-cabinet-colors",
  "countertop",
  "accessories",
  "custom-summary",
] as const;

export type CustomizationScreenId = (typeof CUSTOMIZATION_SCREEN_IDS)[number];

export type CustomizationFlowStepRef = {
  stepId: string;
  path: string;
  screen?: CustomizationScreenId;
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
  /** false removes the step from navigation and routes; absent means enabled. */
  enabled?: boolean;
};

/**
 * How a field is shown: text chips, a grid of options with their pictures, a checkbox, or the
 * colour grid of a material (pictures or colour, material filters, full mode and swatch order),
 * as the Urban colour screens show a colour.
 */
export type CustomizationFieldControl = "swatches" | "options-grid" | "checkbox" | "colors";

export type CustomizationFieldDefinition = {
  attributeId: string;
  control: CustomizationFieldControl;
  optionsRef?: string;
  availabilityRef?: string;
  /** Text under the control, keyed by the selected option value. */
  hints?: Record<string, string>;
};

export type CustomizationSectionDefinition = {
  label: string;
  defaultOpen?: boolean;
  fields: CustomizationFieldDefinition[];
  /** false drops the section from its step, without clearing the values of its fields. */
  enabled?: boolean;
};

export type CustomizationSchema = {
  collectionId: string;
  flows: Record<CustomizationFlowId, CustomizationFlow>;
  steps: Record<string, CustomizationStepDefinition>;
  sections: Record<string, CustomizationSectionDefinition>;
};

/** Properties of a configurator colour the colour grid filters and prices by. */
export type FieldOptionTraits = {
  sku?: string;
  materials?: string[];
  colors?: string[];
  looks?: string[];
  hex?: string;
};

export type FieldOptionState = OptionState<string> & {
  image?: string;
  /** Group the option is shown under, e.g. the material of a colour. */
  desc?: string;
  traits?: FieldOptionTraits;
};

export type FieldRuntimeState = {
  attributeId: string;
  value: AttributeValue;
  options: FieldOptionState[];
  visible: boolean;
  enabled: boolean;
  disabledReason?: string;
  /** The hint ui.json declares for the current value. */
  hint?: string;
  loading?: boolean;
  error?: string;
};

export type CustomizationSchemaDiagnosticCode =
  | "invalid-schema"
  | "missing-entry-step"
  | "unknown-step-id"
  | "duplicate-route"
  | "unsupported-kind"
  | "unsupported-screen"
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
