export type TypeCabinetRuleConfig = {
  code: string;
  widths: number[];
  depths: number[];
  heights: number[];
  drawers: string[];
  hasSink?: boolean;
  isOpen?: boolean;
  handlesAllowed?: string[];
  handleUrbanBotcutRequiresDrawers?: string[];
  handlePtoForcedHeightCm?: string | null;
  handleUrbanTopcutForcedHeightCm?: string | null;
  handleUrbanBotcutForcedHeightCm?: string | null;
  supportsHeight?: number[];
};

export type ConfiguratorCatalog = {
  typeCabinetRules: TypeCabinetRuleConfig[];
};

const typeCabinetRules: TypeCabinetRuleConfig[] = [];

export const typeCabinetCatalog: ConfiguratorCatalog = {
  typeCabinetRules,
};
