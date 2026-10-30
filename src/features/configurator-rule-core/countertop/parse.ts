import { selectRuleData, type ProductProfile } from "@/entities/collection";
import type { CountertopDatatable } from "@/entities/countertop/api/types";

import type { CountertopMatrixRule } from "./types";

/**
 * Legacy material aliases of USH, equal to `ruleData.materialNormalization.aliases` of its profile.
 * Rules that have the profile pass the collection's table; this one serves the callers that do not
 * pass a profile yet (pages, pricing) and a collection that declares no table. A test keeps the two
 * equal until those callers move to the profile (DEV-06).
 */
export const LEGACY_MATERIAL_ALIASES: Readonly<Record<string, readonly string[]>> = {
  tekorund: ["tekormud", "sstm"],
  tekormud: ["tekorund", "sstm"],
  glass: ["glassmt", "glassgl"],
  glassmt: ["glass", "glassgl"],
  glassgl: ["glass", "glassmt"],
  // Material SKU aliases used in pricing/config payloads.
  ssocr: ["ocritech", "solidsurface", "sst1c", "sst1d"],
  ocritech: ["ssocr", "solidsurface", "sst1c", "sst1d"],
  solidsurface: ["ocritech", "ssocr", "sst1c", "sst1d"],
  sst1c: ["ocritech", "ssocr", "solidsurface", "sst1d"],
  sst1d: ["ocritech", "ssocr", "solidsurface", "sst1c"],
  sstkr: ["tekorlux", "tal", "tam"],
  tekorlux: ["sstkr", "tal", "tam"],
  tal: ["tekorlux", "sstkr", "tam"],
  tam: ["tekorlux", "sstkr", "tal"],
  sstm: ["tekormud", "tekorund"],
  ssmmo: ["mineralmarmo", "minermalmaro"],
  mineralmarmo: ["ssmmo"],
  minermalmaro: ["ssmmo"],
  fx: ["fenix"],
  fenix: ["fx"],
  por: ["porcelain"],
  porcelain: ["por"],
  sssyn: ["syntesi"],
  syntesi: ["sssyn"],
};

const BASIN_PREFIX_MARKERS = Array.from(
  new Set([
    "hplfenix",
    "hpl",
    ...Object.keys(LEGACY_MATERIAL_ALIASES).filter((token) => token.length >= 5),
  ]),
).sort((left, right) => right.length - left.length);
const BASIN_SUFFIX_MARKERS = ["gres"];
const BASIN_MATERIAL_SCOPE_MARKERS = Array.from(
  new Set([
    "hplfenix",
    "hpl",
    ...Object.keys(LEGACY_MATERIAL_ALIASES),
    ...Object.values(LEGACY_MATERIAL_ALIASES).flat(),
  ]),
).sort((left, right) => right.length - left.length);

const normalizeToken = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const parseStringList = (raw?: string): string[] =>
  raw
    ?.split("|")
    .map((value) => value.trim())
    .filter(Boolean) ?? [];

const parseLocaleNumber = (raw: string): number => {
  const normalized = raw.replace(",", ".");
  return Number.parseFloat(normalized);
};

const parseNumberList = (raw?: string): number[] =>
  parseStringList(raw)
    .map((value) => parseLocaleNumber(value))
    .filter((value) => Number.isFinite(value));

const STYLE_DEPTH_COLUMN_PREFIX = "depths_cm_";

const parseDepthsByStyle = (row: Record<string, string>): Record<string, number[]> =>
  Object.entries(row).reduce<Record<string, number[]>>((acc, [key, value]) => {
    if (!key.startsWith(STYLE_DEPTH_COLUMN_PREFIX)) return acc;

    const style = normalizeToken(key.slice(STYLE_DEPTH_COLUMN_PREFIX.length));
    const depths = parseNumberList(value);
    if (style && depths.length > 0) {
      acc[style] = depths;
    }

    return acc;
  }, {});

const parseBoolean = (raw?: string): boolean | null => {
  if (!raw) return null;
  const normalized = raw.trim().toUpperCase();
  if (normalized === "TRUE") return true;
  if (normalized === "FALSE") return false;
  return null;
};

const parseNullableNumber = (raw?: string): number | null => {
  if (!raw) return null;
  const value = parseLocaleNumber(raw);
  return Number.isFinite(value) ? value : null;
};

export const normalizeMaterialToken = (value: string): string => normalizeToken(value);
export const normalizeFaucetHoleToken = (value: string): string => {
  const normalized = normalizeToken(value);
  const digitsOnly = normalized.replace(/[^0-9]+/g, "");
  return digitsOnly.length > 0 ? digitsOnly : normalized;
};

export type MaterialAliasTable = Readonly<Record<string, readonly string[]>>;

export const getMaterialAliases = (
  material: string,
  aliasTable: MaterialAliasTable = LEGACY_MATERIAL_ALIASES,
): string[] => {
  const normalized = normalizeMaterialToken(material);
  const aliases = aliasTable[normalized];
  return aliases ? [normalized, ...aliases] : [normalized];
};

