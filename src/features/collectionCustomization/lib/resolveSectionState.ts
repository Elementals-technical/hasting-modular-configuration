import { selectAttribute, selectOptions, selectResetValue } from "@/entities/collection";

import { buildConfiguratorOptions } from "./buildConfiguratorOptions";

import type {
  CustomizationFieldDefinition,
  MessageParams,
  CustomizationSchema,
  FieldOptionState,
  FieldRuntimeState,
  ProductProfile,
} from "@/entities/collection";
import type { ConfiguratorGroupCatalog } from "@/entities/collection/model/types";

export type FieldAvailability = {
  available: boolean;
  reason?: string;
  /** Stable code of `reason`; the interface resolves it to text. */
  reasonCode?: string;
  /** Values the code's text names; without them the interface shows its placeholders. */
  reasonParams?: MessageParams;
  /** false hides the field; a hidden field keeps its stored value. */
  visible?: boolean;
  /** When set, only these option values stay enabled. */
  allowedValues?: readonly string[];
  /** When set, only these option values are shown; a hidden one keeps its stored value. */
  visibleValues?: readonly string[];
  /** The option shown as chosen while nothing is stored, e.g. None for a vessel without a basin. */
  valueWhenEmpty?: string;
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
      : selectOptions(profile, definition.attributeId).map(({ value, label, category }) => ({
          value,
          label,
          enabled: true,
          desc: category,
        }));

    // Pictures the collection declares for this attribute; a configurator option keeps its own.
    const declaredImages = schema?.optionImages?.[definition.attributeId];

    const shownOptions = availability.visibleValues
      ? declaredOptions.filter((option) => availability.visibleValues?.includes(option.value))
      : declaredOptions;

    const options = shownOptions.map((option) => {
      const enabled = !availability.allowedValues || availability.allowedValues.includes(option.value);
      return {
        ...option,
        enabled,
        image: option.image ?? declaredImages?.[option.value],
        reason: enabled ? undefined : availability.reason,
        reasonCode: enabled ? undefined : availability.reasonCode,
        reasonParams: enabled ? undefined : availability.reasonParams,
      };
    });

    const storedValue = readProductOptionValue(productOptions, definition.attributeId);
    const value =
      storedValue === null || storedValue === "" ? (availability.valueWhenEmpty ?? storedValue) : storedValue;
    const field: FieldRuntimeState = {
      attributeId: definition.attributeId,
      value,
      options,
      visible: availability.visible ?? true,
      enabled: availability.available,
      disabledReason: availability.reason,
      reasonCode: availability.reasonCode,
      reasonParams: availability.reasonParams,
      hint: value === null ? undefined : definition.hints?.[String(value)],
    };

    return { definition, field };
  });
};
