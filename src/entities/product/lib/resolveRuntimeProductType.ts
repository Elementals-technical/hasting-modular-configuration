const RUNTIME_SUFFIX_PATTERN = /^[a-z0-9]{6,}$/i;

const CANONICAL_PRODUCT_TYPES = ["Sink-Base", "Sink-Cabinet", "Side-Cabinet", "Open-Shelf", "Side-Shelf"] as const;

type CanonicalProductType = (typeof CANONICAL_PRODUCT_TYPES)[number];

const stripRuntimeSuffix = (value: string): string => {
  const trimmed = value.trim();
  const lastDash = trimmed.lastIndexOf("-");
  if (lastDash <= 0) return trimmed;

  const suffix = trimmed.slice(lastDash + 1);
  return RUNTIME_SUFFIX_PATTERN.test(suffix) ? trimmed.slice(0, lastDash) : trimmed;
};

const toCompact = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const resolveCanonicalProductType = (value: string): CanonicalProductType | null => {
  const compact = toCompact(stripRuntimeSuffix(value));

  if (compact === "oss" || compact.includes("sideshelf")) return "Side-Shelf";
  if (compact === "os" || compact.includes("openshelf")) return "Open-Shelf";
  if (compact.includes("sinkcabinet")) return "Sink-Cabinet";
  if (compact.includes("sidecabinet")) return "Side-Cabinet";
  if (compact.includes("sinkbase")) return "Sink-Base";

  return null;
};

const readString = (record: Record<string, unknown>, key: string): string | null => {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value : null;
};

export const normalizeRuntimeProductType = (value: string): string => {
  return resolveCanonicalProductType(value) ?? stripRuntimeSuffix(value);
};

export const resolveRuntimeProductType = (productId: string, config?: Record<string, unknown>): string => {
  const productIdType = normalizeRuntimeProductType(productId);

  if (resolveCanonicalProductType(productIdType)) {
    return productIdType;
  }

  if (config) {
    const productType =
      readString(config, "ProductType") ??
      readString(config, "productType") ??
      readString(config, "entityName") ??
      readString(config, "EntityName") ??
      readString(config, "type");

    if (productType) {
      return normalizeRuntimeProductType(productType);
    }
  }

  return productIdType;
};

export const withRuntimeProductType = (
  config: Record<string, unknown>,
  productType: string,
): Record<string, unknown> => {
  return {
    ...config,
    ProductType: productType,
    productType,
  };
};
