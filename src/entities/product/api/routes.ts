const baseUrl = import.meta.env.REACT_APP_API_URL ?? "";

const normalizeBaseUrl = (url: string) => url.replace(/\/$/, "");

export const routes = {
  datatableById: (id: string | number) =>
    `${normalizeBaseUrl(baseUrl)}/datatables/${id}`,
};
