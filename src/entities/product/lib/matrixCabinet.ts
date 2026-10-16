import { normalizeHandleProfile, normalizeOptionValue, selectOption } from "@/entities/collection";
import type { NormalizedMatrixRow, ProductProfile, RuntimeBindingSet } from "@/entities/collection";
import type { ProductDatatable, ProductDatatableRow } from "@/entities/product/api";
import type { ConfiguratorCatalog, TypeCabinetRuleConfig } from "@/shared/config/configurator/typeCabinetCatalog";

const parseDelimitedList = (value?: unknown): string[] => {
  if (value === null || value === undefined) return [];

  const raw = String(value).trim();
  if (!raw) return [];

  return raw
    .split("|")
    .map((entry) => entry.trim())
    .filter(Boolean);
};
const parseNumberList = (value?: unknown): number[] =>
  parseDelimitedList(value)
    .map((entry) => Number(entry))
    .filter((entry) => Number.isFinite(entry));

const parseBoolean = (value?: unknown): boolean =>
  String(value ?? "")
    .trim()
    .toLowerCase() === "true";

const normalizeKey = (key: string) => key.trim().toLowerCase().replace(/\s+/g, "_");

const normalizeRow = (row: ProductDatatableRow): NormalizedMatrixRow =>
  Object.entries(row).reduce<NormalizedMatrixRow>((acc, [key, value]) => {
    acc[normalizeKey(key)] = value;
    return acc;
  }, {});

/** A drawers value the profile's Drawers catalog knows (by value or alias), else as written. */
const createDrawerNormalizer = (profile: ProductProfile) => (value: string) =>
  normalizeOptionValue(profile, "Drawers", value) ?? value.trim();

/**
 * Builds the cabinet catalog from the legacy matrix rows.
 *
 * Every column, handle-specific ones included, comes from the collection's
 * `ruleData.cabinetMatrixLegacyAdapter`, so this parser never tests a handle id or assumes
 * USH columns: adding a handle means one more entry in the adapter data. The runtime bindings
 * name the scene product of each type, by which the rules recognise a placed cabinet.
 */
export const buildCabinetCatalogFromMatrix = (
  datatable: ProductDatatable,
  profile: ProductProfile,
  bindings?: RuntimeBindingSet,
): ConfiguratorCatalog => {
  const rows = Array.isArray(datatable.rows) ? datatable.rows : [];
  const normalizedRows = rows.map(normalizeRow);

  const adapter = profile.ruleData.cabinetMatrixLegacyAdapter;
  const normalizeDrawers = createDrawerNormalizer(profile);

  const { relations } = normalizeHandleProfile({ rows: normalizedRows, adapter, normalizeDrawers });
  const relationsByType = new Map(relations.map((relation) => [relation.cabinetType, relation]));

  const typeCabinetRules = normalizedRows.flatMap<TypeCabinetRuleConfig>((row) => {
    const rawCode = String(row[adapter.columns.cabinetType] ?? "").trim();
    const code = normalizeOptionValue(profile, "CabinetType", rawCode) ?? rawCode;
    if (!code) return [];

    const supportsHeight = parseNumberList(row.supports_height);
    const relation = relationsByType.get(rawCode) ?? relationsByType.get(code);
    const sceneProductType = bindings?.productTypes[code];

    return [
      {
        code,
        widths: parseNumberList(row.widths_cm),
        depths: parseNumberList(row.depths_cm),
        heights: parseNumberList(row.heights_cm),
        drawers: parseDelimitedList(row[adapter.columns.drawers]).map(normalizeDrawers),
        hasSink: parseBoolean(row.has_sink),
        isOpen: parseBoolean(row.is_open),
        handlesAllowed: parseDelimitedList(row[adapter.columns.handlesAllowed]),
        forcedHeightByHandle: relation?.forcedHeightByHandle ?? {},
        forcedHeightByDrawers: relation?.forcedHeightByDrawers ?? {},
        requiresDrawersByHandle: relation?.requiresDrawersByHandle ?? {},
        heightsByHandle: relation?.heightsByHandle ?? {},
        heightsByDrawers: relation?.heightsByDrawers ?? {},
        supportsHeight: supportsHeight.length ? supportsHeight : undefined,
        ...(adapter.columns.unavailableWithIntegrated
          ? {
              unavailableWithIntegrated: parseDelimitedList(row[adapter.columns.unavailableWithIntegrated]).map(
                (pair) => {
                  const [width, drawers, extra] = pair.split(":");
                  const canonical = normalizeOptionValue(profile, "Drawers", drawers ?? "");
                  if (!Number.isFinite(Number(width)) || Number(width) <= 0 || !canonical || extra !== undefined)
                    throw new Error(`Invalid integrated-basin restriction: ${pair}`);
                  return { widthCm: Number(width), drawers: canonical };
                },
              ),
            }
          : {}),
        ...(sceneProductType ? { sceneProductType } : {}),
      },
    ];
  });

  const ownRules = withSteppedModules(typeCabinetRules, profile, normalizeDrawers);

  return {
    typeCabinetRules: [...ownRules, ...buildSeriesVariants(ownRules, profile, normalizeDrawers)],
  };
};

