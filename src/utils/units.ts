const CM_PER_INCH = 2.54;

export const cmToInch = (cm: number) => cm / CM_PER_INCH;
export const inchToCm = (inch: number) => inch * CM_PER_INCH;

const formatNumber = (value: number, precision = 2) => {
  const fixed = value.toFixed(precision);
  return fixed.replace(/\.?0+$/, "");
};

export const formatCmWithInches = (cm: number, precision = 2) => {
  const inches = cm / CM_PER_INCH;
  return `${formatNumber(cm, precision)} cm (${formatNumber(inches, precision)}")`;
};
