// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { readSceneProducts, readScenePositionsM } from "../sceneBridge";

vi.mock("../apiLogger", () => ({ installConfiguratorApiLogger: vi.fn() }));
vi.mock("../updateDimensionData", () => ({ updateDimensionDataForProduct: vi.fn() }));

type Host = { containerRef?: unknown; playCanvasReady?: boolean };

const host = window as unknown as Host;

const installScene = (
  configs: Record<string, unknown>,
  orderMap: Record<string, number> | null = { "rt-b": 0, "rt-a": 1 },
  entityPositions: Record<string, { x: number; y: number; z: number }> = {},
) => {
  const composition = orderMap ? { getOrderProductIds: () => orderMap } : null;
  const findByName = (name: string) => {
    const position = entityPositions[name];
    return position ? { getPosition: () => position } : null;
  };

  host.containerRef = {
    current: {
      contentWindow: {
        ConfiguratorAPI: {
          setConfigBatch: vi.fn(),
          getConfig: vi.fn(async (productId: string) => configs[productId] ?? null),
          config: { compositionManager: { getActiveComposition: () => composition }, root: { findByName } },
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

  it("reads the values of a config the scene answers with as a snapshot", async () => {
    // The scene's SnapshotProductAttribute: the values sit behind get/getAll, not on the object.
    class SnapshotProductAttribute {
      private readonly _params: Record<string, unknown>;
      constructor(data: Record<string, unknown>) {
        this._params = Object.freeze({ ...data });
      }
      get(key: string) {
        return this._params[key];
      }
      getAll() {
        return this._params;
      }
    }
    installScene({ "rt-a": new SnapshotProductAttribute({ Width: 50, Height: 38, Depth: 46 }), "rt-b": { Width: 80 } });

    expect(await readSceneProducts(["rt-a", "rt-b"])).toMatchObject({
      configs: { "rt-a": { Width: 50, Height: 38, Depth: 46 }, "rt-b": { Width: 80 } },
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

describe("readScenePositionsM", () => {
  afterEach(() => {
    delete host.containerRef;
    delete host.playCanvasReady;
  });

  it("reads where each product's entity stands, which a resize moves while the config keeps its position", () => {
    installScene({ "rt-a": { Width: 105, positionX: 0.45, positionY: 0 } }, undefined, {
      "rt-a": { x: 0.525, y: 0, z: 0.23 },
    });

    expect(readScenePositionsM(["rt-a"])).toEqual({ "rt-a": { x: 0.525, y: 0 } });
  });

  it("leaves out a product without an entity, and reads nothing without a scene", () => {
    expect(readScenePositionsM(["rt-a"])).toEqual({});

    installScene({}, undefined, { "rt-a": { x: 0.3, y: -0.38, z: 0.23 } });
    expect(readScenePositionsM(["rt-a", "rt-missing"])).toEqual({ "rt-a": { x: 0.3, y: -0.38 } });
  });
});
