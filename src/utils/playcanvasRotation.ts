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
  let completed = false;
  let detachPointerListeners: (() => void) | null = null;

  const complete = () => {
    if (completed) return;
    completed = true;
    if (sessionKey) {
      sessionStorage.setItem(sessionKey, "1");
    }
    onRotate();
    handle.app.off("update", onUpdate);
    detachPointerListeners?.();
  };

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
      complete();
    }
  };

  const attachPointerListeners = () => {
    // @ts-ignore PlayCanvas iframe ref is exposed by the integration bridge.
    const iframeDocument = window.containerRef?.current?.contentDocument as Document | undefined;
    if (!iframeDocument) return;

    const onPointerMove = () => complete();
    iframeDocument.addEventListener("pointermove", onPointerMove, { once: true });
    iframeDocument.addEventListener("touchmove", onPointerMove, { once: true });
    detachPointerListeners = () => {
      iframeDocument.removeEventListener("pointermove", onPointerMove);
      iframeDocument.removeEventListener("touchmove", onPointerMove);
    };
  };

  handle.app.on("update", onUpdate);
  attachPointerListeners();

  return () => {
    handle.app.off("update", onUpdate);
    detachPointerListeners?.();
  };
}
