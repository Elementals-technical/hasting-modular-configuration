import type { RuntimeBindingSet } from "@/entities/collection";
import { resolveProductConfig } from "@/entities/collection";

export const isCabinetPlacementDebugEnabled = (search: string): boolean => {
  const params = new URLSearchParams(search);
  if (params.has("cabinetEngineering") || params.has("cabinetFromLine")) return false;
  return true;
};

/** Reuse the active collection's type/value translation, preserving the current scene config. */
export const resolveCabinetDebugSelection = ({
  config,
  selectedProductId,
  activeCabinetType,
  bindings,
}: {
  config: Record<string, unknown> | null;
  selectedProductId: string | null;
  activeCabinetType: string | null;
  bindings: RuntimeBindingSet | null;
}): { definitionId: string; selection: Record<string, unknown> } | null => {
  if (!config) return null;
  const definitionIds = [...new Set(Object.values(bindings?.productTypes ?? {}))]
    .sort((left, right) => right.length - left.length);
  const candidates = [
    config.ProductType, config.productType, config.type, config.name,
    activeCabinetType ? bindings?.productTypes[activeCabinetType] : null,
    selectedProductId,
  ];
  const explicitType = [config.ProductType, config.productType, config.type, config.name]
    .find((candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0);
  const definitionId = definitionIds.length ? candidates.flatMap((candidate) => typeof candidate === "string"
    ? definitionIds.filter((type) => candidate === type || candidate.startsWith(`${type}-`))
    : [])[0] : explicitType;
  if (!definitionId) return null;
  return { definitionId, selection: bindings ? resolveProductConfig(bindings, config) : { ...config } };
};
