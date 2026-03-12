export async function captureScreenshot(): Promise<string | null> {
  const iframeEl = (window as any).containerRef?.current as HTMLIFrameElement | null;
  const canvas = iframeEl?.contentDocument?.querySelector("canvas");

  if (!canvas) {
    console.warn("[PlayCanvas] Canvas not found in iframe");
    return null;
  }

  try {
    return canvas.toDataURL("image/png");
  } catch (e) {
    console.error("[PlayCanvas] Screenshot failed", e);
    return null;
  }
}

export function downloadSceneImage(filename = "configuration.png") {
  captureScreenshot().then((dataUrl) => {
    if (!dataUrl) return;

    const link = document.createElement("a");
    link.download = filename;
    link.href = dataUrl;
    link.click();
  });
}
