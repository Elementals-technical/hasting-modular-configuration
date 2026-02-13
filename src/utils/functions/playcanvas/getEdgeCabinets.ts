export interface EdgeCabinets {
  leftCabinetId: string | null;
  rightCabinetId: string | null;
}

const EMPTY: EdgeCabinets = { leftCabinetId: null, rightCabinetId: null };

export function getEdgeCabinets(): EdgeCabinets {
  // @ts-ignore
  const containerRef = window.containerRef;
  const canvasIframe = containerRef?.current?.contentWindow as any;

  const getEdgeCabinetsApi = canvasIframe?.ConfiguratorAPI?.getEdgeCabinets;

  if (!getEdgeCabinetsApi) {
    console.warn("[PlayCanvas] ConfiguratorAPI.getEdgeCabinets not ready");
    return EMPTY;
  }

  try {
    return getEdgeCabinetsApi() ?? EMPTY;
  } catch (error) {
    console.error("[PlayCanvas] Failed to getEdgeCabinets", error);
    return EMPTY;
  }
}
