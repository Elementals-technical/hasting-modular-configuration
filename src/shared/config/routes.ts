export const ROUTES = {
  HOME: "/",
  NOT_FOUND: "*",
} as const;

export type RoutePaths = (typeof ROUTES)[keyof typeof ROUTES];
