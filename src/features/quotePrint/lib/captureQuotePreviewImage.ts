import { captureScreenshotWithOptions } from "@/utils/functions/playcanvas/captureScreenshot";

const QUOTE_PREVIEW_SIZE = {
  width: 900,
  height: 446,
} as const;

const RENDER_SETTLE_FRAMES = 2;

const waitForAnimationFrames = async (frames: number) => {
  for (let frame = 0; frame < frames; frame += 1) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
};

export const captureQuotePreviewImage = async () => {
  await waitForAnimationFrames(RENDER_SETTLE_FRAMES);

  return captureScreenshotWithOptions({
    includeLogo: false,
    outputSize: QUOTE_PREVIEW_SIZE,
    transparentBackground: true,
  });
};
