import type { AttributeValue } from "../model/types";

const normalizeIdentityPart = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

  return normalized || null;
};

export const getSwatchIdentity = (item: AttributeValue): string => {
  const material =
    normalizeIdentityPart(item.metadata?.sku) ??
    normalizeIdentityPart(item.metadata?.Material) ??
    normalizeIdentityPart(item.metadata?.Finish) ??
    normalizeIdentityPart(item.optionName) ??
    normalizeIdentityPart(item.parentName) ??
    "unknownmaterial";
  const value =
    normalizeIdentityPart(item.metadata?.value) ??
    normalizeIdentityPart(item.value) ??
    normalizeIdentityPart(item.metadata?.label) ??
    normalizeIdentityPart(item.label) ??
    normalizeIdentityPart(item.name) ??
    "unknownvalue";

  return `${material}__${value}`;
};
