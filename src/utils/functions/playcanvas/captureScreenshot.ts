import hastingsLogoUrl from "@/shared/assets/images/svg/logo/hastings-logo.svg";

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    image.src = src;
  });

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

    ctx.drawImage(sourceCanvas, 0, 0);

    if (includeLogo) {
      const logoImage = await loadImage(hastingsLogoUrl);
      const margin = Math.max(16, Math.round(outputCanvas.width * 0.03));
      const targetWidth = Math.min(Math.round(outputCanvas.width * 0.22), 260);
      const scale = targetWidth / logoImage.naturalWidth;
      const targetHeight = Math.round(logoImage.naturalHeight * scale);

      ctx.drawImage(logoImage, margin, margin, targetWidth, targetHeight);
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
