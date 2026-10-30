export const ROUTES = {
  HOME: "/",
  RESTORE: "/restore",
  PREBUILT: "/prebuilt",
  CUSTOM: "/custom",
  CUSTOM_CABINET_STYLE_DETAILS: "/custom/cabinet-builder/details/style",
  AR_DOWNLOAD: "/ar-download",
} as const;

export type RoutePaths = (typeof ROUTES)[keyof typeof ROUTES];
