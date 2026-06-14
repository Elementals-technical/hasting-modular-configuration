import hastingsLogoUrl from "@/shared/assets/images/svg/logo/hastings-logo.svg";
import { captureCurrentViewHQSnapshot, type CameraHQSnapshotOptions, type CameraHQSnapshotResult } from "./camera";

type OutputSize = {
  width?: number;
  height?: number;
};

type CaptureScreenshotOptions = {
  includeLogo?: boolean;
  transparentBackground?: boolean;
  transparentContentPaddingRatio?: number;
  renderSourceAtOutputSize?: boolean;
  hqSnapshotOptions?: CameraHQSnapshotOptions;
  outputSize?: OutputSize;
};

type ImageBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type RgbaColor = {
  red: number;
  green: number;
  blue: number;
  alpha: number;
};

type CapturedImageSource = {
  src: string;
  revoke?: () => void;
};

type WindowWithContainerRef = Window & {
  containerRef?: {
    current?: HTMLIFrameElement | null;
  };
};

const BRAND_COLOR = "#231F20";
const BRAND_BACKGROUND = "#FFFFFF";
const FOOTER_FONT_FAMILY = "Poppins";
const FOOTER_FONT_WEIGHT = 400;
const FOOTER_FONT_SIZE = 24;
const FOOTER_LINE_HEIGHT = 42;
const FOOTER_MIN_FONT_SIZE = 16;
const FOOTER_MAX_CONTENT_WIDTH = 1680;
const BRANDING_REFERENCE_WIDTH = 2048;
const LOGO_WIDTH_RATIO = 0.2;
const LOGO_MAX_WIDTH = 420;
const MAX_TRANSPARENT_CONTENT_PADDING_RATIO = 0.45;
const HQ_SNAPSHOT_TIMEOUT_MS = 20_000;
const CURRENT_VIEW_HQ_SNAPSHOT_OPTIONS: CameraHQSnapshotOptions = {
  preset: "page",
  out: 2048,
  format: "image/png",
  bg: "#ffffff",
  cameraFrame: false,
};
const DOWNLOAD_HQ_SNAPSHOT_OPTIONS: CameraHQSnapshotOptions = {
  out: 4096,
};
const DOWNLOAD_OUTPUT_SIZE = {
  width: BRANDING_REFERENCE_WIDTH,
} as const;
const FOOTER_SEGMENTS = [
  "Hastings Bath Collection",
  "|",
  "800-351-0031",
  "|",
  "Sales: info@hastingsbath.com",
  "|",
  "Support: cs@hastingsbath.com",
] as const;

const activeHQSnapshotPromises = new Map<string, Promise<CameraHQSnapshotResult | null>>();
let activeDownloadPromise: Promise<void> | null = null;

const EDGE_BACKGROUND_COLOR_TOLERANCE = 24;
const EDGE_SAMPLE_STEPS = 16;
const NEAR_WHITE_THRESHOLD = 245;

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

