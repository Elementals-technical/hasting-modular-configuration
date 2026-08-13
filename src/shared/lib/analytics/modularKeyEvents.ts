type GtagFn = (command: "event", eventName: string, params: Record<string, string | number>) => void;

type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: GtagFn;
};

export const MODULAR_ANALYTICS_MESSAGE_SOURCE = "hastings_modular_configurator";
export const MODULAR_ANALYTICS_MESSAGE_TYPE = "hastings_modular_key_event";

export const MODULAR_KEY_EVENT_NAMES = {
  customizeClick: "hastings_modular_customize_click",
  orderFreeSwatchesClick: "hastings_modular_order_free_swatches_click",
  howToBuyClick: "hastings_modular_how_to_buy_click",
} as const;

export type ModularKeyEventName = (typeof MODULAR_KEY_EVENT_NAMES)[keyof typeof MODULAR_KEY_EVENT_NAMES];
export type ModularConfiguratorFlow = "prebuilt" | "custom";

export type ModularKeyEventParams = {
  cta_name: string;
  cta_location: string;
  configurator_flow?: ModularConfiguratorFlow;
  product_element?: string;
  model_count?: number;
};

export type ModularKeyEventPayload = ModularKeyEventParams & {
  event: ModularKeyEventName;
  event_category: "modular_configurator";
  event_action: "click";
  event_label: string;
  page_path: string;
  page_url: string;
};

export type ModularAnalyticsParentMessage = {
  source: typeof MODULAR_ANALYTICS_MESSAGE_SOURCE;
  type: typeof MODULAR_ANALYTICS_MESSAGE_TYPE;
  payload: ModularKeyEventPayload;
};

const getAnalyticsWindow = (): AnalyticsWindow | null => {
  if (typeof window === "undefined") return null;
  return window as AnalyticsWindow;
};

const getCurrentPageContext = () => {
  const analyticsWindow = getAnalyticsWindow();

  return {
    page_path: analyticsWindow?.location.pathname ?? "",
    page_url: analyticsWindow?.location.href ?? "",
  };
};

const compactParams = (params: Record<string, string | number | undefined>) =>
  Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== "")) as Record<
    string,
    string | number
  >;

const resolveParentTargetOrigin = () => {
  const analyticsWindow = getAnalyticsWindow();
  if (!analyticsWindow) return "*";

  const hostUrl = new URLSearchParams(analyticsWindow.location.search).get("hostUrl");
  const candidates = [hostUrl, analyticsWindow.document.referrer];

  for (const candidate of candidates) {
    if (!candidate) continue;

    try {
      return new URL(candidate, analyticsWindow.location.origin).origin;
    } catch {
      continue;
    }
  }

  return "*";
};

const postToParent = (payload: ModularKeyEventPayload) => {
  const analyticsWindow = getAnalyticsWindow();
  if (!analyticsWindow || analyticsWindow.parent === analyticsWindow) return;

  const message: ModularAnalyticsParentMessage = {
    source: MODULAR_ANALYTICS_MESSAGE_SOURCE,
    type: MODULAR_ANALYTICS_MESSAGE_TYPE,
    payload,
  };

  analyticsWindow.parent.postMessage(message, resolveParentTargetOrigin());
};

export const buildModularKeyEventPayload = (
  event: ModularKeyEventName,
  params: ModularKeyEventParams,
): ModularKeyEventPayload => ({
  event,
  event_category: "modular_configurator",
  event_action: "click",
  event_label: params.cta_name,
  ...getCurrentPageContext(),
  ...params,
});

export const trackModularKeyEvent = (event: ModularKeyEventName, params: ModularKeyEventParams) => {
  const analyticsWindow = getAnalyticsWindow();
  if (!analyticsWindow) return;

  const payload = buildModularKeyEventPayload(event, params);
  const gtagParams = compactParams({
    event_category: payload.event_category,
    event_action: payload.event_action,
    event_label: payload.event_label,
    cta_name: payload.cta_name,
    cta_location: payload.cta_location,
    configurator_flow: payload.configurator_flow,
    product_element: payload.product_element,
    model_count: payload.model_count,
    page_path: payload.page_path,
    page_url: payload.page_url,
  });

  analyticsWindow.dataLayer = analyticsWindow.dataLayer ?? [];
  analyticsWindow.dataLayer.push(payload);
  analyticsWindow.gtag?.("event", event, gtagParams);
  analyticsWindow.dispatchEvent(new CustomEvent(event, { detail: payload }));
  postToParent(payload);
};

export const trackModularCustomizeClick = (params: Omit<ModularKeyEventParams, "cta_name">) => {
  trackModularKeyEvent(MODULAR_KEY_EVENT_NAMES.customizeClick, {
    cta_name: "Customize",
    ...params,
  });
};

export const trackModularOrderFreeSwatchesClick = (params: Omit<ModularKeyEventParams, "cta_name">) => {
  trackModularKeyEvent(MODULAR_KEY_EVENT_NAMES.orderFreeSwatchesClick, {
    cta_name: "Order Free Swatches",
    ...params,
  });
};

export const trackModularHowToBuyClick = (params: Omit<ModularKeyEventParams, "cta_name">) => {
  trackModularKeyEvent(MODULAR_KEY_EVENT_NAMES.howToBuyClick, {
    cta_name: "How to Buy",
    ...params,
  });
};
