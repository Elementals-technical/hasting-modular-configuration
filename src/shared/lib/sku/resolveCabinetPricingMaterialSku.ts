const WHITE_BIANCO_0B_PRICING_MATERIAL = "White GL/MT";

const isWhiteBianco0BFinish = (value?: string | null): boolean =>
  typeof value === "string" && /^Bianco\s+0B\s+(?:MT|GL)$/i.test(value.trim());

const is3DFinish = (materialSku?: string | null): boolean => materialSku?.trim().toUpperCase() === "3D";

// Cabinet finishes whose pricing absorbs the handle-groove pricing:
// - "3D": groove is carved on the same surface
// - "White GL/MT": cabinet is Bianco 0B, groove is painted same finish
const cabinetMergesHandleGroovePricing = (cabinetMaterialSku?: string | null): boolean => {
  if (!cabinetMaterialSku) return false;
  if (is3DFinish(cabinetMaterialSku)) return true;
  return cabinetMaterialSku.trim() === WHITE_BIANCO_0B_PRICING_MATERIAL;
};

export const resolveCabinetPricingMaterialSku = ({
  colorName,
  materialSku,
}: {
  colorName?: string | null;
  materialSku: string | null;
}): string | null => {
  if (isWhiteBianco0BFinish(colorName)) {
    return WHITE_BIANCO_0B_PRICING_MATERIAL;
  }

  return materialSku;
};

export const resolveHandleGroovePricingMaterialSku = ({
  cabinetMaterialSku,
  colorName,
  materialSku,
}: {
  cabinetMaterialSku: string | null;
  colorName?: string | null;
  materialSku: string | null;
}): string | null => {
  if (cabinetMergesHandleGroovePricing(cabinetMaterialSku) && isWhiteBianco0BFinish(colorName)) {
    return WHITE_BIANCO_0B_PRICING_MATERIAL;
  }

  return materialSku;
};
