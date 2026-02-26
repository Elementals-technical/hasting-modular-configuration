type SkuEntry = { sku: string | undefined; skuInches: string; description: Record<string, unknown> };

let _fullSkuJson: SkuEntry[] = [];

export const setSummarySkuJson = (data: SkuEntry[]) => {
  _fullSkuJson = data;
};

export const getSummarySkuJson = () => _fullSkuJson;
