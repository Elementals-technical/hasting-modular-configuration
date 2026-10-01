type HotjarCommandQueue = ((...args: unknown[]) => void) & { q?: IArguments[] };

type HotjarSettings = {
  hjid: number;
  hjsv: number;
};

declare global {
  interface Window {
    hj?: HotjarCommandQueue;
    _hjSettings?: HotjarSettings;
  }
}

const HOTJAR_SCRIPT_ID = "hotjar-tracking";
// `hjsv` of the official Hotjar tracking code; the parent site loads the same version.
const HOTJAR_SNIPPET_VERSION = 6;

const getHotjarSiteId = (): number | null => {
  const rawSiteId: string | undefined = import.meta.env.VITE_HOTJAR_SITE_ID;
  const siteId = Number(rawSiteId?.trim());

  return Number.isInteger(siteId) && siteId > 0 ? siteId : null;
};

export const initHotjar = () => {
  if (typeof window === "undefined") return;

  const siteId = getHotjarSiteId();
  if (siteId === null || document.getElementById(HOTJAR_SCRIPT_ID)) return;

  if (!window.hj) {
    const hj: HotjarCommandQueue = function () {
      // eslint-disable-next-line prefer-rest-params -- Hotjar replays queued calls from Arguments objects, as its official snippet pushes them
      (hj.q = hj.q ?? []).push(arguments);
    };
    window.hj = hj;
  }

  window._hjSettings = { hjid: siteId, hjsv: HOTJAR_SNIPPET_VERSION };

  const script = document.createElement("script");
  script.id = HOTJAR_SCRIPT_ID;
  script.async = true;
  script.src = `https://static.hotjar.com/c/hotjar-${siteId}.js?sv=${HOTJAR_SNIPPET_VERSION}`;
  document.head.appendChild(script);
};
