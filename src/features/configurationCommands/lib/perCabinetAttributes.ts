import type { RootState } from "@/app/store";
import {
  perCabinetAttributeId,
  perCabinetAttributeLabel,
  selectDefaultValue,
  selectOptions,
  type CustomizationSchema,
  type PerCabinetAttribute,
  type ProductProfile,
} from "@/entities/collection";
import { resolveAttributeLabel } from "@/entities/collection/lib/customization/resolveAttributeLabel";
import {
  compositionValueOf,
  getActiveProductProfile,
  getCabinetEntries,
  getValuesByAttributeId,
  isSameTarget,
} from "@/entities/configuration";
import type { ScopedValue, StableCabinetKey } from "@/entities/configuration";

/**
 * Cabinet values a collection offers for one cabinet alone (`styleSidebar.attributes`,
 * `playerMenu.attributes` of its ui.json): the side of the lateral panel of Urban Duplex. The
 * style sidebar and the menu of a placed cabinet show the same field, built here once.
 */
export type PerCabinetAttributeField = {
  canApplyToAll?: boolean;
  attributeId: string;
  /** As the collection's ui.json names the value (the entry's `label`, else a section's), else its id. */
  label: string;
  options: { value: string; label: string; disabled?: boolean }[];
  /** What the cabinet holds; the composition's value, else the collection's starting one, where it holds none. */
  value: string | null;
};

type FieldInputs = {
  profile: ProductProfile | null;
  schema: CustomizationSchema | null | undefined;
  /** Every recorded value by attribute and address. */
  recorded: Readonly<Record<string, readonly ScopedValue[] | undefined>>;
  /** Where the composition's value is recorded. */
  firstCabinetId: StableCabinetKey | undefined;
  attributes: readonly PerCabinetAttribute[];
  /** The cabinet the fields are for; `null` for one that is not placed yet. */
  cabinetId: StableCabinetKey | null;
  /** The config of the cabinet being added, for what decides whether it is offered a value. */
  pending?: Readonly<Record<string, unknown>> | null;
};

const asText = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);

export const buildPerCabinetAttributeFields = ({
  profile,
  schema,
  recorded,
  firstCabinetId,
  attributes,
  cabinetId,
  pending = null,
}: FieldInputs): PerCabinetAttributeField[] => {
  const ownValue = (attributeId: string): string | null =>
    cabinetId
      ? asText(
          recorded[attributeId]?.find(({ target }) => isSameTarget(target, { scope: "cabinet", cabinetId }))?.value,
        )
      : null;
  // What the cabinet holds itself: a placed one in the state, one being added in its config.
  // Without a value of its own it is the collection's cabinet, with the starting value.
  const heldValue = (attributeId: string): string =>
    (cabinetId ? ownValue(attributeId) : asText(pending?.[attributeId])) ?? selectDefaultValue(profile, attributeId);

  return attributes.flatMap((entry) => {
    const attributeId = perCabinetAttributeId(entry);
    const isOffered =
      typeof entry === "string" || Object.entries(entry.when).every(([id, value]) => heldValue(id) === value);
    if (!isOffered) return [];

    const options = selectOptions(profile, attributeId).map(({ value, label }) => ({ value, label }));
    // Nothing to choose: the collection lists a value its profile does not offer.
    if (options.length === 0) return [];

    const entries = recorded[attributeId];
    const own = ownValue(attributeId);

    return [
      {
        attributeId,
        label: perCabinetAttributeLabel(entry) ?? resolveAttributeLabel(schema, attributeId, attributeId),
        options,
        value:
          own ??
          asText(compositionValueOf(entries, firstCabinetId)) ??
          asText(selectDefaultValue(profile, attributeId)),
      },
    ];
  });
};

/** The fields as the state holds them, for a handler that reads the state when it runs. */
export const selectPerCabinetAttributeFields = (
  state: RootState,
  schema: CustomizationSchema | null | undefined,
  attributes: readonly PerCabinetAttribute[],
  cabinetId: StableCabinetKey | null,
): PerCabinetAttributeField[] =>
  buildPerCabinetAttributeFields({
    profile: getActiveProductProfile(state),
    schema,
    recorded: getValuesByAttributeId(state),
    firstCabinetId: getCabinetEntries(state)[0]?.stableKey,
    attributes,
    cabinetId,
  });
