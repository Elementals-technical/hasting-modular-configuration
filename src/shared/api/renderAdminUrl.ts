type RenderAdminQueryValue = string | number | boolean | null | undefined;

type RenderAdminQueryParam = {
  key: string;
  value: RenderAdminQueryValue;
  encodeValue?: (value: string) => string;
};

const RENDER_ADMIN_BASE_URL = "https://renderadmin.vivid3d.tech";

const normalizeBaseUrl = (url: string) => url.replace(/\/$/, "");

const normalizePath = (path: string) => (path.startsWith("/") ? path : `/${path}`);

export const encodeSkuQueryValue = (sku: string) => encodeURIComponent(sku).replace(/%2F/gi, "/");

export const buildRenderAdminUrl = (path: string, queryParams: readonly RenderAdminQueryParam[] = []) => {
  const query = queryParams
    .filter(({ value }) => value != null)
    .map(({ key, value, encodeValue }) => {
      const encode = encodeValue ?? encodeURIComponent;
      return `${encodeURIComponent(key)}=${encode(String(value))}`;
    })
    .join("&");

  const url = `${normalizeBaseUrl(RENDER_ADMIN_BASE_URL)}${normalizePath(path)}`;
  return query ? `${url}?${query}` : url;
};
