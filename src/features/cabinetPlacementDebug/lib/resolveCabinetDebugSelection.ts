import type { RuntimeBindingSet } from "@/entities/collection";
import { resolveProductConfig } from "@/entities/collection";

/** Collections with cabinet/countertop Drag & Drop. Others keep the classic Resize/Reposition menus. */
export const DRAG_DROP_COLLECTION_IDS: readonly string[] = ["urban-low-height", "urban-duplex"];

export const isDragDropCollection = (collectionId: string | null | undefined): boolean =>
  typeof collectionId === "string" && DRAG_DROP_COLLECTION_IDS.includes(collectionId);

/**
 * Reuse the active collection's type/value translation, preserving the current scene config. The
 * type the builder adds comes first: a click on a placed cabinet puts its scene config, with its
 * own type, in the builder's config.
 */
export const resolveCabinetDebugSelection = ({
  config,
  selectedProductId,
  addedCabinetType,
  bindings,
}: {
  config: Record<string, unknown> | null;
  selectedProductId: string | null;
  /** The cabinet type the builder adds, the one its "+" adds. */
  addedCabinetType: string | null;
  bindings: RuntimeBindingSet | null;
}): { definitionId: string; selection: Record<string, unknown> } | null => {
  if (!config) return null;
  const definitionIds = [...new Set(Object.values(bindings?.productTypes ?? {}))]
    .sort((left, right) => right.length - left.length);
  const candidates = [
    addedCabinetType ? bindings?.productTypes[addedCabinetType] : null,
    config.ProductType, config.productType, config.type, config.name,
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
