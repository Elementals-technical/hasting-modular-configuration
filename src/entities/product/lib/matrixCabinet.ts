import type { ProductDatatable, ProductDatatableRow } from "@/entities/product/api";
import type { ConfiguratorCatalog, TypeCabinetRuleConfig } from "@/shared/config/configurator/typeCabinetCatalog";

const KNOWN_TYPE_IDS: Record<string, number> = {
  "Sink-Base": 101,
  "Sink-Cabinet": 102,
  "Open-Shelf": 103,
  // "Side-Cabinet": 104,
  "Side-Shelf": 104,
};

const parseDelimitedList = (value?: unknown): string[] => {
  if (value === null || value === undefined) return [];

  const raw = String(value).trim();
  if (!raw) return [];

  return raw
    .split("|")
    .map((entry) => entry.trim())
    .filter(Boolean);
};
// parseNumberList берет строку вида "50|53|56" (или любое значение), разбивает по |, приводит к Number, и возвращает массив чисел, отбрасывая всё, что не число.
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

const resolveStableId = (cabinetType: string, usedIds: Set<number>): number => {
  const knownId = KNOWN_TYPE_IDS[cabinetType];
  if (knownId && !usedIds.has(knownId)) return knownId;

  let hash = 0;
  for (let i = 0; i < cabinetType.length; i += 1) {
    hash = (hash * 31 + cabinetType.charCodeAt(i)) | 0;
  }

  let id = 1000 + Math.abs(hash % 9000);
  while (usedIds.has(id)) {
    id += 1;
  }

  return id;
};

const normalizeKey = (key: string) => key.trim().toLowerCase().replace(/\s+/g, "_");

const normalizeRow = (row: ProductDatatableRow): Record<string, string> =>
  Object.entries(row).reduce<Record<string, string>>((acc, [key, value]) => {
    acc[normalizeKey(key)] = value;
    return acc;
  }, {});

const toRule = (row: ProductDatatableRow, usedIds: Set<number>): TypeCabinetRuleConfig | null => {
  const normalizedRow = normalizeRow(row);
  const code = String(normalizedRow.cabinet_type ?? "").trim();
  if (!code) return null;

  const drawers = parseDelimitedList(normalizedRow.drawer_configs).map(normalizeDrawerConfig);
  const handlesAllowed = parseDelimitedList(normalizedRow.handles_allowed);
  const supportsHeight = parseNumberList(normalizedRow.supports_height);

  const rule: TypeCabinetRuleConfig = {
    id: resolveStableId(code, usedIds),
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

  usedIds.add(rule.id);
  return rule;
};

export const buildCabinetCatalogFromMatrix = (datatable: ProductDatatable): ConfiguratorCatalog => {
  const usedIds = new Set<number>();
  const rows = Array.isArray(datatable.rows) ? datatable.rows : [];
  const rules = rows.map((row) => toRule(row, usedIds)).filter((rule): rule is TypeCabinetRuleConfig => Boolean(rule));

  return { typeCabinetRules: rules };
};
