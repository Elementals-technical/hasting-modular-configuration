export const ROUTES = {
  HOME: "/",
  PREBUILT: "/prebuilt",
  CUSTOM: "/custom",
  AR_DOWNLOAD: "/ar-download",
  NOT_FOUND: "*",
} as const;

export type RoutePaths = (typeof ROUTES)[keyof typeof ROUTES];
