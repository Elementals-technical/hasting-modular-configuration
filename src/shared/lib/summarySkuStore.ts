type SkuEntry = { sku: string | undefined; skuInches: string; description: Record<string, unknown> };

let _fullSkuJson: SkuEntry[] = [];
const listeners = new Set<() => void>();

const notify = () => {
  listeners.forEach((listener) => listener());
};

export const setSummarySkuJson = (data: SkuEntry[]) => {
  _fullSkuJson = data;
  notify();
};

export const getSummarySkuJson = () => _fullSkuJson;

export const subscribeSummaryStore = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
