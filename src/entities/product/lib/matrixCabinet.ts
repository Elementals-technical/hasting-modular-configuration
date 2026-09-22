import { normalizeHandleProfile, normalizeOptionValue } from "@/entities/collection";
import type { CabinetMatrixLegacyAdapter, NormalizedMatrixRow, ProductProfile } from "@/entities/collection";
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

/** Legacy drawer spellings, used only until a profile with the Drawers catalog is available. */
const LEGACY_DRAWER_ALIASES: Record<string, string> = {
  "1D": "1",
  "2D": "2",
  "1DWID": "1+inner",
};

const normalizeKey = (key: string) => key.trim().toLowerCase().replace(/\s+/g, "_");

const normalizeRow = (row: ProductDatatableRow): NormalizedMatrixRow =>
  Object.entries(row).reduce<NormalizedMatrixRow>((acc, [key, value]) => {
    acc[normalizeKey(key)] = value;
    return acc;
  }, {});

const createDrawerNormalizer = (profile: ProductProfile | null) => (value: string) => {
  const fromProfile = normalizeOptionValue(profile, "Drawers", value);
  if (fromProfile) return fromProfile;

  const trimmed = value.trim();
  return LEGACY_DRAWER_ALIASES[trimmed] ?? trimmed;
};

/**
 * Fallback column mapping for the window where no profile is loaded yet.
 * The authoritative mapping is `profile.ruleData.cabinetMatrixLegacyAdapter`.
 */
const FALLBACK_ADAPTER: Pick<CabinetMatrixLegacyAdapter, "columns"> = {
  columns: {
    cabinetType: "cabinet_type",
    drawers: "drawer_configs",
    handlesAllowed: "handles_allowed",
    supportsHeight: "supports_height",
    forcedHeightByHandle: {
      handle_pto: "handle_pto_forced_height_cm",
      handle_urban_topcut: "handle_urban_topcut_forced_height_cm",
      handle_urban_botcut: "handle_urban_botcut_forced_height_cm",
    },
    requiresDrawersByHandle: {
      handle_urban_botcut: "handle_urban_botcut_requires_drawers",
    },
  },
};

/**
 * Builds the cabinet catalog from the legacy matrix rows.
 *
 * Handle-specific columns are resolved through the profile adapter, so this parser
 * never tests a handle id: adding a handle means one more entry in the adapter data.
 */
export const buildCabinetCatalogFromMatrix = (
  datatable: ProductDatatable,
  profile: ProductProfile | null = null,
): ConfiguratorCatalog => {
  const rows = Array.isArray(datatable.rows) ? datatable.rows : [];
  const normalizedRows = rows.map(normalizeRow);

  const adapter = profile?.ruleData.cabinetMatrixLegacyAdapter ?? FALLBACK_ADAPTER;
  const normalizeDrawers = createDrawerNormalizer(profile);

  const { relations } = normalizeHandleProfile({ rows: normalizedRows, adapter, normalizeDrawers });
  const relationsByType = new Map(relations.map((relation) => [relation.cabinetType, relation]));

  const typeCabinetRules = normalizedRows.flatMap<TypeCabinetRuleConfig>((row) => {
    const code = String(row[adapter.columns.cabinetType] ?? "").trim();
    if (!code) return [];

    const supportsHeight = parseNumberList(row.supports_height);
    const relation = relationsByType.get(code);

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
        supportsHeight: supportsHeight.length ? supportsHeight : undefined,
      },
    ];
  });

  return { typeCabinetRules };
};
