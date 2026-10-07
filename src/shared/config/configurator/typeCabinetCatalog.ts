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
  /** drawers value -> forced height in cm whatever the handle; a handle's own entry wins. */
  forcedHeightByDrawers?: Record<string, number>;
  /** handleId -> drawers values that allow this handle. Absent/empty means no restriction. */
  requiresDrawersByHandle?: Record<string, string[]>;
  /** handleId -> heights in cm the handle allows. Absent means any height of the type. */
  heightsByHandle?: Record<string, number[]>;
  /**
   * The scene product that places this type ("ULH-sink-cabinet"), from the collection's runtime
   * bindings. A placed product's runtime id names it, not the cabinet type.
   */
  sceneProductType?: string;
  supportsHeight?: number[];
  unavailableWithIntegrated?: { widthCm: number; drawers: string }[];
};

export type ConfiguratorCatalog = {
  typeCabinetRules: TypeCabinetRuleConfig[];
};

const typeCabinetRules: TypeCabinetRuleConfig[] = [];

export const typeCabinetCatalog: ConfiguratorCatalog = {
  typeCabinetRules,
};
