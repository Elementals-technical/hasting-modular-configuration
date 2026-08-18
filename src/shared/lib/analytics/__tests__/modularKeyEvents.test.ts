// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  MODULAR_ANALYTICS_MESSAGE_SOURCE,
  MODULAR_ANALYTICS_MESSAGE_TYPE,
  MODULAR_KEY_EVENT_NAMES,
  trackModularHowToBuyClick,
  trackModularOrderFreeSwatchesClick,
} from "../modularKeyEvents";

type TestWindow = Window & {
  dataLayer?: unknown[];
};

describe("modularKeyEvents", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(() => Promise.resolve({}));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    delete (window as TestWindow).dataLayer;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const getLastCollectUrl = () => {
    const [url] = fetchMock.mock.calls.at(-1) ?? [];
    expect(url).toEqual(expect.stringContaining("https://www.google-analytics.com/g/collect"));
    return new URL(String(url));
  };

  it("pushes modular key events to dataLayer and GA collect", () => {
    const testWindow = window as TestWindow;

    window.history.replaceState(null, "", "/custom/summary?configId=123");

    trackModularHowToBuyClick({
      cta_location: "bottom_sticky_bar",
      configurator_flow: "custom",
    });

    expect(testWindow.dataLayer).toHaveLength(1);
    expect(testWindow.dataLayer?.[0]).toMatchObject({
      event: MODULAR_KEY_EVENT_NAMES.howToBuyClick,
      event_category: "modular_configurator",
      event_action: "click",
      event_label: "How to Buy",
      cta_name: "How to Buy",
      cta_location: "bottom_sticky_bar",
      configurator_flow: "custom",
      page_path: "/custom/summary",
    });

    const collectUrl = getLastCollectUrl();
    expect(collectUrl.searchParams.get("tid")).toBe("G-68WCR6H7MY");
    expect(collectUrl.searchParams.get("en")).toBe(MODULAR_KEY_EVENT_NAMES.howToBuyClick);
    expect(collectUrl.searchParams.get("ep.cta_name")).toBe("How to Buy");
    expect(collectUrl.searchParams.get("ep.cta_location")).toBe("bottom_sticky_bar");
    expect(collectUrl.searchParams.get("ep.configurator_flow")).toBe("custom");
  });

  it("uses one shared order-free-swatches event with location details", () => {
    trackModularOrderFreeSwatchesClick({
      cta_location: "countertop_color",
      configurator_flow: "prebuilt",
      product_element: "Countertop Color",
    });

    expect((window as TestWindow).dataLayer?.[0]).toMatchObject({
      event: MODULAR_KEY_EVENT_NAMES.orderFreeSwatchesClick,
      cta_name: "Order Free Swatches",
      cta_location: "countertop_color",
      configurator_flow: "prebuilt",
      product_element: "Countertop Color",
    });

    const collectUrl = getLastCollectUrl();
    expect(collectUrl.searchParams.get("en")).toBe("hastings_modular_swatches_click");
    expect(collectUrl.searchParams.get("ep.original_event")).toBe(MODULAR_KEY_EVENT_NAMES.orderFreeSwatchesClick);
  });

  it("posts the same event payload to the iframe parent", () => {
    const postMessage = vi.fn();
    Object.defineProperty(window, "parent", {
      configurable: true,
      value: { postMessage },
    });
    window.history.replaceState(
      null,
      "",
      "/prebuilt/model?hostUrl=https%3A%2F%2Fwww.hastingsbathcollection.com%2Fproducts%2Fvanities",
    );

    trackModularOrderFreeSwatchesClick({
      cta_location: "cabinet_color",
      configurator_flow: "prebuilt",
      product_element: "Cabinet Color",
    });

    expect(postMessage).toHaveBeenCalledWith(
      {
        source: MODULAR_ANALYTICS_MESSAGE_SOURCE,
        type: MODULAR_ANALYTICS_MESSAGE_TYPE,
        payload: expect.objectContaining({
          event: MODULAR_KEY_EVENT_NAMES.orderFreeSwatchesClick,
          cta_location: "cabinet_color",
        }),
      },
      "https://www.hastingsbathcollection.com",
    );
  });

  it("sends a GA collect request when gtag has not loaded yet", () => {
    trackModularHowToBuyClick({
      cta_location: "bottom_sticky_bar",
      configurator_flow: "prebuilt",
    });

    expect((window as TestWindow).dataLayer).toEqual([
      expect.objectContaining({
        event: MODULAR_KEY_EVENT_NAMES.howToBuyClick,
      }),
    ]);
    expect(getLastCollectUrl().searchParams.get("en")).toBe(MODULAR_KEY_EVENT_NAMES.howToBuyClick);
  });
});
