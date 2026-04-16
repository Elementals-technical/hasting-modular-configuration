import { MAX_SLOTS } from "../model/constants";
import type { AttributeValue } from "../model/types";

const toLookupValue = (item: AttributeValue): string => item.metadata?.value ?? item.value ?? item.label;

const toIdentity = (item: AttributeValue): string =>
  `${item.parentName}__${item.metadata?.label ?? item.label}`;

const normalizeValues = (values: Array<string | null | undefined>): string[] => {
  const unique = new Set<string>();

  values.forEach((value) => {
    if (typeof value !== "string") return;
    const trimmed = value.trim();
    if (!trimmed) return;
    unique.add(trimmed);
  });

  return Array.from(unique);
};

export const deriveAutofillMaterials = ({
  allMaterialValues,
  values,
  limit = MAX_SLOTS,
}: {
  allMaterialValues: AttributeValue[];
  values: Array<string | null | undefined>;
  limit?: number;
}): AttributeValue[] => {
  if (!allMaterialValues.length || limit <= 0) return [];

  const wantedValues = normalizeValues(values);
  if (!wantedValues.length) return [];

  const seen = new Set<string>();
  const resolved: AttributeValue[] = [];

  wantedValues.forEach((wantedValue) => {
    if (resolved.length >= limit) return;

    const match = allMaterialValues.find((item) => toLookupValue(item) === wantedValue);
    if (!match) return;

    const identity = toIdentity(match);
    if (seen.has(identity)) return;

    seen.add(identity);
    resolved.push({ ...match, count: 1, selectionSource: "autofill" });
  });

  return resolved;
};

export const mergeAutofillWithSelectedMaterials = ({
  autofillMaterials,
  selectedMaterials,
  limit = MAX_SLOTS,
}: {
  autofillMaterials: AttributeValue[];
  selectedMaterials: AttributeValue[];
  limit?: number;
}): AttributeValue[] => {
  if (limit <= 0) return [];

  const manualSelectedMaterials = selectedMaterials.filter((item) => item.selectionSource === "manual");
  const merged: AttributeValue[] = [];
  const seen = new Set<string>();

  const push = (item: AttributeValue) => {
    if (merged.length >= limit) return;

    const identity = toIdentity(item);
    if (seen.has(identity)) return;

    seen.add(identity);
    merged.push(item);
  };

  autofillMaterials.forEach(push);
  manualSelectedMaterials.forEach(push);

  return merged;
};

export const areSameMaterialLists = (left: AttributeValue[], right: AttributeValue[]): boolean => {
  if (left.length !== right.length) return false;

  return left.every((item, index) => {
    const other = right[index];
    return Boolean(other) && toIdentity(item) === toIdentity(other);
  });
};
