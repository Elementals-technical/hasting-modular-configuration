/**
 * Extracts the base color code from a color name string.
 *
 * Known finish/material suffixes are **not** included when they are already
 * encoded in the material SKU (LACG = gloss, LACM = matt, ST = Soft-Touch).
 *
 * Examples:
 *   "Ardesia DD 37 GL"  → "37"
 *   "Blu Pavone A6 MT"  → "A6"
 *   "Front Edge FE MT"  → "FE"
 *   "Arancio Zucca 09 ST" → "09" when materialSku is "ST"
 *   "Limestone Ash TRF"   → "TRF"
 *   "TFF"                 → "TFF"
 */
const DEFAULT_NON_COLOR_SUFFIX_TOKENS = ["GL", "MT"] as const;

type ExtractColorCodeOptions = {
  /** Material SKU already represented by the SKU material segment, e.g. "ST". */
  materialSku?: string | null;
};

const normalizeToken = (value: string) => value.trim().toUpperCase();

const buildNonColorSuffixTokens = ({ materialSku }: ExtractColorCodeOptions): Set<string> => {
  const tokens = new Set<string>(DEFAULT_NON_COLOR_SUFFIX_TOKENS);
  const normalizedMaterialSku = materialSku ? normalizeToken(materialSku) : "";

  if (normalizedMaterialSku) tokens.add(normalizedMaterialSku);

  return tokens;
};

export const extractColorCode = (value?: string | null, options: ExtractColorCodeOptions = {}): string | null => {
  if (!value) return null;

  const tokens = value
    .trim()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  if (!tokens.length) return null;

  const last = tokens[tokens.length - 1];
  const secondLast = tokens.length > 1 ? tokens[tokens.length - 2] : null;
  const nonColorSuffixTokens = buildNonColorSuffixTokens(options);

  const isAlnum = (token: string) => /^[A-Za-z0-9]+$/.test(token);

  // When the last token is a known suffix (e.g. "GL", "MT", or material SKU) and
  // the second-to-last token is the actual color code, return only the
  // color code — the suffix is already conveyed by the material SKU.
  if (
    secondLast &&
    nonColorSuffixTokens.has(normalizeToken(last)) &&
    isAlnum(secondLast) &&
    secondLast.length <= 3
  ) {
    return secondLast;
  }

  return last || null;
};
