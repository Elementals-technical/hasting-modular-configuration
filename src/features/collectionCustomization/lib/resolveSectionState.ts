import { selectOptions } from "@/entities/collection";

import type {
  CustomizationFieldDefinition,
  CustomizationSchema,
  FieldOptionState,
  FieldRuntimeState,
  ProductProfile,
} from "@/entities/collection";

export type FieldAvailability = { available: boolean; reason?: string };

// Keyed by availabilityRef as spelled in ui.json.
export type FieldAvailabilityResults = Record<string, FieldAvailability>;

export type ResolvedCustomizationField = {
  definition: CustomizationFieldDefinition;
  field: FieldRuntimeState;
};

const readProductOptionValue = (
  productOptions: Record<string, unknown>,
  attributeId: string,
): FieldRuntimeState["value"] => {
  const value = productOptions[attributeId];
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? value : null;
};

// Unknown or absent ref defaults to available.
const resolveFieldAvailability = (
  availabilityRef: string | undefined,
  results: FieldAvailabilityResults,
): FieldAvailability => {
  if (!availabilityRef) return { available: true };
  return results[availabilityRef] ?? { available: true };
};

// optionsRef fields (external sources) resolve with empty options for now.
export const resolveSectionFields = (
  schema: CustomizationSchema | null,
  sectionId: string,
  profile: ProductProfile | null,
  productOptions: Record<string, unknown>,
  availabilityResults: FieldAvailabilityResults,
): ResolvedCustomizationField[] => {
  const definitions = schema?.sections[sectionId]?.fields ?? [];

  return definitions.map((definition) => {
    const availability = resolveFieldAvailability(definition.availabilityRef, availabilityResults);

    const options: FieldOptionState[] = definition.optionsRef
      ? []
      : selectOptions(profile, definition.attributeId).map((option) => ({
          value: option.value,
          label: option.label,
          enabled: true,
        }));

    const field: FieldRuntimeState = {
      attributeId: definition.attributeId,
      value: readProductOptionValue(productOptions, definition.attributeId),
      options,
      visible: true,
      enabled: availability.available,
      disabledReason: availability.reason,
    };

    return { definition, field };
  });
};
