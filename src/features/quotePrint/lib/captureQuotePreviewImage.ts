import { captureSceneImage } from "@/utils/functions/playcanvas/captureScreenshot";

export const QUOTE_PREVIEW_CAMERA_RESTORED_EVENT = "quote-preview-camera-restored";

let activeQuotePreviewCaptureCount = 0;

export const getActiveQuotePreviewCaptureCount = () => activeQuotePreviewCaptureCount;

// The PDF hero slot is 900x446 CSS px; rendering 4x keeps the picture sharp when the PDF is zoomed.
const QUOTE_PREVIEW_SCALE = 4;
const QUOTE_PREVIEW_SIZE = {
  width: 900 * QUOTE_PREVIEW_SCALE,
  height: 446 * QUOTE_PREVIEW_SCALE,
} as const;

const RENDER_SETTLE_FRAMES = 2;

const waitForAnimationFrames = async (frames: number) => {
  for (let frame = 0; frame < frames; frame += 1) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
};

export const captureQuotePreviewImage = async () => {
  activeQuotePreviewCaptureCount += 1;

  try {
    await waitForAnimationFrames(RENDER_SETTLE_FRAMES);

    // Same render as the "Image" download button, room included, with three changes for the PDF:
    // no logo or footer (the page has its own header), the slot's size, and the camera brought
    // up to the product so it fills the slot at full resolution.
    return await captureSceneImage({ includeBranding: false, outputSize: QUOTE_PREVIEW_SIZE, fitToProduct: true });
  } finally {
    activeQuotePreviewCaptureCount = Math.max(activeQuotePreviewCaptureCount - 1, 0);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(QUOTE_PREVIEW_CAMERA_RESTORED_EVENT));
    }
  }
};
