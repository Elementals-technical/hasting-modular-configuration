type SkuEntry = { sku: string | undefined; skuInches: string; description: Record<string, unknown> };

let _fullSkuJson: SkuEntry[] = [];
let _summaryTotal: number | null = null;
const listeners = new Set<() => void>();

const notify = () => {
  listeners.forEach((listener) => listener());
};

export const setSummarySkuJson = (data: SkuEntry[]) => {
  _fullSkuJson = data;
  notify();
};

export const getSummarySkuJson = () => _fullSkuJson;

export const setSummaryTotal = (value: number | null) => {
  _summaryTotal = value;
  notify();
};

export const getSummaryTotal = () => _summaryTotal;

export const subscribeSummaryStore = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
