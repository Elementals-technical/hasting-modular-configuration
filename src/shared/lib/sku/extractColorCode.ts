/**
 * Extracts the base color code from a color name string.
 *
 * Known finish suffixes (GL, MT) are **not** included because they are already
 * encoded in the material SKU (LACG = gloss, LACM = matt).
 *
 * Examples:
 *   "Ardesia DD 37 GL"  → "37"
 *   "Blu Pavone A6 MT"  → "A6"
 *   "Front Edge FE MT"  → "FE"
 *   "Limestone Ash TRF" → "TRF"
 *   "TFF"               → "TFF"
 */
const FINISH_SUFFIX_TOKENS = new Set(["GL", "MT"]);

export const extractColorCode = (value?: string | null): string | null => {
  if (!value) return null;

  const tokens = value
    .trim()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  if (!tokens.length) return null;

  const last = tokens[tokens.length - 1];
  const secondLast = tokens.length > 1 ? tokens[tokens.length - 2] : null;

  const isAlnum = (token: string) => /^[A-Za-z0-9]+$/.test(token);

  // When the last token is a known finish suffix (e.g. "GL", "MT") and
  // the second-to-last token is the actual color code, return only the
  // color code — the finish is already conveyed by the material SKU.
  if (
    secondLast &&
    FINISH_SUFFIX_TOKENS.has(last.toUpperCase()) &&
    isAlnum(secondLast) &&
    secondLast.length <= 3
  ) {
    return secondLast;
  }

  return last || null;
};
