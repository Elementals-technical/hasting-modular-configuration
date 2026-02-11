export type PresetProduct = {
  name: string;
  Width?: number;
  Height?: number;
  Depth?: number;
  CabinetColor?: string;
  Drawers?: string;
  Handle?: string;
  sinkType?: string;
  CountertopColor?: string;
  HandleGrooveColor?: string;
};

export type ProductSize = "24_29" | "30_39" | "40_49" | "50_59" | "60_69" | "70_79" | "80_89" | "90_plus";

export type ProductStyle =
  | "1_drawer"
  | "2_drawer"
  | "single_basin"
  | "double_basin"
  | "asymmetrical"
  | "open_shelving";

export type ProductModel = {
  id: number;
  img: string;
  title: string;
  desc?: string;
  isProductModel: boolean;
  price?: string;
  presetProducts: PresetProduct[];
  size: ProductSize;
  style: ProductStyle[];
};
