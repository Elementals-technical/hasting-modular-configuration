// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { addSceneProduct, clearSceneProducts, presetSceneProducts, setSceneProductConfig } from "../sceneBridge";

vi.mock("../apiLogger", () => ({ installConfiguratorApiLogger: vi.fn() }));
vi.mock("../updateDimensionData", () => ({ updateDimensionDataForProduct: vi.fn() }));

type Host = { containerRef?: unknown; playCanvasReady?: boolean };

const host = window as unknown as Host;

const installScene = (api: Record<string, unknown>) => {
  host.containerRef = { current: { contentWindow: { ConfiguratorAPI: { setConfigBatch: vi.fn(), ...api } } } };
  host.playCanvasReady = true;
};

describe("scene restore operations", () => {
  afterEach(() => {
    delete host.containerRef;
    delete host.playCanvasReady;
  });

  it("are not ready without a scene, and call nothing", async () => {
    expect(await clearSceneProducts()).toEqual({ status: "not-ready" });
    expect(await addSceneProduct("Sink-Base", {})).toEqual({ status: "not-ready" });
    expect(await presetSceneProducts([{ name: "Sink-Base" }])).toEqual({ status: "not-ready" });
    expect(await setSceneProductConfig("rt-a", {})).toEqual({ status: "not-ready" });
  });

  it("clear the scene and report a thrown error", async () => {
    const removeAllProduct = vi.fn(async () => undefined);
    installScene({ removeAllProduct });

    expect(await clearSceneProducts()).toEqual({ status: "applied" });
    expect(removeAllProduct).toHaveBeenCalledTimes(1);

    installScene({ removeAllProduct: vi.fn(async () => Promise.reject(new Error("boom"))) });
    expect(await clearSceneProducts()).toEqual({ status: "failed", code: "scene-error", message: "boom" });
  });

  it("return the runtime id of an added product and fail when the scene creates none", async () => {
    const addProduct = vi.fn(async () => "Sink-Base-abc123");
    installScene({ addProduct });

    expect(await addSceneProduct("Sink-Base", { Width: 60 })).toEqual({
      status: "applied",
      runtimeId: "Sink-Base-abc123",
    });
    expect(addProduct).toHaveBeenCalledWith("Sink-Base", { Width: 60 });

    installScene({ addProduct: vi.fn(async () => null) });
    expect(await addSceneProduct("Sink-Base", {})).toMatchObject({ status: "failed", code: "scene-rejected" });
  });

  it("returns every runtime id created by the preset API", async () => {
    const presetProducts = vi.fn(async () => ["Sink-Base-abc123", "Sink-Cabinet-def456"]);
    installScene({ presetProducts });

    expect(await presetSceneProducts([{ name: "Sink-Base" }, { name: "Sink-Cabinet" }])).toEqual({
      status: "applied",
      runtimeIds: ["Sink-Base-abc123", "Sink-Cabinet-def456"],
    });

    // The scene does not promise the ids. Only a throw means the products were not placed,
    // so an answer without ids stays applied and the restorer reads the scene instead.
    installScene({ presetProducts: vi.fn(async () => null) });
    expect(await presetSceneProducts([{ name: "Sink-Base" }])).toEqual({ status: "applied", runtimeIds: [] });

    installScene({
      presetProducts: vi.fn(async () => {
        throw new Error("no asset");
      }),
    });
    expect(await presetSceneProducts([{ name: "Sink-Base" }])).toMatchObject({ status: "failed" });
  });

  it("tell a missing product from an applied config", async () => {
    installScene({ setConfig: vi.fn(async () => ({ success: true })) });
    expect(await setSceneProductConfig("rt-a", { Width: 60 })).toEqual({ status: "applied" });

    installScene({ setConfig: vi.fn(async () => false) });
    expect(await setSceneProductConfig("rt-a", { Width: 60 })).toMatchObject({
      status: "failed",
      code: "product-not-found",
    });
  });
});
