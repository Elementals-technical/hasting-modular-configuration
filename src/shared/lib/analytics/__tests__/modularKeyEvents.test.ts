// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  MODULAR_ANALYTICS_MESSAGE_SOURCE,
  MODULAR_ANALYTICS_MESSAGE_TYPE,
  MODULAR_KEY_EVENT_NAMES,
  trackModularHowToBuyClick,
  trackModularOrderFreeSwatchesClick,
} from "../modularKeyEvents";

type TestWindow = Window & {
  dataLayer?: unknown[];
  gtag?: ReturnType<typeof vi.fn>;
};

describe("modularKeyEvents", () => {
  afterEach(() => {
    delete (window as TestWindow).dataLayer;
    delete (window as TestWindow).gtag;
    vi.restoreAllMocks();
  });

  it("pushes modular key events to dataLayer and gtag", () => {
    const testWindow = window as TestWindow;
    testWindow.gtag = vi.fn();

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
    expect(testWindow.gtag).toHaveBeenCalledWith(
      "event",
      MODULAR_KEY_EVENT_NAMES.howToBuyClick,
      expect.objectContaining({
        cta_name: "How to Buy",
        cta_location: "bottom_sticky_bar",
        configurator_flow: "custom",
      }),
    );
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
});
