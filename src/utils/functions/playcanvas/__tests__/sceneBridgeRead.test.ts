// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { readSceneProducts, readScenePositionsM, readSceneSupportGroups } from "../sceneBridge";

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

describe("readSceneSupportGroups", () => {
  afterEach(() => {
    delete host.containerRef;
    delete host.playCanvasReady;
  });

  // The scene answers getConfig synchronously; the layout flags sit on its composition manager.
  const installSyncScene = ({
    configs,
    order,
    manager = {},
  }: {
    configs: Record<string, unknown>;
    order: string[];
    manager?: Record<string, unknown>;
  }) => {
    const orderMap = Object.fromEntries(order.map((id, index) => [id, index]));
    const composition = { getOrderProductIds: () => orderMap, getAllProducts: () => ({ ...configs }) };

    host.containerRef = {
      current: {
        contentWindow: {
          ConfiguratorAPI: {
            setConfigBatch: vi.fn(),
            getConfig: vi.fn((productId: string) => configs[productId] ?? null),
            config: { compositionManager: { getActiveComposition: () => composition, ...manager } },
          },
        },
      },
    };
    host.playCanvasReady = true;
  };

  it("reads the group of each cabinet and of the countertop, and the side panels each group carries", () => {
    // ULH Multi-Level: the upper row rests under the countertop (group-1), the lower row has a group of its own.
    installSyncScene({
      configs: {
        top: { category: "countertops", SupportGroupId: "group-1" },
        sink: { category: "cabinets", SupportGroupId: "group-1", Width: 120 },
        "lower-a": { category: "cabinets", SupportGroupId: "layout-1", Width: 80 },
        "lower-b": { category: "cabinets", SupportGroupId: "layout-1", Width: 80 },
        "panel-left": { category: "addons", SidePanelLayout: "group-edge", SupportGroupId: "layout-1" },
        "panel-right": { category: "addons", SidePanelLayout: "group-edge", SupportGroupId: "group-1" },
      },
      order: ["lower-a", "lower-b", "sink"],
      manager: { preserveCabinetPositions: true },
    });

    expect(readSceneSupportGroups("top")).toEqual({
      layout: "rows",
      countertopGroupId: "group-1",
      cabinets: [
        { id: "lower-a", supportGroupId: "layout-1", widthCm: 80 },
        { id: "lower-b", supportGroupId: "layout-1", widthCm: 80 },
        { id: "sink", supportGroupId: "group-1", widthCm: 120 },
      ],
      sidePanelsByGroup: { "layout-1": 1, "group-1": 1 },
    });
  });

  it("puts a product without a group in the scene's default group, as the scene does", () => {
    installSyncScene({ configs: { top: {}, a: { Width: 80 }, b: { Width: "wide" } }, order: ["a", "b"] });

    expect(readSceneSupportGroups("top")).toEqual({
      layout: "single",
      countertopGroupId: "group-1",
      cabinets: [
        { id: "a", supportGroupId: "group-1", widthCm: 80 },
        { id: "b", supportGroupId: "group-1", widthCm: null },
      ],
      sidePanelsByGroup: {},
    });
  });

  it("tells columns from rows by the scene's layout policy", () => {
    installSyncScene({
      configs: { top: {}, a: { Width: 70 } },
      order: ["a"],
      manager: { preserveCabinetPositions: true, freeLayoutPolicy: { columns: true } },
    });

    expect(readSceneSupportGroups("top")?.layout).toBe("columns");
  });

  it("reads configs the scene answers with as snapshots, and leaves out what is not a cabinet", () => {
    const snapshot = (values: Record<string, unknown>) => ({ get: (key: string) => values[key], getAll: () => values });
    installSyncScene({
      configs: {
        top: snapshot({ SupportGroupId: "group-1" }),
        a: snapshot({ category: "cabinets", SupportGroupId: "row-a", Width: 50 }),
        towel: { category: "addons" },
      },
      order: ["a", "towel"],
      manager: { preserveCabinetPositions: true },
    });

    expect(readSceneSupportGroups("top")).toMatchObject({
      countertopGroupId: "group-1",
      cabinets: [{ id: "a", supportGroupId: "row-a", widthCm: 50 }],
    });
  });

  it("is null without a scene, without the countertop's config, or when the scene answers asynchronously", () => {
    expect(readSceneSupportGroups("top")).toBeNull();

    installSyncScene({ configs: { a: { Width: 80 } }, order: ["a"] });
    expect(readSceneSupportGroups("top")).toBeNull();

    installScene({ top: {}, "rt-a": { Width: 60 }, "rt-b": { Width: 80 } });
    expect(readSceneSupportGroups("top")).toBeNull();
  });
});
