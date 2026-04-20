const WHITE_BIANCO_0B_PRICING_MATERIAL = "White GL/MT";

const isWhiteBianco0BFinish = (value?: string | null): boolean =>
  typeof value === "string" && /^Bianco\s+0B\s+(?:MT|GL)$/i.test(value.trim());

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
