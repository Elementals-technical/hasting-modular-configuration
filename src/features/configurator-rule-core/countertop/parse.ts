import type { CountertopDatatable } from "@/entities/countertop/api/types";

import type { CountertopMatrixRule } from "./types";

const MATERIAL_ALIASES: Record<string, string[]> = {
  tekorund: ["tekormud", "sstm"],
  tekormud: ["tekorund", "sstm"],
  glass: ["glassmt", "glassgl"],
  glassmt: ["glass"],
  glassgl: ["glass"],
  // Material SKU aliases used in pricing/config payloads.
  ssocr: ["ocritech"],
  ocritech: ["ssocr"],
  sstkr: ["tekorlux"],
  tekorlux: ["sstkr"],
  sstm: ["tekormud", "tekorund"],
  ssmlm: ["mineralmarmo", "minermalmaro"],
  mineralmarmo: ["ssmlm"],
  minermalmaro: ["ssmlm"],
  fx: ["fenix"],
  fenix: ["fx"],
  por: ["porcelain"],
  porcelain: ["por"],
};

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

export const getMaterialAliases = (material: string): string[] => {
  const normalized = normalizeMaterialToken(material);
  const aliases = MATERIAL_ALIASES[normalized];
  return aliases ? [normalized, ...aliases] : [normalized];
};

export const materialMatchesRule = (optionMaterial: string, ruleMaterial: string): boolean => {
  const aliases = getMaterialAliases(optionMaterial);
  const normalizedRule = normalizeMaterialToken(ruleMaterial);
  return aliases.includes(normalizedRule);
};

export const normalizeBasinToken = (value: string): string => {
  const normalized = value.trim().toLowerCase();
  const cleaned = normalized
    .replace(/^top[_\s-]*/g, "")
    .replace(/[/_\s-]+/g, "")
    .replace(/[0-9]+/g, "")
    .replace(/(hpl|fenix|porcelain|ocritech|tekorlux|tekorund|mineralmarmo|glass)/g, "");

  return cleaned.length > 0 ? cleaned : normalizeToken(value);
};

export const normalizeBasinKey = (value: string): string => {
  const normalized = value.trim().toLowerCase();
  const cleaned = normalized
    .replace(/^top[_\s-]*/g, "")
    .replace(/[/_\s-]+/g, "")
    .replace(/(hpl|fenix|porcelain|ocritech|tekorlux|tekorund|mineralmarmo|glass)/g, "");

  return cleaned.length > 0 ? cleaned : normalizeToken(value);
};

export const parseThicknessValue = (raw: string): number | null => {
  const value = raw.trim();
  if (!value) return null;

  if (value.includes("-")) {
    const [whole, fraction] = value.split("-");
    const wholeNumber = Number.parseFloat(whole);
    if (!Number.isFinite(wholeNumber)) return null;
    const fractional = parseThicknessValue(fraction);
    if (fractional === null) return null;
    return wholeNumber + fractional;
  }

  if (value.includes("/")) {
    const [numerator, denominator] = value.split("/");
    const num = Number.parseFloat(numerator);
    const den = Number.parseFloat(denominator);
    if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
    return num / den;
  }

  const numeric = Number.parseFloat(value);
  const normalizedNumeric = Number.parseFloat(value.replace(",", "."));
  return Number.isFinite(normalizedNumeric) ? normalizedNumeric : Number.isFinite(numeric) ? numeric : null;
};

export const matchesDepth = (rule: CountertopMatrixRule, depth: number | null): boolean => {
  if (!depth) return true;

  if (rule.depthOnlyCm.length > 0) {
    return rule.depthOnlyCm.some((value) => Math.abs(value - depth) < 0.01);
  }

  if (rule.depths.length === 0) return true;
  return rule.depths.some((value) => Math.abs(value - depth) < 0.01);
};

export const parseCountertopMatrix = (datatable?: CountertopDatatable): CountertopMatrixRule[] => {
  if (!datatable?.rows?.length) return [];

  return datatable.rows.map((row) => ({
    material: row.material ?? "",
    topThicknesses: parseStringList(row.top_thicknesses),
    depths: parseNumberList(row.depths_cm),
    basinStyle: row.basin_style ?? "",
    minSbCm: parseNullableNumber(row.min_sb_cm),
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
