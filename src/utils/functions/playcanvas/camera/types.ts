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
  memoryGuard?: {
    profile: "ios" | "mobile" | "desktop";
    adjusted: boolean;
    reasons: string[];
    requested: Record<string, unknown>;
    effective: Record<string, unknown>;
  };
};

export type CameraState = Record<string, unknown>;
