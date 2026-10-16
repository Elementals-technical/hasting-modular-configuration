export type TypeCabinetRuleConfig = {
  code: string;
  /**
   * The series whose cabinet this is, for a variant of the type another series supplies (an Urban
   * Standard Height side cabinet in an Urban Duplex composition). Absent on the collection's own.
   */
  series?: string;
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
  /** drawers value -> heights in cm these drawers come in, to choose from. Absent means the forced height. */
  heightsByDrawers?: Record<string, number[]>;
  /**
   * The scene product that places this type ("ULH-sink-cabinet"), from the collection's runtime
   * bindings. A placed product's runtime id names it, not the cabinet type.
   */
  sceneProductType?: string;
  supportsHeight?: number[];
  unavailableWithIntegrated?: { widthCm: number; drawers: string }[];
  /**
   * Drawer styles of the type that stand at a height of their own beside the taller cabinets
   * (`ruleData.steppedModules`: the Urban Freestanding Short-Cabinet). They force no height of their
   * own (their table heights are left out of `forcedHeightByHandle`): the composition keeps the
   * height of its other cabinets, which a type with stepped styles only takes as its `heights` and
   * forced heights.
   */
  steppedDrawers?: string[];
  /**
   * drawers value of a stepped style -> handleId -> its own height in cm, from the table's forced
   * heights (UF table 590: `UG/1DW:56|PTO/1DW:53|CG/1DW:56` → `{ "1": { UG: 56, PTO: 53, CG: 56 } }`).
   * Read by buildSteppedSceneProducts for the scene bridge; never the composition's height.
   */
  steppedHeightByHandle?: Record<string, Record<string, number>>;
};

export type ConfiguratorCatalog = {
  typeCabinetRules: TypeCabinetRuleConfig[];
};

/** The cabinet attribute that names the series a cabinet is of, where a collection mixes series. */
export const SERIES_ATTRIBUTE_ID = "Series";

/** The series a cabinet config names, if any. */
export const seriesOfConfig = (config: Readonly<Record<string, unknown>> | null | undefined): string | null => {
  const series = config?.[SERIES_ATTRIBUTE_ID];
  return typeof series === "string" && series !== "" ? series : null;
};

/**
 * The rule of a cabinet type for a cabinet of `series`: the variant that series supplies, else
 * the collection's own rule of the type. A lookup by `code` alone finds the collection's own,
 * which comes first, so code that knows no series keeps reading what it read.
 */
export const findCabinetRule = (
  catalog: ConfiguratorCatalog,
  code: string | null | undefined,
  series?: string | null,
): TypeCabinetRuleConfig | null => {
  if (!code) return null;

  const ofType = catalog.typeCabinetRules.filter((rule) => rule.code === code);
  const variant = series ? ofType.find((rule) => rule.series === series) : undefined;
  return variant ?? ofType.find((rule) => !rule.series) ?? ofType[0] ?? null;
};

/** The variants other series supply of a cabinet type, in catalog order. */
export const findSeriesVariants = (catalog: ConfiguratorCatalog, code: string | null | undefined) =>
  code ? catalog.typeCabinetRules.filter((rule) => rule.code === code && rule.series !== undefined) : [];

/** Whether `drawers` is a style of the rule that stands at a height of its own (a short cabinet). */
export const isSteppedDrawers = (
  rule: Pick<TypeCabinetRuleConfig, "steppedDrawers"> | null | undefined,
  drawers: string | null | undefined,
): boolean => Boolean(drawers && rule?.steppedDrawers?.includes(drawers));

/** The type's first drawer style that is not stepped: the one the composition's height follows. */
export const firstOwnDrawers = (rule: TypeCabinetRuleConfig | null | undefined): string | null =>
  rule?.drawers.find((drawers) => !isSteppedDrawers(rule, drawers)) ?? null;

const typeCabinetRules: TypeCabinetRuleConfig[] = [];

export const typeCabinetCatalog: ConfiguratorCatalog = {
  typeCabinetRules,
};