/** The collection's material alias table, or the legacy one while the collection declares none. */
export const selectMaterialAliasTable = (profile: ProductProfile | null): MaterialAliasTable =>
  selectRuleData(profile, "materialNormalization")?.aliases ?? LEGACY_MATERIAL_ALIASES;

/** USH's countertop materials that take a vessel sink, while a collection declares none of its own. */
export const LEGACY_VESSEL_COMPATIBLE_COUNTERTOP_MATERIAL_TOKENS: readonly string[] = [
  "hpl",
  "porcelain",
  "tekorlux",
  "tal",
  "tam",
  "solidsurface",
];

/**
 * Whether a countertop colour of these materials takes a vessel sink. The materials and their
 * aliases come from `ruleData.materialNormalization` of the active collection.
 */
export const isVesselCompatibleCountertopMaterial = (
  materials: readonly string[],
  profile: ProductProfile | null,
): boolean => {
  const normalization = selectRuleData(profile, "materialNormalization");
  const allowed = new Set(
    normalization?.vesselCompatibleCountertopMaterialTokens ?? LEGACY_VESSEL_COMPATIBLE_COUNTERTOP_MATERIAL_TOKENS,
  );
  const aliasTable = selectMaterialAliasTable(profile);
  return materials.some((material) => getMaterialAliases(material, aliasTable).some((alias) => allowed.has(alias)));
};

export const materialMatchesRule = (
  optionMaterial: string,
  ruleMaterial: string,
  aliasTable: MaterialAliasTable = LEGACY_MATERIAL_ALIASES,
): boolean => {
  const aliases = getMaterialAliases(optionMaterial, aliasTable);
  const normalizedRule = normalizeMaterialToken(ruleMaterial);
  return aliases.includes(normalizedRule);
};

const stripKnownBasinMarkers = (value: string, stripDigits: boolean): string => {
  const normalized = value.trim().toLowerCase();
  const withoutTopPrefix = normalized.replace(/^top[_\s-]*/g, "");
  const compact = withoutTopPrefix.replace(/[/_\s-]+/g, "");
  const compactWithoutDigits = stripDigits ? compact.replace(/[0-9]+/g, "") : compact;

  const withoutPrefix = BASIN_PREFIX_MARKERS.reduce((result, marker) => {
    return result.startsWith(marker) && result.length > marker.length ? result.slice(marker.length) : result;
  }, compactWithoutDigits);

  const withoutSuffix = BASIN_SUFFIX_MARKERS.reduce((result, marker) => {
    return result.endsWith(marker) ? result.slice(0, -marker.length) : result;
  }, withoutPrefix);

  return withoutSuffix.length > 0 ? withoutSuffix : normalizeToken(value);
};

export const normalizeBasinToken = (value: string): string => {
  return stripKnownBasinMarkers(value, true);
};

export const normalizeBasinKey = (value: string): string => {
  return stripKnownBasinMarkers(value, false);
};

export const extractCountertopBasinMaterialTokens = (...values: Array<string | null | undefined>): string[] => {
  const tokens = new Set<string>();

  values.forEach((value) => {
    value
      ?.split(/[/_\s-]+/g)
      .map((token) => normalizeMaterialToken(token))
      .filter(Boolean)
      .forEach((token) => tokens.add(token));
  });

  return Array.from(tokens);
};

const findLeadingBasinMaterialScope = (value?: string | null): string | null => {
  const normalized = value?.trim() ?? "";
  if (!normalized) return null;

  const withoutTopPrefix = normalized.replace(/^top[_\s-]*/i, "");
  const compact = withoutTopPrefix.replace(/[/_\s-]+/g, "");
  const compactWithoutDigits = compact.replace(/[0-9]+/g, "");
  const normalizedCompact = normalizeMaterialToken(compactWithoutDigits);

  if (!normalizedCompact) return null;

  const leadingScope = BASIN_MATERIAL_SCOPE_MARKERS.find((marker) => normalizedCompact.startsWith(marker)) ?? null;
  if (!leadingScope) return null;

  const remainingScope = normalizedCompact.slice(leadingScope.length);
  return BASIN_MATERIAL_SCOPE_MARKERS.find((marker) => remainingScope.includes(marker)) ?? leadingScope;
};

/**
 * Returns the material scope of a basin option.
 *
 * This intentionally differs from extractCountertopBasinMaterialTokens(): basin
 * style names can contain technical path tokens such as "Top_HPL/Fenix_*" or
 * family-qualified names such as "Tekorlux Syntesi". Those tokens are useful
 * for normalizing style keys, but material filtering needs the most specific
 * material token after the leading family token when one exists.
 */
