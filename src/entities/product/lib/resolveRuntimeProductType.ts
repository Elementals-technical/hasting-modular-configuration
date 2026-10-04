/**
 * The random tail the scene gives a product id (`${type}-${Math.random().toString(36).substr(2, 9)}`).
 * A digit tells it from the last word of a type: "Mako-sink-cabinet" keeps its "cabinet".
 */
const RUNTIME_SUFFIX_PATTERN = /^(?=[a-z]*\d)[a-z0-9]{6,}$/i;

type RuntimeProductType = "Sink-Base" | "Sink-Cabinet" | "Open-Shelf" | "Side-Shelf";

const EXACT_RUNTIME_PRODUCT_TYPE_ALIASES: Record<string, RuntimeProductType> = {
  sb: "Sink-Base",
  sc: "Sink-Cabinet",
  os: "Open-Shelf",
  oss: "Side-Shelf",
};

const NAMED_RUNTIME_PRODUCT_TYPE_ALIASES: Record<string, RuntimeProductType> = {
  sinkbase: "Sink-Base",
  sinkcabinet: "Sink-Cabinet",
  sidecabinet: "Sink-Cabinet",
  openshelf: "Open-Shelf",
  sideshelf: "Side-Shelf",
};

const stripRuntimeSuffix = (value: string): string => {
  const trimmed = value.trim();
  const lastDash = trimmed.lastIndexOf("-");
  if (lastDash <= 0) return trimmed;

  const suffix = trimmed.slice(lastDash + 1);
  return RUNTIME_SUFFIX_PATTERN.test(suffix) ? trimmed.slice(0, lastDash) : trimmed;
};

const toCompact = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const resolveCompactRuntimeProductTypeAlias = (compact: string): RuntimeProductType | null => {
  const exactMatch =
    EXACT_RUNTIME_PRODUCT_TYPE_ALIASES[compact] ?? NAMED_RUNTIME_PRODUCT_TYPE_ALIASES[compact];
  if (exactMatch) return exactMatch;

  // Only a leading alias: "Sink-Base-new-1" is a Sink-Base, but "Mako-sink-cabinet" is a scene type of
  // its own, not an Urban Sink-Cabinet.
  for (const [alias, productType] of Object.entries(NAMED_RUNTIME_PRODUCT_TYPE_ALIASES)) {
    if (compact.startsWith(alias)) return productType;
  }

  return null;
};

const resolveRuntimeProductTypeAlias = (value: string): RuntimeProductType | null => {
  return (
    resolveCompactRuntimeProductTypeAlias(toCompact(value)) ??
    resolveCompactRuntimeProductTypeAlias(toCompact(stripRuntimeSuffix(value)))
  );
};

const readString = (record: Record<string, unknown>, key: string): string | null => {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value : null;
};

export const normalizeRuntimeProductType = (value: string): string => {
  return resolveRuntimeProductTypeAlias(value) ?? stripRuntimeSuffix(value);
};

export const resolveRuntimeProductType = (productId: string, config?: Record<string, unknown>): string => {
  const productIdType = normalizeRuntimeProductType(productId);

  if (resolveRuntimeProductTypeAlias(productIdType)) {
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

export const withRuntimeProductType = <TConfig extends object>(
  config: TConfig,
  productType: string,
): TConfig & { ProductType: string; productType: string } => {
  const runtimeProductType = normalizeRuntimeProductType(productType);

  return {
    ...config,
    ProductType: runtimeProductType,
    productType: runtimeProductType,
  };
};
