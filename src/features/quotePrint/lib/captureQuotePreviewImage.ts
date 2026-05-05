import { captureScreenshotWithOptions } from "@/utils/functions/playcanvas/captureScreenshot";
import {
  exportCameraState,
  focusCamera,
  getFramingConfig,
  importCameraState,
  setFramingConfig,
  type CameraFramingConfig,
} from "@/utils/functions/playcanvas/camera";
import {
  captureOrbitCameraState,
  restoreOrbitCameraState,
  type OrbitCameraState,
} from "@/utils/functions/playcanvas/orbitCamera";

export const QUOTE_PREVIEW_CAMERA_RESTORED_EVENT = "quote-preview-camera-restored";

let activeQuotePreviewCaptureCount = 0;

export const getActiveQuotePreviewCaptureCount = () => activeQuotePreviewCaptureCount;

const QUOTE_PREVIEW_DISPLAY_SIZE = {
  width: 900,
  height: 446,
} as const;

const QUOTE_PREVIEW_SCALE = 2;
const QUOTE_CAPTURE_FRAMING_SCALE = 0.85;
const QUOTE_CAPTURE_MIN_PADDING = 1;
const QUOTE_CAPTURE_DEFAULT_PADDING_WIDE = 1.2;
const QUOTE_CAPTURE_DEFAULT_PADDING_TALL = 1.6;

const QUOTE_PREVIEW_SIZE = {
  width: QUOTE_PREVIEW_DISPLAY_SIZE.width * QUOTE_PREVIEW_SCALE,
  height: QUOTE_PREVIEW_DISPLAY_SIZE.height * QUOTE_PREVIEW_SCALE,
} as const;

const RENDER_SETTLE_FRAMES = 2;
const CAMERA_SETTLE_FRAMES = 3;

const waitForAnimationFrames = async (frames: number) => {
  for (let frame = 0; frame < frames; frame += 1) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
};

const resolveCapturePadding = (value: unknown, fallback: number) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(value * QUOTE_CAPTURE_FRAMING_SCALE, QUOTE_CAPTURE_MIN_PADDING);
};

const resolveQuoteCaptureFraming = (current: CameraFramingConfig | null): CameraFramingConfig => ({
  ...(current ?? {}),
  paddingWide: resolveCapturePadding(current?.paddingWide, QUOTE_CAPTURE_DEFAULT_PADDING_WIDE),
  paddingTall: resolveCapturePadding(current?.paddingTall, QUOTE_CAPTURE_DEFAULT_PADDING_TALL),
});

const resolveQuoteOrbitState = (
  focusedState: OrbitCameraState | null,
  originalState: OrbitCameraState | null,
): OrbitCameraState | null => {
  if (!focusedState || !originalState) return null;

  return {
    distance: focusedState.distance,
    pitch: originalState.pitch,
    pivotPoint: focusedState.pivotPoint,
    targetDistance: focusedState.targetDistance ?? focusedState.distance,
    targetPitch: originalState.targetPitch ?? originalState.pitch,
    targetPivotPoint: focusedState.targetPivotPoint ?? focusedState.pivotPoint,
    targetYaw: originalState.targetYaw ?? originalState.yaw,
    yaw: originalState.yaw,
  };
};

export const captureQuotePreviewImage = async () => {
  activeQuotePreviewCaptureCount += 1;
  let cameraState: ReturnType<typeof exportCameraState> = null;
  let orbitCameraState: OrbitCameraState | null = null;
  let framingConfig: CameraFramingConfig | null = null;

  try {
    await waitForAnimationFrames(RENDER_SETTLE_FRAMES);

    cameraState = exportCameraState();
    orbitCameraState = captureOrbitCameraState();
    framingConfig = getFramingConfig();

    if (cameraState) {
      setFramingConfig(resolveQuoteCaptureFraming(framingConfig));
      focusCamera();
      await waitForAnimationFrames(CAMERA_SETTLE_FRAMES);

      const quoteOrbitState = resolveQuoteOrbitState(captureOrbitCameraState(), orbitCameraState);
      if (quoteOrbitState) {
        restoreOrbitCameraState(quoteOrbitState);
        await waitForAnimationFrames(CAMERA_SETTLE_FRAMES);
      }
    }

    return await captureScreenshotWithOptions({
      includeLogo: false,
      outputSize: QUOTE_PREVIEW_SIZE,
      renderSourceAtOutputSize: true,
      transparentBackground: true,
    });
  } finally {
    if (cameraState) {
      importCameraState(cameraState);
    }

    restoreOrbitCameraState(orbitCameraState);

    if (framingConfig) {
      setFramingConfig(framingConfig);
    }

    activeQuotePreviewCaptureCount = Math.max(activeQuotePreviewCaptureCount - 1, 0);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(QUOTE_PREVIEW_CAMERA_RESTORED_EVENT));
    }
  }
};
