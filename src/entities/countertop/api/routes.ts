import { buildRenderAdminUrl, encodeSkuQueryValue } from "@/shared";

const COUNTERTOP_TOP_PRICE_PATH = "/pricing-v2/resolve";

export const routes = {
  datatableById: (id: string | number) => buildRenderAdminUrl(`/datatables/${id}`),
  priceByCountertopTopSku: (sku: string, widthCm: number) =>
    buildRenderAdminUrl(COUNTERTOP_TOP_PRICE_PATH, [
      { key: "sku", value: sku, encodeValue: encodeSkuQueryValue },
      { key: "widthCm", value: widthCm },
    ]),
};
