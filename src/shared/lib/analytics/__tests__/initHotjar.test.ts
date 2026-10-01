// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { initHotjar } from "../initHotjar";

const getHotjarScripts = () => document.querySelectorAll<HTMLScriptElement>("script#hotjar-tracking");

describe("initHotjar", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    getHotjarScripts().forEach((script) => script.remove());
    delete window.hj;
    delete window._hjSettings;
  });

  it("does nothing without a site id", () => {
    vi.stubEnv("VITE_HOTJAR_SITE_ID", "");

    initHotjar();

    expect(getHotjarScripts()).toHaveLength(0);
    expect(window.hj).toBeUndefined();
  });

  it("loads the tracking script once for the configured site", () => {
    vi.stubEnv("VITE_HOTJAR_SITE_ID", " 123 ");

    initHotjar();
    initHotjar();

    const scripts = getHotjarScripts();
    expect(scripts).toHaveLength(1);
    expect(scripts[0].src).toBe("https://static.hotjar.com/c/hotjar-123.js?sv=6");
    expect(window._hjSettings).toEqual({ hjid: 123, hjsv: 6 });
  });

  it("queues calls made before the script loads as Arguments objects", () => {
    vi.stubEnv("VITE_HOTJAR_SITE_ID", "123");

    initHotjar();
    window.hj?.("event", "hastings_modular_how_to_buy_click");

    const firstCall = window.hj?.q?.[0];
    expect(Object.prototype.toString.call(firstCall)).toBe("[object Arguments]");
    expect(Array.from(firstCall ?? [])).toEqual(["event", "hastings_modular_how_to_buy_click"]);
  });
});
