import { MAX_SWATCHES } from "../model/constants";

const normalizeSwatchValue = (value?: string | null): string | null => {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  return trimmed || null;
};

export const deriveSummarySwatchValues = ({
  sectionSwatchValues,
  cabinetColor,
  handleGrooveColor,
}: {
  sectionSwatchValues: Array<string | null | undefined>;
  cabinetColor?: string | null;
  handleGrooveColor?: string | null;
}): string[] => {
  const uniqueValues = new Set<string>();
  const orderedValues: string[] = [];

  const addValue = (value?: string | null) => {
    const normalizedValue = normalizeSwatchValue(value);
    if (!normalizedValue || uniqueValues.has(normalizedValue)) return;

    uniqueValues.add(normalizedValue);
    orderedValues.push(normalizedValue);
  };

  sectionSwatchValues.forEach((value) => addValue(value));

  const normalizedCabinetColor = normalizeSwatchValue(cabinetColor);
  const normalizedHandleGrooveColor = normalizeSwatchValue(handleGrooveColor);
  const hasContrastingHandleGroove =
    normalizedHandleGrooveColor !== null &&
    (normalizedCabinetColor === null || normalizedHandleGrooveColor.toLowerCase() !== normalizedCabinetColor.toLowerCase());

  if (hasContrastingHandleGroove) {
    addValue(normalizedHandleGrooveColor);
  }

  return orderedValues.slice(0, MAX_SWATCHES);
};
