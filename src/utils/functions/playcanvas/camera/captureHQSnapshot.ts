import { getCameraMethod } from "./api";
import type { CameraHQSnapshotOptions, CameraHQSnapshotResult } from "./types";

type CaptureHQSnapshotInput = CameraHQSnapshotOptions | string;

export async function captureHQSnapshot(
  options?: CaptureHQSnapshotInput,
): Promise<CameraHQSnapshotResult | null> {
  const captureHQSnapshotMethod =
    getCameraMethod<(options?: CaptureHQSnapshotInput) => Promise<CameraHQSnapshotResult>>("captureHQSnapshot");
  if (!captureHQSnapshotMethod) return null;

  try {
    return await captureHQSnapshotMethod(options);
  } catch (error) {
    console.error("[PlayCanvas] Failed to capture HQ snapshot", error);
    return null;
  }
}
