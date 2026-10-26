import { captureSceneImage } from "@/utils/functions/playcanvas/captureScreenshot";

export const QUOTE_PREVIEW_CAMERA_RESTORED_EVENT = "quote-preview-camera-restored";

let activeQuotePreviewCaptureCount = 0;

export const getActiveQuotePreviewCaptureCount = () => activeQuotePreviewCaptureCount;

// The PDF cover picture (.heroImage in QuotePrintDocument.module.scss) is 1684x894 CSS px: the full
// page width, from the logo to the footer. printQuote rasterises each page at 2x (CANVAS_SCALE),
// so 2x is every pixel the PDF keeps.
const QUOTE_PREVIEW_SLOT = { width: 1684, height: 894 } as const;
const QUOTE_PREVIEW_SCALE = 2;
const QUOTE_PREVIEW_SIZE = {
  width: QUOTE_PREVIEW_SLOT.width * QUOTE_PREVIEW_SCALE,
  height: QUOTE_PREVIEW_SLOT.height * QUOTE_PREVIEW_SCALE,
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
