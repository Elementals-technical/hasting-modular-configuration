import { type ProductModel, type ProductSize, type ProductStyle, type PresetProduct } from "@/entities/product/types";

export function computeSize(title: string): ProductSize {
  const match = title.match(/(\d+)"/);

  const inches = match ? parseInt(match[1], 10) : 0;
  if (inches < 30) return "24_29";
  if (inches < 40) return "30_39";
  if (inches < 50) return "40_49";
  if (inches < 60) return "50_59";
  if (inches < 70) return "60_69";
  if (inches < 80) return "70_79";
  if (inches < 90) return "80_89";
  return "90_plus";
}

export function computeStyles(presetProducts: PresetProduct[]): ProductStyle[] {
  const styles: ProductStyle[] = [];

  const hasDrawer1 = presetProducts.some((p) => p.Drawers === "1D");
  const hasDrawer2 = presetProducts.some((p) => p.Drawers === "2D");

  if (hasDrawer1) styles.push("1_drawer");
  if (hasDrawer2) styles.push("2_drawer");

  const sinkBases = presetProducts.filter((p) => p.name === "Sink-Base" && p.sinkType);
  if (sinkBases.length === 1) styles.push("single_basin");
  if (sinkBases.length >= 2) styles.push("double_basin");

  if (presetProducts.some((p) => p.name === "Open-Shelf")) styles.push("open_shelving");

  if (presetProducts.length >= 2) {
    const len = presetProducts.length;
    let isSymmetric = true;

    for (let i = 0; i < Math.floor(len / 2); i++) {
      const left = presetProducts[i];
      const right = presetProducts[len - 1 - i];
      if (left.name !== right.name || left.Width !== right.Width) {
        isSymmetric = false;
        break;
      }
    }
    if (!isSymmetric) styles.push("asymmetrical");
  }

  return styles;
}

export function enrichProduct(raw: Omit<ProductModel, "size" | "style">): ProductModel {
  return {
    ...raw,
    size: computeSize(raw.title),
    style: computeStyles(raw.presetProducts),
  };
}
