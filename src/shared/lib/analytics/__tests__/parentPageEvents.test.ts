// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  resolveHowToBuySubmitTargetOrigin,
  trackConfiguratorHowToBuySubmit,
  trackConfiguratorNextClick,
  trackConfiguratorQuoteDownload,
} from "../parentPageEvents";

const EVENT_ID_PATTERN = /^hb_\d{13}_[0-9a-z]{5}$/;

const contactSubmission = {
  firstname: "Test",
  lastname: "Buyer",
  email: "qa@example.com",
  phone: "+1 555 0100",
  message: "Hello",
  configuration_url: "https://www.hastingsbathcollection.com/products/x?configId=1",
};

const originalParentDescriptor = Object.getOwnPropertyDescriptor(window, "parent");

const mockParentWindow = () => {
  const postMessage = vi.fn();
  Object.defineProperty(window, "parent", { configurable: true, value: { postMessage } });
  return postMessage;
};

const setReferrer = (referrer: string) => {
  Object.defineProperty(document, "referrer", { configurable: true, value: referrer });
};

describe("parentPageEvents", () => {
  afterEach(() => {
    if (originalParentDescriptor) Object.defineProperty(window, "parent", originalParentDescriptor);
    Reflect.deleteProperty(document, "referrer");
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("posts the Next click to any parent origin in the client's format", () => {
    const postMessage = mockParentWindow();

    trackConfiguratorNextClick({ flow: "prebuilt", step: 2 });

    expect(postMessage.mock.calls).toStrictEqual([
      [
        {
          source: "hastings_configurator",
          event: "configurator_next_click",
          event_id: expect.stringMatching(EVENT_ID_PATTERN),
          flow: "prebuilt",
          step: 2,
          product: "urban_standard_height",
        },
        "*",
      ],
    ]);
  });

  it("reports the custom flow as create_your_own and a missing flow as prebuilt", () => {
    const postMessage = mockParentWindow();

    trackConfiguratorNextClick({ flow: "custom", step: 1 });
    trackConfiguratorNextClick({ flow: undefined, step: 3 });

    expect(postMessage.mock.calls.map(([message]) => message.flow)).toEqual(["create_your_own", "prebuilt"]);
  });

  it("posts the quote download without a step", () => {
    const postMessage = mockParentWindow();

    trackConfiguratorQuoteDownload({ flow: "custom" });

    expect(postMessage.mock.calls).toStrictEqual([
      [
        {
          source: "hastings_configurator",
          event: "configurator_quote_download",
          event_id: expect.stringMatching(EVENT_ID_PATTERN),
          flow: "create_your_own",
          product: "urban_standard_height",
        },
        "*",
      ],
    ]);
  });

  it("posts the How to Buy submit with the four contact fields to the allowed parent origin only", () => {
    const postMessage = mockParentWindow();

    trackConfiguratorHowToBuySubmit({
      flow: "prebuilt",
      submissionValues: contactSubmission,
      hostUrl: "https://www.hastingsbathcollection.com/products/vanities?utm_source=x",
    });

    expect(postMessage.mock.calls).toStrictEqual([
      [
        {
          source: "hastings_configurator",
          event: "configurator_how_to_buy_submit",
          event_id: expect.stringMatching(EVENT_ID_PATTERN),
          flow: "prebuilt",
          product: "urban_standard_height",
          email: "qa@example.com",
          phone: "+1 555 0100",
          first_name: "Test",
          last_name: "Buyer",
        },
        "https://www.hastingsbathcollection.com",
      ],
    ]);
  });

  it("takes the How to Buy target from the referrer when it is an allowed origin", () => {
    const postMessage = mockParentWindow();
    setReferrer("https://info.hastingsbathcollection.com/modular-configurator");

    trackConfiguratorHowToBuySubmit({ flow: "custom", submissionValues: contactSubmission, hostUrl: null });

    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ event: "configurator_how_to_buy_submit", flow: "create_your_own" }),
      "https://info.hastingsbathcollection.com",
    );
  });

  it("leaves out contact keys that HubSpot sent blank or not at all", () => {
    const postMessage = mockParentWindow();

    trackConfiguratorHowToBuySubmit({
      flow: "prebuilt",
      submissionValues: { email: " qa@example.com ", firstname: "  ", lastname: "" },
      hostUrl: "https://hastingsbathcollection.com/",
    });

    const [message, targetOrigin] = postMessage.mock.calls[0];
    expect(targetOrigin).toBe("https://hastingsbathcollection.com");
    expect(message.email).toBe("qa@example.com");
    expect(Object.keys(message).sort()).toEqual(["email", "event", "event_id", "flow", "product", "source"]);
  });

  it.each([
    ["no known parent origin", null],
    ["the HubSpot sandbox", "https://www-hastingsbathcollection-com.sandbox.hs-sites.com/products/x"],
    ["plain http", "http://www.hastingsbathcollection.com/products/x"],
    ["a non-default port", "https://www.hastingsbathcollection.com:8443/products/x"],
    ["a look-alike host", "https://hastingsbathcollection.com.evil.test/products/x"],
    ["an invalid URL", "not a url"],
  ])("withholds the How to Buy submit for %s", (_, hostUrl) => {
    const postMessage = mockParentWindow();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    trackConfiguratorHowToBuySubmit({ flow: "prebuilt", submissionValues: contactSubmission, hostUrl });

    expect(postMessage).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(warn.mock.calls)).not.toContain("qa@example.com");
  });

  it("does nothing outside an iframe", () => {
    const postMessage = vi.spyOn(window, "postMessage");

    expect(() => {
      trackConfiguratorNextClick({ flow: "prebuilt", step: 1 });
      trackConfiguratorQuoteDownload({ flow: "prebuilt" });
      trackConfiguratorHowToBuySubmit({
        flow: "prebuilt",
        submissionValues: contactSubmission,
        hostUrl: "https://www.hastingsbathcollection.com/",
      });
    }).not.toThrow();
    expect(postMessage).not.toHaveBeenCalled();
  });

  it("never throws when posting to the parent fails", () => {
    const postMessage = mockParentWindow();
    postMessage.mockImplementation(() => {
      throw new Error("DataCloneError");
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(() => trackConfiguratorNextClick({ flow: "prebuilt", step: 1 })).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("gives every message its own event_id", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1729350000000);
    const postMessage = mockParentWindow();

    trackConfiguratorNextClick({ flow: "prebuilt", step: 1 });
    trackConfiguratorNextClick({ flow: "prebuilt", step: 1 });

    const [first, second] = postMessage.mock.calls.map(([message]) => message.event_id);
    expect(first).toMatch(/^hb_1729350000000_[0-9a-z]{5}$/);
    expect(second).toMatch(/^hb_1729350000000_[0-9a-z]{5}$/);
    expect(first).not.toBe(second);
  });
});

