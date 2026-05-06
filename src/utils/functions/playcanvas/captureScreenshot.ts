import hastingsLogoUrl from "@/shared/assets/images/svg/logo/hastings-logo.svg";
import { takeSnapshot } from "./camera";

const BRAND_COLOR = "#231F20";
const BRAND_BACKGROUND = "#FFFFFF";
const FOOTER_FONT_FAMILY = "Poppins";
const FOOTER_FONT_WEIGHT = 400;
const FOOTER_FONT_SIZE = 18;
const FOOTER_LINE_HEIGHT = 32;
const FOOTER_MIN_FONT_SIZE = 12;
const FOOTER_MAX_CONTENT_WIDTH = 1444;
const MAX_TRANSPARENT_CONTENT_PADDING_RATIO = 0.45;
const FOOTER_SEGMENTS = [
  "Hastings Bath Collection",
  "|",
  "800-351-0031",
  "|",
  "Sales: info@hastingsbath.com",
  "|",
  "Support: cs@hastingsbath.com",
] as const;

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    image.src = src;
  });

const loadCanvasFont = async (fontSize: number) => {
  try {
    await document.fonts.load(`${FOOTER_FONT_WEIGHT} ${fontSize}px "${FOOTER_FONT_FAMILY}"`);
  } catch (error) {
    console.warn("[PlayCanvas] Failed to preload footer font", error);
  }
};

const measureFooterContentWidth = (ctx: CanvasRenderingContext2D) =>
  FOOTER_SEGMENTS.reduce((total, segment) => total + ctx.measureText(segment).width, 0);

const fitFooterFont = (ctx: CanvasRenderingContext2D, availableWidth: number) => {
  let fontSize = FOOTER_FONT_SIZE;

  while (fontSize > FOOTER_MIN_FONT_SIZE) {
    ctx.font = `${FOOTER_FONT_WEIGHT} ${fontSize}px "${FOOTER_FONT_FAMILY}"`;

    if (measureFooterContentWidth(ctx) <= availableWidth) {
      break;
    }

    fontSize -= 1;
  }

  ctx.font = `${FOOTER_FONT_WEIGHT} ${fontSize}px "${FOOTER_FONT_FAMILY}"`;

  return {
    fontSize,
    contentWidth: measureFooterContentWidth(ctx),
  };
};

const drawFooter = (
  ctx: CanvasRenderingContext2D,
  outputWidth: number,
  footerTop: number,
  footerHeight: number,
) => {
  const footerHorizontalPadding = Math.max(32, Math.round(outputWidth * 0.04));
  const footerWidth = Math.min(FOOTER_MAX_CONTENT_WIDTH, outputWidth - footerHorizontalPadding * 2);
  const footerLeft = Math.round((outputWidth - footerWidth) / 2);
  const footerCenterY = footerTop + footerHeight / 2;

  const { fontSize, contentWidth } = fitFooterFont(ctx, footerWidth);
  const gapCount = Math.max(FOOTER_SEGMENTS.length - 1, 1);
  const gap = Math.max((footerWidth - contentWidth) / gapCount, 0);

  ctx.save();
  ctx.fillStyle = BRAND_COLOR;
  ctx.font = `${FOOTER_FONT_WEIGHT} ${fontSize}px "${FOOTER_FONT_FAMILY}"`;
  ctx.textBaseline = "middle";

  let currentX = footerLeft;

  FOOTER_SEGMENTS.forEach((segment, index) => {
    ctx.fillText(segment, currentX, footerCenterY);
    currentX += ctx.measureText(segment).width;

    if (index < FOOTER_SEGMENTS.length - 1) {
      currentX += gap;
    }
  });

  ctx.restore();
};

