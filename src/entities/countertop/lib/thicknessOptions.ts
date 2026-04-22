export type CountertopThicknessOption = {
  id: number;
  title: string;
  value: string;
  isShortDesc: false;
  isSwatchWithHint: false;
};

export const COUNTERTOP_THICKNESS_OPTIONS: CountertopThicknessOption[] = [
  {
    id: 10,
    title: '0.4"',
    value: "0.375",
    isShortDesc: false,
    isSwatchWithHint: false,
  },
  {
    id: 17,
    title: '0.4"',
    value: "0.4",
    isShortDesc: false,
    isSwatchWithHint: false,
  },
  {
    id: 11,
    title: '0.5"',
    value: "0.5",
    isShortDesc: false,
    isSwatchWithHint: false,
  },
  {
    id: 12,
    title: '2.4"',
    value: "2.4",
    isShortDesc: false,
    isSwatchWithHint: false,
  },
  {
    id: 13,
    title: '4"',
    value: "4",
    isShortDesc: false,
    isSwatchWithHint: false,
  },
  {
    id: 14,
    title: '5.1"',
    value: "5.125",
    isShortDesc: false,
    isSwatchWithHint: false,
  },
  {
    id: 15,
    title: '5.5"',
    value: "5.5",
    isShortDesc: false,
    isSwatchWithHint: false,
  },
];

const NUMERIC_MATCH_EPSILON = 0.001;

const stripInchSuffix = (value: string): string => value.trim().replace(/"$/, "");

const parseThicknessNumber = (value: string | number): number | null => {
  const parsed = typeof value === "number" ? value : Number.parseFloat(stripInchSuffix(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeLegacyThicknessValue = (value: number): number => {
  if (Math.abs(value - 2.375) < NUMERIC_MATCH_EPSILON) return 2.4;
  if (Math.abs(value - 2.5) < NUMERIC_MATCH_EPSILON) return 2.4;
  return value;
};

const formatNumericThickness = (value: number): string => {
  const fixed = value.toFixed(1);
  return fixed.endsWith(".0") ? fixed.slice(0, -2) : fixed;
};

export const formatCountertopThicknessLabel = (value: string | number | null | undefined): string | null => {
  if (value === null || value === undefined) return null;

  const raw = typeof value === "number" ? String(value) : value.trim();
  if (!raw) return null;

  const rawWithoutSuffix = stripInchSuffix(raw);
  const exactOption = COUNTERTOP_THICKNESS_OPTIONS.find(
    (option) => option.value === rawWithoutSuffix || stripInchSuffix(option.title) === rawWithoutSuffix,
  );
  if (exactOption) return exactOption.title;

  const parsed = parseThicknessNumber(value);
  if (parsed === null) return raw;

  const normalized = normalizeLegacyThicknessValue(parsed);
  const numericOption = COUNTERTOP_THICKNESS_OPTIONS.find((option) => {
    const optionValue = parseThicknessNumber(option.value);
    const optionTitle = parseThicknessNumber(option.title);

    return (
      (optionValue !== null && Math.abs(optionValue - normalized) < NUMERIC_MATCH_EPSILON) ||
      (optionTitle !== null && Math.abs(optionTitle - normalized) < NUMERIC_MATCH_EPSILON)
    );
  });

  return numericOption?.title ?? `${formatNumericThickness(normalized)}"`;
};
