type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
};

const GA_COLLECT_ENDPOINT = "https://www.google-analytics.com/g/collect";
const GA_CLIENT_ID_STORAGE_KEY = "hastings:ga:client_id";
const GA_SESSION_ID_STORAGE_KEY = "hastings:ga:session_id";

export const MODULAR_ANALYTICS_MESSAGE_SOURCE = "hastings_modular_configurator";
export const MODULAR_ANALYTICS_MESSAGE_TYPE = "hastings_modular_key_event";

export const MODULAR_KEY_EVENT_NAMES = {
  customizeClick: "hastings_modular_customize_click",
  orderFreeSwatchesClick: "hastings_modular_order_free_swatches_click",
  howToBuyClick: "hastings_modular_how_to_buy_click",
} as const;

export type ModularKeyEventName = (typeof MODULAR_KEY_EVENT_NAMES)[keyof typeof MODULAR_KEY_EVENT_NAMES];
export type ModularConfiguratorFlow = "prebuilt" | "custom";

const MODULAR_GA_EVENT_NAMES: Record<ModularKeyEventName, string> = {
  [MODULAR_KEY_EVENT_NAMES.customizeClick]: MODULAR_KEY_EVENT_NAMES.customizeClick,
  [MODULAR_KEY_EVENT_NAMES.orderFreeSwatchesClick]: "hastings_modular_swatches_click",
  [MODULAR_KEY_EVENT_NAMES.howToBuyClick]: MODULAR_KEY_EVENT_NAMES.howToBuyClick,
};

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

const getConfiguredGaId = () => import.meta.env.VITE_GA_ID?.trim() ?? "";

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

const createRandomNumber = () => {
  const analyticsWindow = getAnalyticsWindow();
  const cryptoApi = analyticsWindow?.crypto;

  if (cryptoApi) {
    const values = new Uint32Array(1);
    cryptoApi.getRandomValues(values);
    return values[0] ?? Math.floor(Math.random() * 2_147_483_647);
  }

  return Math.floor(Math.random() * 2_147_483_647);
};

const readStorageValue = (storage: Storage | undefined, key: string) => {
  try {
    return storage?.getItem(key) ?? "";
  } catch {
    return "";
  }
};

const writeStorageValue = (storage: Storage | undefined, key: string, value: string) => {
  try {
    storage?.setItem(key, value);
  } catch {
    return;
  }
};

const getOrCreateStorageValue = (storage: Storage | undefined, key: string, createValue: () => string) => {
  const existing = readStorageValue(storage, key);
  if (existing) return existing;

  const next = createValue();
  writeStorageValue(storage, key, next);
  return next;
};

const getGaClientId = () => {
  const analyticsWindow = getAnalyticsWindow();

  return getOrCreateStorageValue(
    analyticsWindow?.localStorage,
    GA_CLIENT_ID_STORAGE_KEY,
    () => `${createRandomNumber()}.${Math.floor(Date.now() / 1000)}`,
  );
};

const getGaSessionId = () => {
  const analyticsWindow = getAnalyticsWindow();

  return getOrCreateStorageValue(analyticsWindow?.sessionStorage, GA_SESSION_ID_STORAGE_KEY, () =>
    String(Math.floor(Date.now() / 1000)),
  );
};

const appendGaCollectParam = (searchParams: URLSearchParams, key: string, value: string | number | undefined) => {
  if (value === undefined || value === "") return;

  searchParams.set(key, String(value));
};

const sendGaCollectEvent = (event: ModularKeyEventName, params: Record<string, string | number>) => {
  const analyticsWindow = getAnalyticsWindow();
  const gaId = getConfiguredGaId();
  if (!analyticsWindow || !gaId) return false;

  const gaEventName = MODULAR_GA_EVENT_NAMES[event];
  const collectUrl = new URL(GA_COLLECT_ENDPOINT);
  const searchParams = collectUrl.searchParams;

  appendGaCollectParam(searchParams, "v", "2");
  appendGaCollectParam(searchParams, "tid", gaId);
  appendGaCollectParam(searchParams, "cid", getGaClientId());
  appendGaCollectParam(searchParams, "sid", getGaSessionId());
  appendGaCollectParam(searchParams, "en", gaEventName);
  appendGaCollectParam(searchParams, "dl", analyticsWindow.location.href);
  appendGaCollectParam(searchParams, "dt", analyticsWindow.document.title);
  appendGaCollectParam(searchParams, "dr", analyticsWindow.document.referrer);
  appendGaCollectParam(searchParams, "ul", analyticsWindow.navigator.language);
  appendGaCollectParam(searchParams, "sr", `${analyticsWindow.screen.width}x${analyticsWindow.screen.height}`);
  appendGaCollectParam(searchParams, "_p", createRandomNumber());

  Object.entries(params).forEach(([key, value]) => {
    if (key === "send_to") return;

    appendGaCollectParam(searchParams, typeof value === "number" ? `epn.${key}` : `ep.${key}`, value);
  });

  void fetch(collectUrl.toString(), {
    method: "GET",
    mode: "no-cors",
    keepalive: true,
  }).catch(() => {
    const image = new Image();
    image.src = collectUrl.toString();
  });

  return true;
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
    send_to: getConfiguredGaId(),
    original_event: event,
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
  sendGaCollectEvent(event, gtagParams);
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
