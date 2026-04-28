import type { ProductOptionData } from "../ui/ProductOptionsGrid/ProductOptionsGrid";

type ProductOptionPriorityResolver<T extends ProductOptionData> = (option: T) => number;

const normalizeProductOptionValue = (value: string): string => value.trim().replace(/\s+/g, " ").toLowerCase();

const getProductOptionValueKey = (option: ProductOptionData): string => {
  const candidates = [option.metadata?.value, option.name, option.title];

  for (const candidate of candidates) {
    const normalized = typeof candidate === "string" ? normalizeProductOptionValue(candidate) : "";
    if (normalized) return normalized;
  }

  return String(option.id);
};

export const dedupeProductOptionsByValue = <T extends ProductOptionData>(
  options: T[],
  resolvePriority?: ProductOptionPriorityResolver<T>,
): T[] => {
  const result: T[] = [];
  const indexByValue = new Map<string, number>();

  options.forEach((option) => {
    const valueKey = getProductOptionValueKey(option);
    const existingIndex = indexByValue.get(valueKey);

    if (existingIndex === undefined) {
      indexByValue.set(valueKey, result.length);
      result.push(option);
      return;
    }

    const existingOption = result[existingIndex];
    const optionPriority = resolvePriority?.(option) ?? 0;
    const existingPriority = resolvePriority?.(existingOption) ?? 0;

    if (optionPriority > existingPriority) {
      result[existingIndex] = option;
    }
  });

  return result;
};