/**
 * The drawer styles that stand at a height of their own (`ruleData.steppedModules`): the Urban
 * Freestanding Floor-Mount Short Cabinet, the `Short-Cabinet` type of table 590 (1DW only).
 *
 * Table 590 gives the short cabinet its own forced heights (`UG/1DW:56|PTO/1DW:53|CG/1DW:56`), but a
 * forced height is the one height of the whole composition: choosing the short cabinet or a handle
 * would bring every cabinet down to it. So the stepped styles' heights move out of the rule's forced
 * heights into `steppedHeightByHandle`, from which the scene bridge places the short cabinet
 * (buildSteppedSceneProducts). The widths, depths and handles are the type's.
 *
 * A type whose every style is stepped has no composition height of its own: it takes the heights,
 * and the forced height of each handle, of the first type of the category it stands beside
 * (`requiresPlacedCategory`), so choosing it keeps the tall cabinets at their height.
 */
const withSteppedModules = (
  rules: readonly TypeCabinetRuleConfig[],
  profile: ProductProfile,
  normalizeDrawers: (value: string) => string,
): TypeCabinetRuleConfig[] => {
  const modules = profile.ruleData.steppedModules ?? [];
  // The stepped styles of a type, as the Drawers catalog names them ("1DW" → "1").
  const steppedOf = (code: string) =>
    modules.filter(({ cabinetType }) => cabinetType === code).map(({ drawers }) => normalizeDrawers(drawers));
  const isSteppedOnly = (rule: TypeCabinetRuleConfig) =>
    rule.drawers.length > 0 && rule.drawers.every((drawers) => steppedOf(rule.code).includes(drawers));

  return rules.map((rule) => {
    const stepped = steppedOf(rule.code);
    if (stepped.length === 0) return rule;

    // 1. Split the forced heights: the composition's stay, the stepped styles' become their own.
    const forcedHeightByHandle: Record<string, Record<string, number>> = {};
    const steppedHeightByHandle: Record<string, Record<string, number>> = {};
    for (const [handle, heightByDrawers] of Object.entries(rule.forcedHeightByHandle ?? {})) {
      for (const [drawers, heightCm] of Object.entries(heightByDrawers)) {
        if (stepped.includes(drawers)) (steppedHeightByHandle[drawers] ??= {})[handle] = heightCm;
        else (forcedHeightByHandle[handle] ??= {})[drawers] = heightCm;
      }
    }
    const forcedHeightByDrawers = Object.fromEntries(
      Object.entries(rule.forcedHeightByDrawers ?? {}).filter(([drawers]) => !stepped.includes(drawers)),
    );
    const steppedRule = {
      ...rule,
      forcedHeightByHandle,
      forcedHeightByDrawers,
      steppedDrawers: stepped,
      steppedHeightByHandle,
    };
    if (!isSteppedOnly(rule)) return steppedRule;

    // 2. A stepped-only type takes the composition's heights from the first tall type it stands beside.
    const category = modules.find(({ cabinetType }) => cabinetType === rule.code)?.requiresPlacedCategory;
    const tall = rules.find(
      (candidate) =>
        !isSteppedOnly(candidate) && selectOption(profile, "CabinetType", candidate.code)?.category === category,
    );
    const tallDrawers = tall?.drawers.find((drawers) => !steppedOf(tall.code).includes(drawers));
    if (!tall || !tallDrawers) return steppedRule;

    const compositionHeightByHandle: Record<string, Record<string, number>> = {};
    for (const [handle, heightByDrawers] of Object.entries(tall.forcedHeightByHandle ?? {})) {
      const heightCm = heightByDrawers[tallDrawers];
      if (heightCm === undefined) continue;
      for (const drawers of stepped) (compositionHeightByHandle[handle] ??= {})[drawers] = heightCm;
    }

    return {
      ...steppedRule,
      heights: tall.heights,
      supportsHeight: tall.supportsHeight,
      forcedHeightByHandle: compositionHeightByHandle,
    };
  });
};

