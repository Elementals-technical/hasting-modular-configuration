import type { CollectionSkuProfile, FieldOptionState } from "@/entities/collection";

/** Lower's colours: its palette, in the materials the collection's cover comes in. */
export const buildCoverColorOptions = (
  options: FieldOptionState[],
  skuProfile: CollectionSkuProfile | null,
): FieldOptionState[] => {
  const allowed = skuProfile?.cabinetCover?.materialSkus ?? [];
  return options.filter((option) => {
    const materialSku =
      option.traits?.sku ??
      option.traits?.materials?.map((category) => skuProfile?.colors.materialByCategory[category]).find(Boolean);
    return Boolean(materialSku && allowed.includes(materialSku));
  });
};
