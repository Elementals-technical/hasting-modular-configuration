import { orbitCamera, resetOrbitRotationTracker } from "@/utils/functions/playcanvas/orbitCamera";

type RotationListenerOptions = {
  threshold?: number;
  sessionKey?: string;
};

export function onFirstOrbitRotation(
  onRotate: () => void,
  options: RotationListenerOptions = {}
): (() => void) | null {
  const sessionKey = options.sessionKey;
  if (sessionKey && sessionStorage.getItem(sessionKey)) {
    return null;
  }

  const handle = orbitCamera();
  if (!handle) return null;

  resetOrbitRotationTracker();

  let lastYaw: number | null = null;
  const threshold = options.threshold ?? 0.1;

  const onUpdate = () => {
    const yaw = handle.cameraEntity.getEulerAngles().y as number;
    if (lastYaw === null) {
      lastYaw = yaw;
      return;
    }

    const diff = Math.abs(yaw - lastYaw);
    const normalizedDiff = Math.min(diff, 360 - diff);
    lastYaw = yaw;

    if (normalizedDiff > threshold) {
      if (sessionKey) {
        sessionStorage.setItem(sessionKey, "1");
      }
      onRotate();
      handle.app.off("update", onUpdate);
    }
  };

  handle.app.on("update", onUpdate);
  return () => handle.app.off("update", onUpdate);
}
