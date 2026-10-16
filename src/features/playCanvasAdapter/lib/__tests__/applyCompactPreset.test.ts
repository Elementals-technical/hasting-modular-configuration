import { describe, expect, it, vi } from "vitest";

import {
  applyCompactPreset,
  applyCompactPresetWithBridge,
  hasCompactRows,
  mergeCompactPresetOverrides,
  toCompactPreset,
} from "../applyCompactPreset";

describe("applyCompactPreset", () => {
  const entry = {
    format: "ulh-compact-v1",
    collection: "ULH",
    shared: {},
    rows: [{ products: [{ name: "ULH-sink-cabinet", Width: 60 }] }],
    top: { productType: "Top_Solid" },
  };

  it("detects compact rows", () => {
    expect(hasCompactRows(entry)).toBe(true);
    expect(hasCompactRows({})).toBe(false);
    expect(hasCompactRows(null)).toBe(false);
  });

  it("drops empty sections and sends the compact document to the client", async () => {
    expect(toCompactPreset(entry)).toEqual({
      format: "ulh-compact-v1",
      collection: "ULH",
      rows: entry.rows,
      top: { productType: "Top_Solid" },
    });
    const importCompactPreset = vi.fn(async () => ({ keyToProductId: {} }) as never);
    await applyCompactPreset({ importCompactPreset }, entry, { x: 0, y: 0, z: 0 });
    expect(importCompactPreset).toHaveBeenCalledWith(toCompactPreset(entry), { x: 0, y: 0, z: 0 });
  });

  describe("applyCompactPresetWithBridge", () => {
    const fakeClient = (importImpl?: () => Promise<never>) => {
      const client = {
        connect: vi.fn(async () => client as never),
        importCompactPreset: vi.fn(importImpl ?? (async () => ({ keyToProductId: {} }) as never)),
        dispose: vi.fn(),
      };
      return client;
    };

    it("skips flat presets without creating a client", async () => {
      const createClient = vi.fn(() => fakeClient());
      await expect(applyCompactPresetWithBridge({ rows: [] }, createClient)).resolves.toBeNull();
      await expect(applyCompactPresetWithBridge(null, createClient)).resolves.toBeNull();
      expect(createClient).not.toHaveBeenCalled();
    });

    it("connects, imports and disposes the client", async () => {
      const client = fakeClient();
      await expect(applyCompactPresetWithBridge(entry, () => client)).resolves.toEqual({ keyToProductId: {} });
      expect(client.connect).toHaveBeenCalledTimes(1);
      expect(client.importCompactPreset).toHaveBeenCalledWith(toCompactPreset(entry), undefined);
      expect(client.dispose).toHaveBeenCalledTimes(1);
    });

    it("disposes the client when the import fails", async () => {
      const client = fakeClient(async () => {
        throw new Error("boom");
      });
      await expect(applyCompactPresetWithBridge(entry, () => client)).rejects.toThrow("boom");
      expect(client.dispose).toHaveBeenCalledTimes(1);
    });
  });

  describe("mergeCompactPresetOverrides", () => {
    const multiLevelPreset = {
      format: "ulh-compact-v1",
      collection: "ULH",
      shared: { Width: 90, CountertopColor: "Bianco Male TFA", CabinetColor: "Rox Black TKQ" },
      rows: [
        { products: [{ name: "ULH-sink-cabinet", sinkType: "Top_HPL/Fenix_Cover_Gres" }] },
        { elevation: -38, offsetX: 61, products: [{ name: "ULH-side-cabinet" }] },
      ],
      top: { productType: "Top_Solid", CountertopColor: "Bianco Male TFA", sinkType: "Top_HPL/Fenix_Cover_Gres" },
    };

    it("carries the user's colors and basin into the shared values, the top and the sink cabinet", () => {
      const snapshot = structuredClone(multiLevelPreset);

      const merged = mergeCompactPresetOverrides(multiLevelPreset, {
        CabinetColor: "Oak TKQ",
        CountertopColor: "Nero TFA",
        sinkType: "Top_Ceramic",
      });

      expect(merged.shared).toEqual({ Width: 90, CountertopColor: "Nero TFA", CabinetColor: "Oak TKQ" });
      expect(merged.top).toEqual({ productType: "Top_Solid", CountertopColor: "Nero TFA", sinkType: "Top_Ceramic" });
      expect(merged.rows?.[0].products[0]).toEqual({ name: "ULH-sink-cabinet", sinkType: "Top_Ceramic" });
      expect(merged.rows?.[1]).toEqual({ elevation: -38, offsetX: 61, products: [{ name: "ULH-side-cabinet" }] });
      expect(multiLevelPreset).toEqual(snapshot);
    });

    it("returns the same preset when there is nothing to carry over", () => {
      expect(mergeCompactPresetOverrides(multiLevelPreset, {})).toBe(multiLevelPreset);
    });
  });
});
