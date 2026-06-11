import { waitForCameraMethod } from "./api";
import type { CameraHQSnapshotOptions, CameraHQSnapshotResult } from "./types";

type CaptureCurrentViewHQSnapshotInput = CameraHQSnapshotOptions | string;

export async function captureCurrentViewHQSnapshot(
  options?: CaptureCurrentViewHQSnapshotInput,
): Promise<CameraHQSnapshotResult | null> {
  const captureCurrentViewHQSnapshotMethod =
    await waitForCameraMethod<
      (options?: CaptureCurrentViewHQSnapshotInput) => Promise<CameraHQSnapshotResult>
    >("captureCurrentViewHQSnapshot");
  if (!captureCurrentViewHQSnapshotMethod) return null;

  try {
    return await captureCurrentViewHQSnapshotMethod(options);
  } catch (error) {
    console.error("[PlayCanvas] Failed to capture current view HQ snapshot", error);
    return null;
  }
}
