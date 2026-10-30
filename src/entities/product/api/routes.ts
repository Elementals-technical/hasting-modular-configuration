const baseUrl = "https://renderadmin.vivid3d.tech";

const normalizeBaseUrl = (url: string) => url.replace(/\/$/, "");

const encodeSku = (sku: string) => encodeURIComponent(sku).replace(/%2F/gi, "/");

export const routes = {
  datatableById: (id: string | number) => `${normalizeBaseUrl(baseUrl)}/datatables/${id}`,
  priceBySku: (sku: string) => `${normalizeBaseUrl(baseUrl)}/pricing-v2/resolve?sku=${encodeSku(sku)}`,
  priceBySkuV2Resolve: (sku: string, widthCm?: number) => {
    const base = `${normalizeBaseUrl(baseUrl)}/pricing-v2/resolve?sku=${encodeSku(sku)}`;
    return widthCm != null ? `${base}&widthCm=${widthCm}` : base;
  },
};
