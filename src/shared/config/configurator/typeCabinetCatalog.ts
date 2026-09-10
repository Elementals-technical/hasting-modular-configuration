export type TypeCabinetRuleConfig = {
  code: string;
  widths: number[];
  depths: number[];
  heights: number[];
  drawers: string[];
  hasSink?: boolean;
  isOpen?: boolean;
  handlesAllowed?: string[];
  /**
   * handleId -> drawers value -> forced height in cm.
   * Replaces the per-handle `handle*ForcedHeightCm` fields, so a new handle is data only.
   */
  forcedHeightByHandle?: Record<string, Record<string, number>>;
  /** handleId -> drawers values that allow this handle. Absent/empty means no restriction. */
  requiresDrawersByHandle?: Record<string, string[]>;
  supportsHeight?: number[];
};

export type ConfiguratorCatalog = {
  typeCabinetRules: TypeCabinetRuleConfig[];
};

const typeCabinetRules: TypeCabinetRuleConfig[] = [];

export const typeCabinetCatalog: ConfiguratorCatalog = {
  typeCabinetRules,
};
