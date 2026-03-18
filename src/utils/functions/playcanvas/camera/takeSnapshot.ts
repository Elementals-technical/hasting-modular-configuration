import { getCameraMethod } from "./api";
import type { CameraSnapshotOptions } from "./types";

export async function takeSnapshot(options?: CameraSnapshotOptions): Promise<string | null> {
  const takeSnapshotMethod = getCameraMethod<(options?: CameraSnapshotOptions) => Promise<string | null>>("takeSnapshot");
  if (!takeSnapshotMethod) return null;

  try {
    return await takeSnapshotMethod(options);
  } catch (error) {
    console.error("[PlayCanvas] Failed to take snapshot", error);
    return null;
  }
}