const fitFooterFont = (ctx: CanvasRenderingContext2D, availableWidth: number, scale: number) => {
  let fontSize = Math.round(FOOTER_FONT_SIZE * scale);
  const minFontSize = Math.round(FOOTER_MIN_FONT_SIZE * scale);

  while (fontSize > minFontSize) {
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

const getBrandingScale = (outputWidth: number) => Math.max(1, outputWidth / BRANDING_REFERENCE_WIDTH);

const drawFooter = (
  ctx: CanvasRenderingContext2D,
  outputWidth: number,
  footerTop: number,
  footerHeight: number,
  scale: number,
) => {
  const footerHorizontalPadding = Math.max(Math.round(32 * scale), Math.round(outputWidth * 0.04));
  const footerWidth = Math.min(
    Math.round(FOOTER_MAX_CONTENT_WIDTH * scale),
    outputWidth - footerHorizontalPadding * 2,
  );
  const footerLeft = Math.round((outputWidth - footerWidth) / 2);
  const footerCenterY = footerTop + footerHeight / 2;

  const { fontSize, contentWidth } = fitFooterFont(ctx, footerWidth, scale);
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

const createCanvasContext = (width: number, height: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  return { canvas, ctx };
};

const createBrandedCaptureCanvas = async (
  sourceCanvas: HTMLCanvasElement,
  contentSize: Required<OutputSize>,
) => {
  const logoImage = await loadImage(hastingsLogoUrl);
  const brandingScale = getBrandingScale(contentSize.width);
  const footerFontSize = Math.round(FOOTER_FONT_SIZE * brandingScale);

  await loadCanvasFont(footerFontSize);

  const logoTargetWidth = Math.min(
    Math.round(contentSize.width * LOGO_WIDTH_RATIO),
    Math.round(LOGO_MAX_WIDTH * brandingScale),
  );
  const logoScale = logoTargetWidth / logoImage.naturalWidth;
  const logoTargetHeight = Math.round(logoImage.naturalHeight * logoScale);
  const headerTopPadding = Math.max(Math.round(28 * brandingScale), Math.round(contentSize.width * 0.02));
  const headerBottomPadding = Math.max(Math.round(24 * brandingScale), Math.round(contentSize.width * 0.018));
  const headerHeight = headerTopPadding + logoTargetHeight + headerBottomPadding;
  const footerVerticalPadding = Math.max(Math.round(28 * brandingScale), Math.round(contentSize.width * 0.02));
  const footerHeight = footerVerticalPadding * 2 + Math.round(FOOTER_LINE_HEIGHT * brandingScale);
  const screenshotTop = headerHeight;
  const footerTop = screenshotTop + contentSize.height;
  const outputCanvas = createCanvasContext(contentSize.width, contentSize.height + headerHeight + footerHeight);

  if (!outputCanvas) return null;

  const { canvas, ctx } = outputCanvas;

  ctx.fillStyle = BRAND_BACKGROUND;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.drawImage(sourceCanvas, 0, screenshotTop, contentSize.width, contentSize.height);
  ctx.drawImage(
    logoImage,
    Math.round((canvas.width - logoTargetWidth) / 2),
    headerTopPadding,
    logoTargetWidth,
    logoTargetHeight,
  );

  drawFooter(ctx, canvas.width, footerTop, footerHeight, brandingScale);

  return canvas;
};

export async function captureScreenshot(): Promise<string | null> {
  return captureScreenshotWithOptions();
}

const readColor = (data: Uint8ClampedArray, pixelIndex: number): RgbaColor => ({
  red: data[pixelIndex],
  green: data[pixelIndex + 1],
  blue: data[pixelIndex + 2],
  alpha: data[pixelIndex + 3],
});

const isNearWhite = (color: RgbaColor) =>
  color.red >= NEAR_WHITE_THRESHOLD && color.green >= NEAR_WHITE_THRESHOLD && color.blue >= NEAR_WHITE_THRESHOLD;

const getColorDistanceSquared = (left: RgbaColor, right: RgbaColor) => {
  const redDiff = left.red - right.red;
  const greenDiff = left.green - right.green;
  const blueDiff = left.blue - right.blue;
  return redDiff * redDiff + greenDiff * greenDiff + blueDiff * blueDiff;
};

const isSimilarColor = (left: RgbaColor, right: RgbaColor, tolerance: number) =>
  getColorDistanceSquared(left, right) <= tolerance * tolerance;

const collectEdgeBackgroundColors = (data: Uint8ClampedArray, width: number, height: number) => {
  const colors: RgbaColor[] = [];
  const addColor = (x: number, y: number) => {
    const color = readColor(data, (y * width + x) * 4);
    if (color.alpha === 0) return;
    if (colors.some((existing) => isSimilarColor(existing, color, 4))) return;
    colors.push(color);
  };

  for (let step = 0; step <= EDGE_SAMPLE_STEPS; step += 1) {
    const x = Math.round((width - 1) * (step / EDGE_SAMPLE_STEPS));
    const y = Math.round((height - 1) * (step / EDGE_SAMPLE_STEPS));
    addColor(x, 0);
    addColor(x, height - 1);
    addColor(0, y);
    addColor(width - 1, y);
  }

  return colors;
};

const isTransparentCandidate = (
  data: Uint8ClampedArray,
  pixelIndex: number,
  backgroundColors: RgbaColor[],
) => {
  const color = readColor(data, pixelIndex);
  if (color.alpha === 0) return false;
  if (isNearWhite(color)) return true;
  return backgroundColors.some((backgroundColor) =>
    isSimilarColor(color, backgroundColor, EDGE_BACKGROUND_COLOR_TOLERANCE),
  );
};

const makeEdgeBackgroundTransparent = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  if (width <= 0 || height <= 0) return;

  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;
  const backgroundColors = collectEdgeBackgroundColors(data, width, height);
  const visited = new Uint8Array(width * height);
  const queue: number[] = [];

  const enqueue = (x: number, y: number) => {
    const pixel = y * width + x;
    if (visited[pixel]) return;

    const pixelIndex = pixel * 4;
    if (!isTransparentCandidate(data, pixelIndex, backgroundColors)) return;

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

const normalizeOutputSize = (sourceCanvas: HTMLCanvasElement, outputSize?: OutputSize): Required<OutputSize> => {
  const sourceRatio = sourceCanvas.width > 0 && sourceCanvas.height > 0 ? sourceCanvas.width / sourceCanvas.height : 1;
  const width = Number(outputSize?.width);
  const height = Number(outputSize?.height);
  const hasWidth = Number.isFinite(width) && width > 0;
  const hasHeight = Number.isFinite(height) && height > 0;

  if (hasWidth && hasHeight) {
    return {
      width: Math.round(width),
      height: Math.round(height),
    };
  }

  if (hasWidth) {
    const roundedWidth = Math.round(width);

    return {
      width: roundedWidth,
      height: Math.max(1, Math.round(roundedWidth / sourceRatio)),
    };
  }

  if (hasHeight) {
    const roundedHeight = Math.round(height);

    return {
      width: Math.max(1, Math.round(roundedHeight * sourceRatio)),
      height: roundedHeight,
    };
  }

  return {
    width: sourceCanvas.width,
    height: sourceCanvas.height,
  };
};

const isSecurityError = (error: unknown) => error instanceof DOMException && error.name === "SecurityError";

const logScreenshotError = (error: unknown) => {
  if (isSecurityError(error)) {
    console.error(
      "[PlayCanvas] Screenshot failed: image capture requires a same-origin PlayCanvas iframe/canvas.",
      error,
    );
    return;
  }

  console.error("[PlayCanvas] Screenshot failed", error);
};

const getVisiblePlayCanvasCanvas = (): HTMLCanvasElement | null => {
  const iframeEl = (window as WindowWithContainerRef).containerRef?.current ?? null;

  if (!iframeEl) {
    console.warn("[PlayCanvas] Iframe not found for screenshot capture");
    return null;
  }

  try {
    const visibleCanvas = iframeEl.contentDocument?.querySelector("canvas") ?? null;

    if (!visibleCanvas) {
      console.warn("[PlayCanvas] Canvas not found in iframe");
    }

    return visibleCanvas;
  } catch (error) {
    if (isSecurityError(error)) {
      console.error(
        "[PlayCanvas] Cannot access iframe canvas. Screenshot capture expects the PlayCanvas iframe to be same-origin.",
        error,
      );
      return null;
    }

    throw error;
  }
};

const getSourceSnapshotOptions = (
  hqSnapshotOptions: CameraHQSnapshotOptions | undefined,
  renderSourceSize: Required<OutputSize> | null,
): CameraHQSnapshotOptions | undefined => {
  if (!renderSourceSize) return hqSnapshotOptions;

  return {
    ...hqSnapshotOptions,
    width: renderSourceSize.width,
    height: renderSourceSize.height,
  };
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

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
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

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
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

const createTransparentOutputCanvas = (
  sourceCanvas: HTMLCanvasElement,
  outputCanvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  transparentContentPaddingRatio: number,
) => {
  const croppedCanvas = createCanvasContext(sourceCanvas.width, sourceCanvas.height);
  if (!croppedCanvas) return null;

  croppedCanvas.ctx.drawImage(sourceCanvas, 0, 0);
  makeEdgeBackgroundTransparent(croppedCanvas.ctx, croppedCanvas.canvas.width, croppedCanvas.canvas.height);

  const sourceBounds = getOpaqueBounds(croppedCanvas.ctx, croppedCanvas.canvas.width, croppedCanvas.canvas.height);
  if (sourceBounds) {
    drawContainedCrop(
      ctx,
      croppedCanvas.canvas,
      sourceBounds,
      outputCanvas.width,
      outputCanvas.height,
      transparentContentPaddingRatio,
    );
  } else {
    drawContainedImage(ctx, croppedCanvas.canvas, outputCanvas.width, outputCanvas.height);
  }

  return outputCanvas;
};

const createUnbrandedCaptureCanvas = (
  sourceCanvas: HTMLCanvasElement,
  contentSize: Required<OutputSize>,
  options: Pick<CaptureScreenshotOptions, "outputSize" | "transparentBackground" | "transparentContentPaddingRatio">,
) => {
  const outputCanvas = createCanvasContext(contentSize.width, contentSize.height);
  if (!outputCanvas) return null;

  const { canvas, ctx } = outputCanvas;
  const hasOutputSize = Boolean(options.outputSize);

  if (hasOutputSize && options.transparentBackground) {
    return createTransparentOutputCanvas(
      sourceCanvas,
      canvas,
      ctx,
      options.transparentContentPaddingRatio ?? 0,
    );
  }

  if (hasOutputSize) {
    drawContainedImage(ctx, sourceCanvas, canvas.width, canvas.height);
    return canvas;
  }

  ctx.drawImage(sourceCanvas, 0, 0);

  if (options.transparentBackground) {
    makeEdgeBackgroundTransparent(ctx, canvas.width, canvas.height);
  }

  return canvas;
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

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, warningMessage: string): Promise<T | null> =>
  new Promise((resolve) => {
    let isSettled = false;

    const settle = (value: T | null) => {
      if (isSettled) return;
      isSettled = true;
      window.clearTimeout(timeout);
      resolve(value);
    };

    const timeout = window.setTimeout(() => {
      console.warn(warningMessage);
      settle(null);
    }, timeoutMs);

    promise.then(settle).catch((error) => {
      console.error("[PlayCanvas] HQ snapshot failed", error);
      settle(null);
    });
  });

const getHQSnapshotOptionsKey = (options: CameraHQSnapshotOptions) => JSON.stringify(options);

const captureSharedHQSnapshot = (options: CameraHQSnapshotOptions) => {
  const key = getHQSnapshotOptionsKey(options);
  const activePromise = activeHQSnapshotPromises.get(key);
  if (activePromise) return activePromise;

  const snapshotPromise = captureCurrentViewHQSnapshot(options).finally(() => {
    activeHQSnapshotPromises.delete(key);
  });

  activeHQSnapshotPromises.set(key, snapshotPromise);

  return snapshotPromise;
};

const resolveHQSnapshotOptions = (overrides?: CameraHQSnapshotOptions): CameraHQSnapshotOptions => ({
  ...CURRENT_VIEW_HQ_SNAPSHOT_OPTIONS,
  ...overrides,
});

const captureCurrentViewHQSnapshotImageSource = async (
  options?: CameraHQSnapshotOptions,
): Promise<CapturedImageSource | null> => {
  const shot = await withTimeout(
    captureSharedHQSnapshot(resolveHQSnapshotOptions(options)),
    HQ_SNAPSHOT_TIMEOUT_MS,
    "[PlayCanvas] HQ snapshot timed out; using visible canvas fallback",
  );
  if (!shot) return null;

  if (shot.blob) {
    const objectUrl = URL.createObjectURL(shot.blob);
    return {
      src: objectUrl,
      revoke: () => URL.revokeObjectURL(objectUrl),
    };
  }

  return typeof shot.dataUrl === "string" && shot.dataUrl ? { src: shot.dataUrl } : null;
};

const canvasToBlob = (canvas: HTMLCanvasElement, format = "image/png", quality?: number): Promise<Blob | null> =>
  new Promise((resolve) => {
    if (!canvas.toBlob) {
      resolve(null);
      return;
    }

    try {
      canvas.toBlob((blob) => resolve(blob), format, quality);
    } catch (error) {
      logScreenshotError(error);
      resolve(null);
    }
  });

const canvasToDataUrl = (canvas: HTMLCanvasElement, format = "image/png", quality?: number) => {
  try {
    return canvas.toDataURL(format, quality);
  } catch (error) {
    logScreenshotError(error);
    return null;
  }
};

const downloadBlob = (blob: Blob, filename: string) => {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = filename;
  link.href = objectUrl;
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
};

const captureScreenshotCanvasWithOptions = async (
  options: CaptureScreenshotOptions = {},
): Promise<HTMLCanvasElement | null> => {
  const {
    includeLogo = true,
    hqSnapshotOptions,
    outputSize,
    renderSourceAtOutputSize = false,
    transparentBackground = false,
    transparentContentPaddingRatio = 0,
  } = options;
  const visibleCanvas = getVisiblePlayCanvasCanvas();

  if (!visibleCanvas) return null;

  let snapshotImageSource: CapturedImageSource | null = null;
  const renderSourceSize =
    renderSourceAtOutputSize && outputSize ? normalizeOutputSize(visibleCanvas, outputSize) : null;

  try {
    snapshotImageSource = await captureCurrentViewHQSnapshotImageSource(
      getSourceSnapshotOptions(hqSnapshotOptions, renderSourceSize),
    );
    const snapshot = snapshotImageSource?.src ?? null;
    const snapshotCanvas = snapshot ? await createCanvasFromImageSource(snapshot) : null;
    const sourceCanvas = snapshotCanvas ?? visibleCanvas;
    const normalizedOutputSize = renderSourceSize ?? normalizeOutputSize(sourceCanvas, outputSize);

    if (includeLogo) {
      return (await createBrandedCaptureCanvas(sourceCanvas, normalizedOutputSize)) ?? sourceCanvas;
    }

    return (
      createUnbrandedCaptureCanvas(sourceCanvas, normalizedOutputSize, {
        outputSize,
        transparentBackground,
        transparentContentPaddingRatio,
      }) ?? sourceCanvas
    );
  } catch (e) {
    logScreenshotError(e);
    return null;
  } finally {
    snapshotImageSource?.revoke?.();
  }
};

export async function captureScreenshotWithOptions(options: CaptureScreenshotOptions = {}): Promise<string | null> {
  const canvas = await captureScreenshotCanvasWithOptions(options);
  return canvas ? canvasToDataUrl(canvas, "image/png") : null;
}

const downloadSceneImageOnce = async (filename: string) => {
  const canvas = await captureScreenshotCanvasWithOptions({
    includeLogo: true,
    hqSnapshotOptions: DOWNLOAD_HQ_SNAPSHOT_OPTIONS,
    outputSize: DOWNLOAD_OUTPUT_SIZE,
  });
  if (!canvas) return;

  const blob = await canvasToBlob(canvas, "image/png");
  if (blob) {
    downloadBlob(blob, filename);
    return;
  }

  const link = document.createElement("a");
  link.download = filename;
  const dataUrl = canvasToDataUrl(canvas, "image/png");
  if (!dataUrl) return;

  link.href = dataUrl;
  link.click();
};

export function downloadSceneImage(filename = "configuration.png") {
  if (activeDownloadPromise) return;

  activeDownloadPromise = downloadSceneImageOnce(filename)
    .catch((error) => {
      console.error("[PlayCanvas] Scene image download failed", error);
    })
    .finally(() => {
      activeDownloadPromise = null;
    });
}
