export type TypeCabinetRuleConfig = {
  id: number;
  code: string;
  widths: number[];
  depths: number[];
  heights: number[];
  drawers: string[];
  hasSink?: boolean;
  isOpen?: boolean;
  handlesAllowed?: string[];
  handleUrbanBotcutRequiresDrawers?: string[];
  handlePtoForcedHeightCm?: number | null;
  handleUrbanTopcutForcedHeightCm?: number | null;
  handleUrbanBotcutForcedHeightCm?: number | null;
  supportsHeight?: number[];
};

export type ConfiguratorCatalog = {
  typeCabinetRules: TypeCabinetRuleConfig[];
};

const typeCabinetRules: TypeCabinetRuleConfig[] = [];

export const typeCabinetCatalog: ConfiguratorCatalog = {
  typeCabinetRules,
};
