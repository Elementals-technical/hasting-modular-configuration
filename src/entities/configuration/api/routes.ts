export const routes = {
  save: () => "/configurations/store",
  list: () => "/modular/configurations/store",
  byId: (id: string | number) => `/configurations/store/${id}`,
};
