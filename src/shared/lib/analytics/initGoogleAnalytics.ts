type GtagFn = (...args: [string, ...unknown[]]) => void;

type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: GtagFn;
};

const appendAnalyticsScript = (id: string, src: string) => {
  if (document.getElementById(id)) return;

  const script = document.createElement("script");
  script.id = id;
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
};

const getEnvValue = (value: string | undefined) => value?.trim() ?? "";

export const initGoogleAnalytics = () => {
  if (typeof window === "undefined") return;

  const analyticsWindow = window as AnalyticsWindow;
  const gaId = getEnvValue(import.meta.env.VITE_GA_ID);
  const gtmId = getEnvValue(import.meta.env.VITE_GTM_ID);

  if (!gaId && !gtmId) return;

  analyticsWindow.dataLayer = analyticsWindow.dataLayer ?? [];

  if (gtmId) {
    analyticsWindow.dataLayer.push({
      "gtm.start": Date.now(),
      event: "gtm.js",
    });
    appendAnalyticsScript("google-tag-manager", `https://www.googletagmanager.com/gtm.js?id=${gtmId}`);
  }

  if (gaId) {
    analyticsWindow.gtag =
      analyticsWindow.gtag ??
      ((...args) => {
        analyticsWindow.dataLayer?.push(args);
      });

    analyticsWindow.gtag("js", new Date());
    analyticsWindow.gtag("config", gaId);
    appendAnalyticsScript("google-analytics", `https://www.googletagmanager.com/gtag/js?id=${gaId}`);
  }
};
