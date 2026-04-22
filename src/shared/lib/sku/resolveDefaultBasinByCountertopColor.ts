import { extractColorCode } from "./extractColorCode";

const TEKORLUX_DEFAULT_BASIN = "Top_Tekorlux_Rectangular";

const COLOR_CODE_TO_BASIN: Record<string, string> = {
  FF: TEKORLUX_DEFAULT_BASIN,
};

const MATERIAL_TOKEN_TO_DEFAULT_BASIN: Record<string, string> = {
  sstkr: TEKORLUX_DEFAULT_BASIN,
  tal: TEKORLUX_DEFAULT_BASIN,
  tam: TEKORLUX_DEFAULT_BASIN,
  tekorlux: TEKORLUX_DEFAULT_BASIN,
};

export const resolveDefaultBasinByCountertopColor = (countertopColor?: string | null): string | null => {
  if (!countertopColor) return null;
  const colorCode = extractColorCode(countertopColor)?.toUpperCase() ?? "";
  if (!colorCode) return null;
  return COLOR_CODE_TO_BASIN[colorCode] ?? null;
};

const normalizeMaterialToken = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

export const resolveDefaultBasinForCountertopSelection = ({
  countertopColor,
  materialTokens,
}: {
  countertopColor?: string | null;
  materialTokens?: readonly string[];
}): string | null => {
  const colorDrivenDefault = resolveDefaultBasinByCountertopColor(countertopColor);
  if (colorDrivenDefault) return colorDrivenDefault;

  for (const token of materialTokens ?? []) {
    const defaultBasin = MATERIAL_TOKEN_TO_DEFAULT_BASIN[normalizeMaterialToken(token)];
    if (defaultBasin) return defaultBasin;
  }

  return null;
};
