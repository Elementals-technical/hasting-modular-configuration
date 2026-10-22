import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { captureScreenshotWithOptions } = vi.hoisted(() => ({
  captureScreenshotWithOptions: vi.fn(async () => "data:image/png;base64,"),
}));

vi.mock("@/utils/functions/playcanvas/captureScreenshot", () => ({ captureScreenshotWithOptions }));

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
    captureScreenshotWithOptions.mockClear();
  });

  it("asks PlayCanvas for the product only: no room, transparent background", async () => {
    await captureQuotePreviewImage();

    const [options] = captureScreenshotWithOptions.mock.calls[0] as unknown as [
      { hqSnapshotOptions: Record<string, unknown>; transparentBackground: boolean },
    ];
    expect(options.hqSnapshotOptions).toMatchObject({ includeRoom: false, bg: null });
    expect(options.transparentBackground).toBe(true);
  });
});
