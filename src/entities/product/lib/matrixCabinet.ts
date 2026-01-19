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

const normalizeDrawerConfig = (value: string): string => {
  const normalized = value.trim();

  if (normalized === "1D") return "1";
  if (normalized === "2D") return "2";
  if (normalized === "1DWID") return "1+inner";

  return normalized;
};

const normalizeKey = (key: string) => key.trim().toLowerCase().replace(/\s+/g, "_");

const normalizeRow = (row: ProductDatatableRow): Record<string, string> =>
  Object.entries(row).reduce<Record<string, string>>((acc, [key, value]) => {
    acc[normalizeKey(key)] = value;
    return acc;
  }, {});

const toRule = (row: ProductDatatableRow): TypeCabinetRuleConfig | null => {
  const normalizedRow = normalizeRow(row);
  const code = String(normalizedRow.cabinet_type ?? "").trim();
  if (!code) return null;

  const drawers = parseDelimitedList(normalizedRow.drawer_configs).map(normalizeDrawerConfig);
  const handlesAllowed = parseDelimitedList(normalizedRow.handles_allowed);
  const supportsHeight = parseNumberList(normalizedRow.supports_height);

  const rule: TypeCabinetRuleConfig = {
    code,
    widths: parseNumberList(normalizedRow.widths_cm),
    depths: parseNumberList(normalizedRow.depths_cm),
    heights: parseNumberList(normalizedRow.heights_cm),
    drawers,
    hasSink: parseBoolean(normalizedRow.has_sink),
    isOpen: parseBoolean(normalizedRow.is_open),
    handlesAllowed,
    handleUrbanBotcutRequiresDrawers: parseDelimitedList(normalizedRow.handle_urban_botcut_requires_drawers).map(
      normalizeDrawerConfig,
    ),
    handlePtoForcedHeightCm: Number(normalizedRow.handle_pto_forced_height_cm || "") || null,
    handleUrbanTopcutForcedHeightCm: Number(normalizedRow.handle_urban_topcut_forced_height_cm || "") || null,
    handleUrbanBotcutForcedHeightCm: Number(normalizedRow.handle_urban_botcut_forced_height_cm || "") || null,
    supportsHeight: supportsHeight.length ? supportsHeight : undefined,
  };

  return rule;
};

export const buildCabinetCatalogFromMatrix = (datatable: ProductDatatable): ConfiguratorCatalog => {
  const rows = Array.isArray(datatable.rows) ? datatable.rows : [];
  const rules = rows.map((row) => toRule(row)).filter((rule): rule is TypeCabinetRuleConfig => Boolean(rule));

  return { typeCabinetRules: rules };
};
