import { describe, expect, it, vi } from "vitest";

import { applyCompactPreset, applyCompactPresetWithBridge, hasCompactRows, toCompactPreset } from "../applyCompactPreset";

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
});
