import { captureScreenshotWithOptions } from "@/utils/functions/playcanvas/captureScreenshot";

export const QUOTE_PREVIEW_CAMERA_RESTORED_EVENT = "quote-preview-camera-restored";

let activeQuotePreviewCaptureCount = 0;

export const getActiveQuotePreviewCaptureCount = () => activeQuotePreviewCaptureCount;

const QUOTE_PREVIEW_DISPLAY_SIZE = {
  width: 900,
  height: 446,
} as const;

const QUOTE_PREVIEW_SCALE = 2;
const QUOTE_PREVIEW_CONTENT_PADDING_RATIO = 0.04;

const QUOTE_PREVIEW_SIZE = {
  width: QUOTE_PREVIEW_DISPLAY_SIZE.width * QUOTE_PREVIEW_SCALE,
  height: QUOTE_PREVIEW_DISPLAY_SIZE.height * QUOTE_PREVIEW_SCALE,
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

    return await captureScreenshotWithOptions({
      includeLogo: false,
      outputSize: QUOTE_PREVIEW_SIZE,
      renderSourceAtOutputSize: true,
      transparentBackground: true,
      transparentContentPaddingRatio: QUOTE_PREVIEW_CONTENT_PADDING_RATIO,
    });
  } finally {
    activeQuotePreviewCaptureCount = Math.max(activeQuotePreviewCaptureCount - 1, 0);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(QUOTE_PREVIEW_CAMERA_RESTORED_EVENT));
    }
  }
};
