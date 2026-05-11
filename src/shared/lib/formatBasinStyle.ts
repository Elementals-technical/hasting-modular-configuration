const BASIN_MATERIAL_TOKENS = [
  "HPL/Fenix",
  "Tekorlux",
  "Tekormud",
  "Tekorund",
  "Ocritech",
  "Mineralmarmo",
  "Porcelain",
  "Glass",
  "Gres",
  "HPL",
  "Fenix",
] as const;

const normalizeMaterialToken = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[/_\-\s]+/g, "");

const MATERIAL_TOKEN_SET = new Set(BASIN_MATERIAL_TOKENS.map(normalizeMaterialToken));

const BASIN_STYLE_DISPLAY_ALIASES: Record<string, string> = {
  Aquarius: "Acquarius",
  UrbanModo: "Urban Modo",
  UrbanMorris: "Urban Morris",
};

const escapeForRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const formatBasinStyle = (value: string | null): string | null => {
  if (!value) return null;

  let cleaned = value
    .replace(/^Top_/, "")
    .replace(/^Vessel_/, "")
    .trim();

  if (!cleaned) return null;

  const orderedPrefixes = [...BASIN_MATERIAL_TOKENS].sort((left, right) => right.length - left.length);
  for (const prefix of orderedPrefixes) {
    const nextValue = cleaned.replace(new RegExp(`^${escapeForRegex(prefix)}(?:[/_\\-\\s]+)?`, "i"), "").trim();
    if (nextValue !== cleaned) {
      cleaned = nextValue;
      break;
    }
  }

  const styleTokens = cleaned
    .split("_")
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !MATERIAL_TOKEN_SET.has(normalizeMaterialToken(token)));

  const normalizedStyle = (styleTokens.length > 0 ? styleTokens.join(" ") : cleaned.replace(/_/g, " ")).trim();
  if (!normalizedStyle) return null;

  return BASIN_STYLE_DISPLAY_ALIASES[normalizedStyle] ?? normalizedStyle;
};
