export const routes = {
  create: () => "/ar-configurations",
  list: () => "/ar-configurations",
  query: () => "/ar-configurations/query",
  byId: (id: string | number) => `/ar-configurations/${id}`,
};
