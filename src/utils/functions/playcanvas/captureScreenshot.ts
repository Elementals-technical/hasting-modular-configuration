import hastingsLogoUrl from "@/shared/assets/images/svg/logo/hastings-logo.svg";

const BRAND_COLOR = "#231F20";
const BRAND_BACKGROUND = "#FFFFFF";
const FOOTER_FONT_FAMILY = "Poppins";
const FOOTER_FONT_WEIGHT = 400;
const FOOTER_FONT_SIZE = 18;
const FOOTER_LINE_HEIGHT = 32;
const FOOTER_MIN_FONT_SIZE = 12;
const FOOTER_MAX_CONTENT_WIDTH = 1444;
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
};

export async function captureScreenshotWithOptions(options: CaptureScreenshotOptions = {}): Promise<string | null> {
  const { includeLogo = true } = options;
  const iframeEl = (window as any).containerRef?.current as HTMLIFrameElement | null;
  const sourceCanvas = iframeEl?.contentDocument?.querySelector("canvas");

  if (!sourceCanvas) {
    console.warn("[PlayCanvas] Canvas not found in iframe");
    return null;
  }

  try {
    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = sourceCanvas.width;
    outputCanvas.height = sourceCanvas.height;

    const ctx = outputCanvas.getContext("2d");
    if (!ctx) return sourceCanvas.toDataURL("image/png");

    if (includeLogo) {
      await drawBrandedCapture(sourceCanvas, ctx, outputCanvas);
    } else {
      ctx.drawImage(sourceCanvas, 0, 0);
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
