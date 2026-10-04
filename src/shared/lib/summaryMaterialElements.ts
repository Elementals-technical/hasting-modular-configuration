export const materialSkuLabelMap: Record<string, string> = {
  LACG: "Lacquered Gloss",
  LACM: "Lacquered Matt",
  FX: "Fenix",
  HPL: "HPL",
  POR: "Porcelain",
  GLSM: "Glass Matt",
  GLSG: "Glass Gloss",
  SSMMO: "Minermalmaro",
  SSTM: "Tekormud",
  SSOCR: "Ocritech",
  SSTKR: "Tekorlux",
};

export type SummaryMaterialElement = {
  "Product Elements": string;
  Material: string;
  "Color Code": string;
};

type SummaryMaterialElementInput = {
  productElement: string;
  materialSku?: string | null;
  colorCode?: string | null;
};

export const buildSummaryMaterialElements = (inputs: SummaryMaterialElementInput[]): SummaryMaterialElement[] =>
  inputs.flatMap((input) => {
    const materialSku = input.materialSku?.trim();
    if (!materialSku) return [];

    return [
      {
        "Product Elements": input.productElement,
        Material: materialSkuLabelMap[materialSku] ?? materialSku,
        "Color Code": input.colorCode ?? "",
      },
    ];
  });
