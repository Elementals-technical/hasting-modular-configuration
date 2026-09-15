// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { readSceneProducts } from "../sceneBridge";

vi.mock("../apiLogger", () => ({ installConfiguratorApiLogger: vi.fn() }));
vi.mock("../updateDimensionData", () => ({ updateDimensionDataForProduct: vi.fn() }));

type Host = { containerRef?: unknown; playCanvasReady?: boolean };

const host = window as unknown as Host;

const installScene = (
  configs: Record<string, unknown>,
  orderMap: Record<string, number> | null = { "rt-b": 0, "rt-a": 1 },
) => {
  const composition = orderMap ? { getOrderProductIds: () => orderMap } : null;

  host.containerRef = {
    current: {
      contentWindow: {
        ConfiguratorAPI: {
          setConfigBatch: vi.fn(),
          getConfig: vi.fn(async (productId: string) => configs[productId] ?? null),
          config: { compositionManager: { getActiveComposition: () => composition } },
        },
      },
    },
  };
  host.playCanvasReady = true;
};

describe("readSceneProducts", () => {
  afterEach(() => {
    delete host.containerRef;
    delete host.playCanvasReady;
  });

  it("reads the composition order and the config of each requested product", async () => {
    installScene({ "rt-a": { Width: 60 }, "rt-b": { Width: 80 } });

    expect(await readSceneProducts(["rt-a", "rt-b"])).toEqual({
      status: "ready",
      order: ["rt-b", "rt-a"],
      configs: { "rt-a": { Width: 60 }, "rt-b": { Width: 80 } },
    });
  });

  it("leaves out a product the scene has no config for", async () => {
    installScene({ "rt-a": { Width: 60 } });

    expect(await readSceneProducts(["rt-a", "rt-missing"])).toMatchObject({ configs: { "rt-a": { Width: 60 } } });
  });

  it("is not ready without a scene or an active composition, instead of inventing an order", async () => {
    expect(await readSceneProducts(["rt-a"])).toEqual({ status: "not-ready" });

    installScene({ "rt-a": { Width: 60 } }, null);
    expect(await readSceneProducts(["rt-a"])).toEqual({ status: "not-ready" });
  });
});