const drawBrandedCapture = async (
  sourceCanvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  outputCanvas: HTMLCanvasElement,
) => {
  const logoImage = await loadImage(hastingsLogoUrl);

  await loadCanvasFont(FOOTER_FONT_SIZE);

  const logoTargetWidth = Math.min(Math.round(sourceCanvas.width * 0.18), 260);
  const logoScale = logoTargetWidth / logoImage.naturalWidth;
  const logoTargetHeight = Math.round(logoImage.naturalHeight * logoScale);
  const headerTopPadding = Math.max(28, Math.round(sourceCanvas.width * 0.02));
  const headerBottomPadding = Math.max(24, Math.round(sourceCanvas.width * 0.018));
  const headerHeight = headerTopPadding + logoTargetHeight + headerBottomPadding;
  const footerVerticalPadding = Math.max(28, Math.round(sourceCanvas.width * 0.02));
  const footerHeight = footerVerticalPadding * 2 + FOOTER_LINE_HEIGHT;
  const screenshotTop = headerHeight;
  const footerTop = screenshotTop + sourceCanvas.height;

  outputCanvas.width = sourceCanvas.width;
  outputCanvas.height = sourceCanvas.height + headerHeight + footerHeight;

  ctx.fillStyle = BRAND_BACKGROUND;
  ctx.fillRect(0, 0, outputCanvas.width, outputCanvas.height);

  ctx.drawImage(sourceCanvas, 0, screenshotTop);
  ctx.drawImage(
    logoImage,
    Math.round((outputCanvas.width - logoTargetWidth) / 2),
    headerTopPadding,
    logoTargetWidth,
    logoTargetHeight,
  );

  drawFooter(ctx, outputCanvas.width, footerTop, footerHeight);
};

export async function captureScreenshot(): Promise<string | null> {
  return captureScreenshotWithOptions();
}

type CaptureScreenshotOptions = {
  includeLogo?: boolean;
  transparentBackground?: boolean;
  transparentContentPaddingRatio?: number;
  renderSourceAtOutputSize?: boolean;
  outputSize?: {
    width: number;
    height: number;
  };
};

type ImageBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const isTransparentCandidate = (data: Uint8ClampedArray, pixelIndex: number) => {
  const red = data[pixelIndex];
  const green = data[pixelIndex + 1];
  const blue = data[pixelIndex + 2];
  const alpha = data[pixelIndex + 3];

  return alpha > 0 && red >= 245 && green >= 245 && blue >= 245;
};

const makeEdgeBackgroundTransparent = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  if (width <= 0 || height <= 0) return;

  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;
  const visited = new Uint8Array(width * height);
  const queue: number[] = [];

  const enqueue = (x: number, y: number) => {
    const pixel = y * width + x;
    if (visited[pixel]) return;

    const pixelIndex = pixel * 4;
    if (!isTransparentCandidate(data, pixelIndex)) return;

    visited[pixel] = 1;
    queue.push(pixel);
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }

  for (let y = 1; y < height - 1; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  let cursor = 0;
  while (cursor < queue.length) {
    const pixel = queue[cursor];
    cursor += 1;

    const x = pixel % width;
    const y = Math.floor(pixel / width);
    data[pixel * 4 + 3] = 0;

    if (x > 0) enqueue(x - 1, y);
    if (x < width - 1) enqueue(x + 1, y);
    if (y > 0) enqueue(x, y - 1);
    if (y < height - 1) enqueue(x, y + 1);
  }

  ctx.putImageData(imageData, 0, 0);
};

const getOpaqueBounds = (ctx: CanvasRenderingContext2D, width: number, height: number): ImageBounds | null => {
  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha === 0) continue;

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) return null;

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
};

const normalizeContentPaddingRatio = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), MAX_TRANSPARENT_CONTENT_PADDING_RATIO);
};

const drawContainedImage = (
  ctx: CanvasRenderingContext2D,
  sourceCanvas: HTMLCanvasElement,
  outputWidth: number,
  outputHeight: number,
) => {
  const sourceRatio = sourceCanvas.width / sourceCanvas.height;
  const outputRatio = outputWidth / outputHeight;
  const targetWidth = sourceRatio > outputRatio ? outputWidth : outputHeight * sourceRatio;
  const targetHeight = sourceRatio > outputRatio ? outputWidth / sourceRatio : outputHeight;
  const targetX = (outputWidth - targetWidth) / 2;
  const targetY = (outputHeight - targetHeight) / 2;

  ctx.drawImage(sourceCanvas, targetX, targetY, targetWidth, targetHeight);
};