describe("resolveHowToBuySubmitTargetOrigin", () => {
  it("prefers an allowed ancestor origin", () => {
    expect(
      resolveHowToBuySubmitTargetOrigin({
        ancestorOrigin: "https://www.hastingsbathcollection.com",
        referrer: "https://info.hastingsbathcollection.com/",
        hostUrl: null,
      }),
    ).toBe("https://www.hastingsbathcollection.com");
  });

  it("falls through a masked or foreign ancestor origin to the referrer, then to hostUrl", () => {
    expect(
      resolveHowToBuySubmitTargetOrigin({
        ancestorOrigin: "null",
        referrer: "https://info.hastingsbathcollection.com/page",
        hostUrl: null,
      }),
    ).toBe("https://info.hastingsbathcollection.com");
    expect(
      resolveHowToBuySubmitTargetOrigin({
        ancestorOrigin: "https://evil.example",
        referrer: "",
        hostUrl: "https://hastingsbathcollection.com/products/x?configId=1",
      }),
    ).toBe("https://hastingsbathcollection.com");
  });

  it("returns null when no candidate is an allowed origin", () => {
    expect(
      resolveHowToBuySubmitTargetOrigin({
        ancestorOrigin: "https://evil.example",
        referrer: "https://www-hastingsbathcollection-com.sandbox.hs-sites.com/",
        hostUrl: "/products/x",
      }),
    ).toBeNull();
  });
});
