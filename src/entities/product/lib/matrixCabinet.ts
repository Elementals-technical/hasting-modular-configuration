import { normalizeHandleProfile, normalizeOptionValue } from "@/entities/collection";
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

  return { typeCabinetRules };
};

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
    ...(bindings?.productTypes[module.cabinetType]
      ? { sceneProductType: bindings.productTypes[module.cabinetType] }
      : {}),
  })),
});
