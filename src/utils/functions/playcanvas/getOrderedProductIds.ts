export function getOrderedProductIds(fallbackIds: string[] = []) {
  // @ts-ignore
  const containerRef = window.containerRef;
  const canvasIframe = containerRef?.current?.contentWindow as any;
  const compositionManager = canvasIframe?.ConfiguratorAPI?.config?.compositionManager;
  const composition = compositionManager?.getActiveComposition?.();
  const orderMap = composition?.getOrderProductIds?.();

  if (!orderMap || typeof orderMap !== "object") {
    return fallbackIds;
  }

  return Object.keys(orderMap).sort((a, b) => (orderMap[a] ?? 0) - (orderMap[b] ?? 0));
}