const drawContainedCrop = (
  ctx: CanvasRenderingContext2D,
  sourceCanvas: HTMLCanvasElement,
  sourceBounds: ImageBounds,
  outputWidth: number,
  outputHeight: number,
  paddingRatio = 0,
) => {
  const sourceRatio = sourceBounds.width / sourceBounds.height;
  const normalizedPaddingRatio = normalizeContentPaddingRatio(paddingRatio);
  const safeAreaWidth = outputWidth * (1 - normalizedPaddingRatio * 2);
  const safeAreaHeight = outputHeight * (1 - normalizedPaddingRatio * 2);
  const safeAreaRatio = safeAreaWidth / safeAreaHeight;
  const targetWidth = sourceRatio > safeAreaRatio ? safeAreaWidth : safeAreaHeight * sourceRatio;
  const targetHeight = sourceRatio > safeAreaRatio ? safeAreaWidth / sourceRatio : safeAreaHeight;
  const targetX = (outputWidth - targetWidth) / 2;
  const targetY = (outputHeight - targetHeight) / 2;

  ctx.drawImage(
    sourceCanvas,
    sourceBounds.x,
    sourceBounds.y,
    sourceBounds.width,
    sourceBounds.height,
    targetX,
    targetY,
    targetWidth,
    targetHeight,
  );
};

const createCanvasFromImageSource = async (src: string): Promise<HTMLCanvasElement | null> => {
  const image = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(image, 0, 0);
  return canvas;
};

export async function captureScreenshotWithOptions(options: CaptureScreenshotOptions = {}): Promise<string | null> {
  const {
    includeLogo = true,
    outputSize,
    renderSourceAtOutputSize = false,
    transparentBackground = false,
    transparentContentPaddingRatio = 0,
  } = options;
  const iframeEl = (window as any).containerRef?.current as HTMLIFrameElement | null;
  const visibleCanvas = iframeEl?.contentDocument?.querySelector("canvas");

  if (!visibleCanvas) {
    console.warn("[PlayCanvas] Canvas not found in iframe");
    return null;
  }

  try {
    const snapshot =
      renderSourceAtOutputSize && outputSize
        ? await takeSnapshot({
            width: outputSize.width,
            height: outputSize.height,
            rerender: true,
            format: "image/png",
          })
        : null;
    const snapshotCanvas = snapshot ? await createCanvasFromImageSource(snapshot) : null;
    const sourceCanvas = snapshotCanvas ?? visibleCanvas;

    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = outputSize?.width ?? sourceCanvas.width;
    outputCanvas.height = outputSize?.height ?? sourceCanvas.height;

    const ctx = outputCanvas.getContext("2d");
    if (!ctx) return sourceCanvas.toDataURL("image/png");

    if (includeLogo) {
      await drawBrandedCapture(sourceCanvas, ctx, outputCanvas);
    } else {
      if (outputSize && transparentBackground) {
        const croppedCanvas = document.createElement("canvas");
        croppedCanvas.width = sourceCanvas.width;
        croppedCanvas.height = sourceCanvas.height;

        const croppedCtx = croppedCanvas.getContext("2d");
        if (!croppedCtx) return sourceCanvas.toDataURL("image/png");

        croppedCtx.drawImage(sourceCanvas, 0, 0);
        makeEdgeBackgroundTransparent(croppedCtx, croppedCanvas.width, croppedCanvas.height);

        const sourceBounds = getOpaqueBounds(croppedCtx, croppedCanvas.width, croppedCanvas.height);
        if (sourceBounds) {
          drawContainedCrop(
            ctx,
            croppedCanvas,
            sourceBounds,
            outputCanvas.width,
            outputCanvas.height,
            transparentContentPaddingRatio,
          );
        } else {
          drawContainedImage(ctx, croppedCanvas, outputCanvas.width, outputCanvas.height);
        }
      } else if (outputSize) {
        drawContainedImage(ctx, sourceCanvas, outputCanvas.width, outputCanvas.height);
      } else {
        ctx.drawImage(sourceCanvas, 0, 0);

        if (transparentBackground) {
          makeEdgeBackgroundTransparent(ctx, outputCanvas.width, outputCanvas.height);
        }
      }
    }

    return outputCanvas.toDataURL("image/png");
  } catch (e) {
    console.error("[PlayCanvas] Screenshot failed", e);
    return null;
  }
}

export function downloadSceneImage(filename = "configuration.png") {
  captureScreenshotWithOptions({ includeLogo: true }).then((dataUrl) => {
    if (!dataUrl) return;

    const link = document.createElement("a");
    link.download = filename;
    link.href = dataUrl;
    link.click();
  });
}
