export type ArExportFormat = "glb" | "usdz" | "both";

export type ArExportOptions = {
  filename?: string;
};

export type ArExportResult = {
  glb?: Blob;
  usdz?: Blob;
};

/**
 * Exports AR files from PlayCanvas without downloading.
 * @param format - Export format ("glb", "usdz", or "both"). Defaults to "both".
 * @returns Exported blobs (glb/usdz) or null if API is not ready.
 */
export async function exportToAR(format: ArExportFormat = "both"): Promise<ArExportResult | null> {
  // @ts-ignore
  const containerRef = window.containerRef;
  const canvasIframe = containerRef?.current?.contentWindow as any;

  const exportToAR = canvasIframe?.ConfiguratorAPI?.exportToAR;

  if (!exportToAR) {
    console.warn("[PlayCanvas] ConfiguratorAPI.exportToAR not ready");
    return null;
  }

  try {
    return (await exportToAR(format)) as ArExportResult;
  } catch (error) {
    console.error("[PlayCanvas] Failed to export AR files", error);
    return null;
  }
}
