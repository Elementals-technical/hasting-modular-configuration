const baseUrl = "https://renderadmin.vivid3d.tech";
const pricingBaseUrl = "https://hbpricing.vivid3d.tech";

const normalizeBaseUrl = (url: string) => url.replace(/\/$/, "");

export const routes = {
  datatableById: (id: string | number) => `${normalizeBaseUrl(baseUrl)}/datatables/${id}`,
  priceBySku: (sku: string) => `${normalizeBaseUrl(pricingBaseUrl)}/?sku=${encodeURIComponent(sku)}`,
  priceBySkuV2Resolve: (sku: string, widthCm?: number) => {
    const base = `${normalizeBaseUrl(baseUrl)}/pricing-v2/resolve?sku=${encodeURIComponent(sku)}`;
    return widthCm != null ? `${base}&widthCm=${widthCm}` : base;
  },
  resolveSkuPrice: (containerId: string | number, sku: string) =>
    `${normalizeBaseUrl(baseUrl)}/pricing/container/${containerId}/resolve/?sku=${encodeURIComponent(sku)}`,
  debugSkuSearch: (tableId: string | number, searchParts: string[]) => {
    const params = searchParts.map((p) => `searchPart=${encodeURIComponent(p)}`).join("&");
    return `${normalizeBaseUrl(baseUrl)}/pricing/debug/sku-search/${tableId}?${params}`;
  },
};
