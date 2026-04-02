type SkuEntry = { sku: string | undefined; skuInches: string; description: Record<string, unknown> };

let _fullSkuJson: SkuEntry[] = [];
let _summaryTotal: number | null = null;

export const setSummarySkuJson = (data: SkuEntry[]) => {
  _fullSkuJson = data;
};

export const getSummarySkuJson = () => _fullSkuJson;

export const setSummaryTotal = (value: number | null) => {
  _summaryTotal = value;
};

export const getSummaryTotal = () => _summaryTotal;
