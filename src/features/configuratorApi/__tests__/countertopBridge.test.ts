import { describe, expect, it, vi } from "vitest";

import { createConfiguratorBridge } from "../bridge";
import { ConfiguratorError, type ConfiguratorApi } from "../types";

const bridgeFor = (api: Partial<ConfiguratorApi> | null) =>
  createConfiguratorBridge({ getApi: () => api as ConfiguratorApi | null });

describe("countertop length bridge (v2)", () => {
  it("previewCountertopLength resolves false without previewLength and forwards otherwise", async () => {
    expect(await bridgeFor({ countertopOverlay: {} as never }).previewCountertopLength!({ side: "left", lengthM: 2 })).toBe(false);
    expect(await bridgeFor(null).previewCountertopLength!(null)).toBe(false);
    const previewLength = vi.fn();
    const bridge = bridgeFor({ countertopOverlay: { previewLength } as never });
    expect(await bridge.previewCountertopLength!({ side: "right", lengthM: 1.5 })).toBe(true);
    expect(await bridge.previewCountertopLength!(null)).toBe(true);
    expect(previewLength.mock.calls).toEqual([[{ side: "right", lengthM: 1.5 }], [null]]);
    await expect(bridge.previewCountertopLength!({ side: "right", lengthM: Number.NaN })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });

  it("countertopLengthAtPointer resolves null when unsupported and forwards side, point and options", async () => {
    expect(await bridgeFor({}).countertopLengthAtPointer!("left", { x: 1, y: 2 })).toBeNull();
    const hit = { lengthM: 2, rawLengthM: 2.02, snappedTo: null, limits: { minLengthM: 1, maxLengthM: 3 } };
    const lengthAtPointer = vi.fn(() => hit);
    const bridge = bridgeFor({ countertopOverlay: { lengthAtPointer } as never });
    expect(await bridge.countertopLengthAtPointer!("left", { x: 1, y: 2 }, { snap: false })).toEqual(hit);
    expect(lengthAtPointer).toHaveBeenCalledWith("left", { x: 1, y: 2 }, { snap: false });
    lengthAtPointer.mockReturnValueOnce(null as never);
    expect(await bridge.countertopLengthAtPointer!("right", { x: 0, y: 0 })).toBeNull();
    expect(lengthAtPointer).toHaveBeenLastCalledWith("right", { x: 0, y: 0 }, undefined);
  });

  it("resizeCountertopFrom forwards, maps runtime errors and rejects when unavailable", async () => {
    await expect(bridgeFor(null).resizeCountertopFrom!("left", 2)).rejects.toMatchObject({ code: "API_UNAVAILABLE" });
    const missing = bridgeFor({ countertop: {} }).resizeCountertopFrom!("left", 2);
    await expect(missing).rejects.toBeInstanceOf(ConfiguratorError);
    await expect(missing).rejects.toMatchObject({ code: "API_METHOD_UNAVAILABLE", operation: "countertop.resizeFrom" });

    const resizeFrom = vi.fn(async () => ({ customLength: 2 }));
    const bridge = bridgeFor({ countertop: { resizeFrom } });
    expect(await bridge.resizeCountertopFrom!("right", 2)).toEqual({ customLength: 2 });
    expect(resizeFrom).toHaveBeenCalledWith("right", 2);

    resizeFrom.mockRejectedValueOnce({ code: "NOT_MOVED", message: "Attached tops resize symmetrically" });
    await expect(bridge.resizeCountertopFrom!("left", 2)).rejects.toMatchObject({
      code: "NOT_MOVED",
      message: "Attached tops resize symmetrically",
      operation: "countertop.resizeFrom",
    });
    await expect(bridge.resizeCountertopFrom!("left", Number.POSITIVE_INFINITY)).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});
