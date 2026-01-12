export type ArFileFormat = "glb" | "usdz";

/**
 * Downloads AR files locally
 * @param format - Optional file format ('glb' or 'usdz'). If not provided, both files will be downloaded.
 * @returns Promise that resolves when download is initiated
 */
export async function downloadArFiles(format?: ArFileFormat): Promise<void> {
  // @ts-ignore
  const containerRef = window.containerRef;
  const canvasIframe = containerRef?.current?.contentWindow as any;

  const downloadARFiles = canvasIframe?.ConfiguratorAPI?.downloadARFiles;

  if (!downloadARFiles) {
    console.warn("[PlayCanvas] ConfiguratorAPI.downloadARFiles not ready");
    return;
  }

  try {
    if (format) {
      await downloadARFiles(format);
    } else {
      await downloadARFiles();
    }
  } catch (error) {
    console.error("[PlayCanvas] Failed to download AR files", error);
  }
}
