export const routes = {
  create: () => "/modular/ar-configurations",
  list: () => "/modular/ar-configurations",
  query: () => "/modular/ar-configurations/query",
  byId: (id: string | number) => `/ar-configurations/${id}`,
};