export const extractCountertopBasinMaterialScopeTokens = (
  label?: string | null,
  name?: string | null,
  aliasTable: MaterialAliasTable = LEGACY_MATERIAL_ALIASES,
): string[] => {
  const scope = findLeadingBasinMaterialScope(label) ?? findLeadingBasinMaterialScope(name);
  if (!scope) return [];

  return getMaterialAliases(scope, aliasTable);
};

export const scopeCountertopRulesByBasinStyle = (
  rules: CountertopMatrixRule[],
  activeBasinStyle?: string | null,
): CountertopMatrixRule[] => {
  if (!activeBasinStyle) return rules;

  const activeBasinKey = normalizeBasinKey(activeBasinStyle);
  if (activeBasinKey) {
    const keyMatched = rules.filter((rule) => normalizeBasinKey(rule.basinStyle) === activeBasinKey);
    if (keyMatched.length > 0) return keyMatched;
  }

  const activeBasinToken = normalizeBasinToken(activeBasinStyle);
  if (!activeBasinToken) return rules;

  const tokenMatched = rules.filter((rule) => normalizeBasinToken(rule.basinStyle) === activeBasinToken);
  return tokenMatched.length > 0 ? tokenMatched : rules;
};

export const parseThicknessValue = (raw: string): number | null => {
  const normalizeThicknessValue = (value: number): number => {
    if (Math.abs(value - 2.375) < 0.001) return 2.4;
    if (Math.abs(value - 2.5) < 0.001) return 2.4;
    return value;
  };

  const value = raw.trim();
  if (!value) return null;

  if (value.includes("-")) {
    const [whole, fraction] = value.split("-");
    const wholeNumber = Number.parseFloat(whole);
    if (!Number.isFinite(wholeNumber)) return null;
    const fractional = parseThicknessValue(fraction);
    if (fractional === null) return null;
    return normalizeThicknessValue(wholeNumber + fractional);
  }

  if (value.includes("/")) {
    const [numerator, denominator] = value.split("/");
    const num = Number.parseFloat(numerator);
    const den = Number.parseFloat(denominator);
    if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
    return normalizeThicknessValue(num / den);
  }

  const numeric = Number.parseFloat(value);
  const normalizedNumeric = Number.parseFloat(value.replace(",", "."));
  if (Number.isFinite(normalizedNumeric)) return normalizeThicknessValue(normalizedNumeric);
  if (Number.isFinite(numeric)) return normalizeThicknessValue(numeric);
  return null;
};

export const matchesDepth = (rule: CountertopMatrixRule, depth: number | null): boolean => {
  if (!depth) return true;

  if (rule.depthOnlyCm.length > 0) {
    return rule.depthOnlyCm.some((value) => Math.abs(value - depth) < 0.01);
  }

  if (rule.depths.length === 0) return true;
  return rule.depths.some((value) => Math.abs(value - depth) < 0.01);
};

const normalizeCountertopDepthStyle = (style?: string | null): string => (style ? normalizeToken(style) : "");

export const getCountertopRuleDepthsForStyle = (rule: CountertopMatrixRule, style?: string | null): number[] => {
  if (rule.depthOnlyCm.length > 0) return rule.depthOnlyCm;
  const styleDepths = rule.depthsByStyle[normalizeCountertopDepthStyle(style)];
  if (styleDepths?.length > 0) {
    return styleDepths;
  }
  return rule.depths;
};

export const matchesDepthForStyle = (
  rule: CountertopMatrixRule,
  depth: number | null,
  style?: string | null,
): boolean => {
  if (!depth) return true;

  const depths = getCountertopRuleDepthsForStyle(rule, style);
  if (depths.length === 0) return true;
  return depths.some((value) => Math.abs(value - depth) < 0.01);
};

export const parseCountertopMatrix = (datatable?: CountertopDatatable): CountertopMatrixRule[] => {
  if (!datatable?.rows?.length) return [];

  return datatable.rows.map((row) => ({
    material: row.material ?? "",
    topThicknesses: parseStringList(row.top_thicknesses),
    depths: parseNumberList(row.depths_cm),
    depthsByStyle: parseDepthsByStyle(row),
    basinStyle: row.basin_style ?? "",
    minSbCm: parseNullableNumber(row.min_sb_cm),
    minVesselCm: parseNullableNumber(row.min_vsl_cm),
    maxIntegratedCm: parseNullableNumber(row.max_integrated_cm),
    maxVesselCm: parseNullableNumber(row.max_vessel_cm),
    maxUndermountCm: parseNullableNumber(row.max_undermount_cm),
    faucetHoles: parseStringList(row.faucet_holes),
    depthOnlyCm: parseNumberList(row.depth_only_cm),
    allowedFinishes: parseStringList(row.allowed_finishes),
    allowMultiCabinet: parseBoolean(row.allow_multi_cabinet),
    sidePanelsAction: row.side_panels_action?.trim() || null,
    integratedAllowedSizesOnly: parseNumberList(row.integrated_allowed_sizes_only),
  }));
};
