import { getDimensionTool } from "@/utils/functions/playcanvas/getDimensionTool";

export type NormalizedProductConfigSnapshot = {
  id: string;
  _productId: string;
  category: string | null;
  name: string | null;
  ProductType: string | null;
  productType: string | null;
  type: string | null;
  entityName: string | null;
  Width: number | null;
  Height: number | null;
  Depth: number | null;
  Thickness: string | null;
  Drawers: string | null;
  Handle: string | null;
  CabinetColor: string | null;
  CountertopColor: string | null;
  sinkType: string | null;
};

type NormalizeProductConfigParams = {
  id: string;
  raw: Record<string, unknown>;
  selectedDimensions: {
    width: number | null;
    height: number | null;
    depth: number | null;
  };
};

const readDimValue = (map?: Record<string, string>) => {
  if (!map) return null;

  const [key] = Object.keys(map);
  if (!key) return null;

  const value = Number(key);
  return Number.isFinite(value) ? value : null;
};

export const normalizeProductConfigSnapshot = ({
  id,
  raw,
  selectedDimensions,
}: NormalizeProductConfigParams): NormalizedProductConfigSnapshot => {
  const dimensionTool = getDimensionTool();
  const dimensionData = dimensionTool?.getDimensionData?.(id) ?? null;
  const toolWidth = readDimValue(dimensionData?.Width as Record<string, string> | undefined);
  const toolHeight = readDimValue(dimensionData?.Height as Record<string, string> | undefined);
  const toolDepth = readDimValue(dimensionData?.Depth as Record<string, string> | undefined);

  return {
    id,
    _productId: id,
    category: typeof raw.category === "string" ? raw.category : null,
    name:
      (typeof raw.ProductType === "string" && raw.ProductType) ||
      (typeof raw.productType === "string" && raw.productType) ||
      (typeof raw.type === "string" && raw.type) ||
      (typeof raw.name === "string" && raw.name) ||
      null,
    ProductType: typeof raw.ProductType === "string" ? raw.ProductType : null,
    productType: typeof raw.productType === "string" ? raw.productType : null,
    type: typeof raw.type === "string" ? raw.type : null,
    entityName: typeof raw.entityName === "string" ? raw.entityName : null,
    Width: (typeof raw.Width === "number" ? raw.Width : null) ?? toolWidth,
    Height: selectedDimensions.height ?? toolHeight ?? (typeof raw.Height === "number" ? raw.Height : null),
    Depth: selectedDimensions.depth ?? toolDepth ?? (typeof raw.Depth === "number" ? raw.Depth : null),
    Thickness: typeof raw.Thickness === "string" ? raw.Thickness : null,
    Drawers: typeof raw.Drawers === "string" ? raw.Drawers : null,
    Handle: typeof raw.Handle === "string" ? raw.Handle : null,
    CabinetColor: typeof raw.CabinetColor === "string" ? raw.CabinetColor : null,
    CountertopColor: typeof raw.CountertopColor === "string" ? raw.CountertopColor : null,
    sinkType: typeof raw.sinkType === "string" ? raw.sinkType : null,
  };
};
