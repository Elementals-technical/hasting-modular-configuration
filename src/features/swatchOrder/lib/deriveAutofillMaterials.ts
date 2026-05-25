import { MAX_SLOTS } from "../model/constants";
import type { AttributeValue } from "../model/types";
import { getSwatchIdentity } from "./getSwatchIdentity";

const toLookupValue = (item: AttributeValue): string => item.metadata?.value ?? item.value ?? item.label;

export type AutofillValueRequest =
  | string
  | null
  | undefined
  | {
      value: string | null | undefined;
      preferredParentName?: string;
      preferredMaterialTokens?: readonly string[];
    };

type NormalizedAutofillRequest = {
  value: string;
  preferredParentName?: string;
  preferredMaterialTokens: string[];
};

const normalizeMaterialToken = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const normalizeMaterialTokens = (values: readonly string[] | undefined): string[] =>
  values?.map(normalizeMaterialToken).filter(Boolean) ?? [];

const normalizeAutofillRequest = (request: AutofillValueRequest): NormalizedAutofillRequest | null => {
  if (request === null || request === undefined) return null;
  if (typeof request === "string") {
    const trimmed = request.trim();
    return trimmed ? { value: trimmed, preferredMaterialTokens: [] } : null;
  }
  if (typeof request.value !== "string") return null;
  const trimmed = request.value.trim();
  if (!trimmed) return null;
  return {
    value: trimmed,
    preferredParentName: request.preferredParentName,
    preferredMaterialTokens: normalizeMaterialTokens(request.preferredMaterialTokens),
  };
};

const getVariantMaterialTokens = (item: AttributeValue): string[] =>
  [
    item.metadata?.Material,
    item.metadata?.Finish,
    item.metadata?.sku,
    item.optionName,
  ]
    .map((value) => (typeof value === "string" ? normalizeMaterialToken(value) : ""))
    .filter(Boolean);

const findByPreferredMaterial = (
  variants: AttributeValue[],
  preferredMaterialTokens: readonly string[],
): AttributeValue | undefined => {
  if (!preferredMaterialTokens.length) return undefined;
  const preferred = new Set(preferredMaterialTokens);
  return variants.find((item) => getVariantMaterialTokens(item).some((token) => preferred.has(token)));
};

// Picks the variant whose parentName matches the slot the user is autofilling
// from. The same `value` (e.g. "Aragosta 77 MT") can exist under multiple
// Threekit groups (Cabinet Color, Countertop Color, …) — without this hint
// the first occurrence wins and the swatch lands under the wrong parentName,
// which breaks parent-scoped UI logic such as material-family acronyms.
const selectVariantForRequest = (
  variants: AttributeValue[],
  preferredParentName?: string,
  preferredMaterialTokens: readonly string[] = [],
): AttributeValue | undefined => {
  if (!variants.length) return undefined;
  if (preferredParentName) {
    const parentMatches = variants.filter((item) => item.parentName === preferredParentName);
    const materialMatch = findByPreferredMaterial(parentMatches, preferredMaterialTokens);
    if (materialMatch) return materialMatch;
    if (parentMatches.length) return parentMatches[0];
  }
  const materialMatch = findByPreferredMaterial(variants, preferredMaterialTokens);
  if (materialMatch) return materialMatch;
  return variants[0];
};

export const deriveAutofillMaterials = ({
  allMaterialValues,
  values,
  limit = MAX_SLOTS,
}: {
  allMaterialValues: AttributeValue[];
  values: Array<AutofillValueRequest>;
  limit?: number;
}): AttributeValue[] => {
  if (!allMaterialValues.length || limit <= 0) return [];

  const requests = values
    .map(normalizeAutofillRequest)
    .filter((request): request is NormalizedAutofillRequest => request !== null);
  if (!requests.length) return [];

  const seen = new Set<string>();
  const resolved: AttributeValue[] = [];

  requests.forEach(({ value, preferredParentName, preferredMaterialTokens }) => {
    if (resolved.length >= limit) return;

    const matches = allMaterialValues.filter((item) => toLookupValue(item) === value);
    const match = selectVariantForRequest(matches, preferredParentName, preferredMaterialTokens);
    if (!match) return;

    const identity = getSwatchIdentity(match);
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

    const identity = getSwatchIdentity(item);
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
    return Boolean(other) && getSwatchIdentity(item) === getSwatchIdentity(other);
  });
};
