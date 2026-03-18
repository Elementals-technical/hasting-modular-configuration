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

export type CameraSnapshotOptions = {
  width?: number;
  height?: number;
  rerender?: boolean;
  format?: "image/png" | "image/jpeg" | (string & {});
  quality?: number;
  [key: string]: unknown;
};

export type CameraState = Record<string, unknown>;
