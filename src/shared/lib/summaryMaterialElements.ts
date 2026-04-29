export type SummaryMaterialElement = {
  "Product Elements": string;
  Material: string;
  "Color Code": string;
};

type SummaryMaterialElementInput = {
  productElement: string;
  materialSku?: string | null;
  colorCode?: string | null;
  materialSkuLabelMap: Record<string, string>;
};

export const buildSummaryMaterialElements = (
  inputs: SummaryMaterialElementInput[],
): SummaryMaterialElement[] =>
  inputs.flatMap((input) => {
    const materialSku = input.materialSku?.trim();
    if (!materialSku) return [];

    return [
      {
        "Product Elements": input.productElement,
        Material: input.materialSkuLabelMap[materialSku] ?? materialSku,
        "Color Code": input.colorCode ?? "",
      },
    ];
  });
