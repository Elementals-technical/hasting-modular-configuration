const baseUrl = "https://renderadmin.vivid3d.tech";
const pricingBaseUrl = "https://hbpricing.vivid3d.tech";

const normalizeBaseUrl = (url: string) => url.replace(/\/$/, "");

export const routes = {
  datatableById: (id: string | number) => `${normalizeBaseUrl(baseUrl)}/datatables/${id}`,
  priceBySku: (sku: string) => `${normalizeBaseUrl(pricingBaseUrl)}/?sku=${encodeURIComponent(sku)}`,
  resolveSkuPrice: (containerId: string | number, sku: string) =>
    `${normalizeBaseUrl(baseUrl)}/pricing/container/${containerId}/resolve/?sku=${encodeURIComponent(sku)}`,
  debugSkuSearch: (tableId: string | number, searchParts: string[]) => {
    const params = searchParts.map((p) => `searchPart=${encodeURIComponent(p)}`).join("&");
    return `${normalizeBaseUrl(baseUrl)}/pricing/debug/sku-search/${tableId}?${params}`;
  },
};
