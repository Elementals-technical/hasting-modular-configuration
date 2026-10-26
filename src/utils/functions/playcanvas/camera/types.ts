export type CameraPivotPoint = { x: number; y: number; z: number };

export type CameraInfo = {
  distance?: number;
  pitch?: number;
  yaw?: number;
  pivotPoint?: CameraPivotPoint;
  distanceMin?: number;
  distanceMax?: number;
  zoomStep?: number;
  isManualControl?: boolean;
  canAutoFrame?: boolean;
  [key: string]: unknown;
};

export type CameraFramingConfig = {
  paddingWide?: number;
  paddingTall?: number;
  minDistance?: number;
  maxDistance?: number;
  autoFramingEnabled?: boolean;
  [key: string]: unknown;
};

export type CameraHQSnapshotOptions = {
  preset?: string;
  out?: number;
  size?: number;
  width?: number;
  height?: number;
  format?: "image/png" | "image/jpeg" | "image/webp" | (string & {});
  quality?: number;
  bg?: string | null;
  azimuth?: number;
  elevation?: number;
  margin?: number;
  cameraFrame?: boolean;
  ssao?: boolean;
  ssaoSamples?: number;
  bloom?: number;
  superSample?: number;
  ss?: number | null;
  aabbExclude?: string[];
  /** `false` leaves the scene room (walls, floor) out of the frame. Builds before room hiding ignore it. */
  includeRoom?: boolean;
  /**
   * `true` keeps the current camera angle and moves the camera so the product fills the frame;
   * the room stays in the picture. Builds before it ignore it and keep the camera as it is.
   */
  fitToProduct?: boolean;
  [key: string]: unknown;
};

export type CameraHQSnapshotResult = {
  blob: Blob;
  width: number;
  height: number;
  format: string;
  quality?: number;
  source?: string;
  dataUrl?: string;
  /** Entities left out of the frame (e.g. the room); missing in builds before room hiding. */
  hiddenEntities?: string[];
  /** True when `fitToProduct` moved the camera to the product; missing in builds before it. */
  fittedToContent?: boolean;
  memoryGuard?: {
    profile: "ios" | "mobile" | "desktop";
    adjusted: boolean;
    reasons: string[];
    requested: Record<string, unknown>;
    effective: Record<string, unknown>;
  };
};

export type CameraState = Record<string, unknown>;
