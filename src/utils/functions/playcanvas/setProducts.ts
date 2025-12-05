const CONFIGURATOR_IFRAME_ID = "demo";

export const setProducts = () => {
  const apiFromWindow = (window as any).ConfiguratorAPI;
  if (apiFromWindow) return apiFromWindow;

  const iframe = document.getElementById(CONFIGURATOR_IFRAME_ID) as HTMLIFrameElement | null;
  return iframe?.contentWindow && (iframe.contentWindow as any).ConfiguratorAPI;
};
