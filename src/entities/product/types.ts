export type PresetProduct = {
  name: string;
  Width?: number;
  Height?: number;
  Depth?: number;
  CabinetColor?: string;
};

export type ProductModel = {
  id: number;
  img: string;
  title: string;
  desc: string;
  isProductModel: boolean;
  price: string;
  presetProducts: PresetProduct[];
};
