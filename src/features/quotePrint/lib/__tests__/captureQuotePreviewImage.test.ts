import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { captureSceneImage } = vi.hoisted(() => ({
  captureSceneImage: vi.fn(async (_options?: unknown) => "data:image/png;base64,download"),
}));

vi.mock("@/utils/functions/playcanvas/captureScreenshot", () => ({ captureSceneImage }));

import { captureQuotePreviewImage } from "../captureQuotePreviewImage";

describe("captureQuotePreviewImage", () => {
  beforeEach(() => {
    // The capture waits two animation frames before asking PlayCanvas for the render.
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    captureSceneImage.mockClear();
  });

  it("uses the download button's render: no branding, PDF slot size, product filling the frame", async () => {
    const image = await captureQuotePreviewImage();

    expect(captureSceneImage).toHaveBeenCalledWith({
      includeBranding: false,
      outputSize: { width: 3368, height: 1788 },
      fitToProduct: true,
    });
    expect(image).toBe("data:image/png;base64,download");
  });
});
