const baseUrl = "https://renderadmin.vivid3d.tech";
const pricingBaseUrl = "https://hbpricing.vivid3d.tech";

const normalizeBaseUrl = (url: string) => url.replace(/\/$/, "");

export const routes = {
  datatableById: (id: string | number) => `${normalizeBaseUrl(baseUrl)}/datatables/${id}`,
  priceBySku: (sku: string) => `${normalizeBaseUrl(pricingBaseUrl)}/?sku=${encodeURIComponent(sku)}`,
};
