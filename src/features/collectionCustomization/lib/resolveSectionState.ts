import { selectAttribute, selectOptions, selectResetValue } from "@/entities/collection";

import { buildConfiguratorOptions } from "./buildConfiguratorOptions";

import type {
  CustomizationFieldDefinition,
  CustomizationSchema,
  FieldOptionState,
  FieldRuntimeState,
  ProductProfile,
} from "@/entities/collection";
import type { ConfiguratorGroupCatalog } from "@/entities/collection/model/types";

export type FieldAvailability = {
  available: boolean;
  reason?: string;
  /** false hides the field; a hidden field keeps its stored value. */
  visible?: boolean;
  /** When set, only these option values stay enabled. */
  allowedValues?: readonly string[];
};

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

const CONFIGURATOR_SOURCE_PREFIX = "configurator:";

// An optionsRef field takes the configurator section its profile attribute names in optionsSource.
const resolveConfiguratorOptions = (
  profile: ProductProfile | null,
  attributeId: string,
  configurator: ConfiguratorGroupCatalog | null,
): FieldOptionState[] => {
  const source = selectAttribute(profile, attributeId)?.optionsSource;
  if (!source?.startsWith(CONFIGURATOR_SOURCE_PREFIX) || !configurator) return [];

  const resetValue = selectResetValue(profile, attributeId);
  const options = buildConfiguratorOptions(configurator.groupsByName[source.slice(CONFIGURATOR_SOURCE_PREFIX.length)]);

  return resetValue && !options.some((option) => option.value === resetValue)
    ? [{ value: resetValue, label: resetValue, enabled: true }, ...options]
    : options;
};

export const resolveSectionFields = (
  schema: CustomizationSchema | null,
  sectionId: string,
  profile: ProductProfile | null,
  productOptions: Record<string, unknown>,
  availabilityResults: FieldAvailabilityResults,
  configurator: ConfiguratorGroupCatalog | null = null,
): ResolvedCustomizationField[] => {
  const definitions = schema?.sections[sectionId]?.fields ?? [];

  return definitions.map((definition) => {
    const availability = resolveFieldAvailability(definition.availabilityRef, availabilityResults);
    const declaredOptions: FieldOptionState[] = definition.optionsRef
      ? resolveConfiguratorOptions(profile, definition.attributeId, configurator)
      : selectOptions(profile, definition.attributeId).map(({ value, label }) => ({ value, label, enabled: true }));

    const options = declaredOptions.map((option) => {
      const enabled = !availability.allowedValues || availability.allowedValues.includes(option.value);
      return { ...option, enabled, reason: enabled ? undefined : availability.reason };
    });

    const field: FieldRuntimeState = {
      attributeId: definition.attributeId,
      value: readProductOptionValue(productOptions, definition.attributeId),
      options,
      visible: availability.visible ?? true,
      enabled: availability.available,
      disabledReason: availability.reason,
    };

    return { definition, field };
  });
};
