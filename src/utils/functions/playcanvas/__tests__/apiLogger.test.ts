// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { installConfiguratorApiLogger, resetConfiguratorApiLogger } from "../apiLogger";

type LoggerHost = {
  containerRef?: { current?: { contentWindow?: { ConfiguratorAPI?: Record<string, unknown> } } };
};

const host = window as unknown as LoggerHost;

afterEach(() => {
  delete host.containerRef;
  resetConfiguratorApiLogger();
});

describe("Configurator API logger", () => {
  it("preserves frozen namespace methods required by the general cabinet API", async () => {
    const getCapabilities = vi.fn(async () => ({ ok: true, data: { readiness: "ready" } }));
    const cabinets: Record<string, unknown> = {};
    Object.defineProperty(cabinets, "getCapabilities", {
      value: getCapabilities,
      writable: false,
      configurable: false,
      enumerable: true,
    });
    const contentWindow = { ConfiguratorAPI: { cabinets } };
    host.containerRef = { current: { contentWindow } };

    expect(installConfiguratorApiLogger()).toBe(true);
    const proxiedCabinets = contentWindow.ConfiguratorAPI.cabinets as {
      getCapabilities: () => Promise<unknown>;
    };

    await expect(proxiedCabinets.getCapabilities()).resolves.toEqual({
      ok: true,
      data: { readiness: "ready" },
    });
    expect(getCapabilities).toHaveBeenCalledOnce();
  });
});