/**
 * The cabinets other series supply (`ruleData.seriesModules`), each as a variant of the cabinet
 * type it stands in for: its own widths, drawer styles and heights; the depths, the handle and
 * the scene product of the collection's type. Listed after the collection's own rules, so a
 * lookup by type alone still finds those.
 */
const buildSeriesVariants = (
  ownRules: readonly TypeCabinetRuleConfig[],
  profile: ProductProfile,
  normalizeDrawers: (value: string) => string,
): TypeCabinetRuleConfig[] =>
  (profile.ruleData.seriesModules ?? []).flatMap((module) => {
    const own = ownRules.find(({ code }) => code === module.cabinetType);
    if (!own) return [];

    const styles = Object.entries(module.heightsByDrawers).map(
      ([drawers, heights]) => [normalizeDrawers(drawers), heights] as const,
    );
    // In the order of the collection's own styles and heights, whatever order the module names them in.
    const orderOf = (drawers: string) =>
      own.drawers.includes(drawers) ? own.drawers.indexOf(drawers) : own.drawers.length;
    const heightsByStyle = [...styles].sort(([a], [b]) => orderOf(a) - orderOf(b));
    const heights = [...new Set(heightsByStyle.flatMap(([, styleHeights]) => styleHeights))].sort((a, b) => b - a);

    return [
      {
        ...own,
        series: module.series,
        widths: module.widthsCm,
        heights,
        supportsHeight: heights,
        drawers: heightsByStyle.map(([drawers]) => drawers),
        // One height is forced with the style; several are left to choose from.
        forcedHeightByDrawers: Object.fromEntries(
          heightsByStyle.flatMap(([drawers, styleHeights]) =>
            styleHeights.length === 1 ? [[drawers, styleHeights[0]]] : [],
          ),
        ),
        heightsByDrawers: Object.fromEntries(heightsByStyle.filter(([, styleHeights]) => styleHeights.length > 1)),
        forcedHeightByHandle: {},
        requiresDrawersByHandle: {},
        heightsByHandle: {},
      },
    ];
  });

/** Uses approved local module facts without inventing a remote datatable identity. */
export const buildCabinetCatalogFromProfile = (
  profile: ProductProfile,
  bindings?: RuntimeBindingSet,
): ConfiguratorCatalog => ({
  typeCabinetRules: (profile.ruleData.cabinetModules ?? []).map((module) => ({
    code: module.cabinetType,
    widths: module.widthsCm,
    heights: module.heightsCm,
    depths: module.depthsCm,
    drawers: module.drawerValues,
    hasSink: module.hasSink,
    isOpen: false,
    handlesAllowed: [],
    forcedHeightByHandle: {},
    forcedHeightByDrawers: {},
    requiresDrawersByHandle: {},
    heightsByHandle: {},
    heightsByDrawers: {},
    ...(bindings?.productTypes[module.cabinetType]
      ? { sceneProductType: bindings.productTypes[module.cabinetType] }
      : {}),
  })),
});
