import type { AttributeValue } from "@/entities/configuration";
import type { OptionState } from "@/features/configurator-rule-core/cabinetBuilder";

export const CUSTOMIZATION_FLOW_IDS = ["prebuilt", "custom"] as const;

export type CustomizationFlowId = (typeof CUSTOMIZATION_FLOW_IDS)[number];

export const CUSTOMIZATION_SCREEN_IDS = [
  "prebuilt-cabinet",
  "prebuilt-countertop",
  "prebuilt-accessories",
  "prebuilt-faucet-holes",
  "custom-cabinet-colors",
  "custom-countertop",
  "custom-accessories",
  "custom-faucet-holes",
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
  /** Stable code of `disabledReason`; the interface resolves it to text. */
  reasonCode?: string;
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
