const CM_PER_INCH = 2.54;

/**
 * Converts centimetres to inches and returns a compact string
 * suitable for embedding in a SKU token.
 *
 * Examples (1 decimal):
 *   50 cm  → "19.7"
 *   60 cm  → "23.6"
 *   1  cm  → ".4"      (leading zero is dropped)
 *   45.5   → "17.9"
 */
export const cmToInches = (cm: number, precision = 1): string => {
  const inches = cm / CM_PER_INCH;
  const fixed = inches.toFixed(precision);
  // Drop trailing zeros after decimal, then drop leading zero for values < 1
  const trimmed = fixed.replace(/\.?0+$/, "");
  return trimmed.replace(/^0(?=\.)/, "");
};
